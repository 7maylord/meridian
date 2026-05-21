// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import {Ownable} from "openzeppelin-contracts/contracts/access/Ownable.sol";
import {SD59x18, sd, unwrap} from "prb-math/SD59x18.sol";

/**
 * @title MeridianMarket
 * @dev Single-contract prediction market registry using LMSR pricing.
 *      All markets live in one contract via a mapping, avoiding per-market deployments.
 *      Positions are tracked as internal balances (no ERC20 outcome tokens).
 *
 *      Payout model (pro-rata / parimutuel):
 *        payout = (userWinningShares / totalWinningShares) * totalCollateral
 *
 *      totalCollateral accumulates net trading costs from all buy() calls and
 *      decreases on sell(). At resolution the full pool is distributed to winning
 *      share holders proportionally — losers' capital flows to winners.
 *      The LMSR pricing formula determines entry cost; it does not guarantee a
 *      fixed $1 redemption per share. Actual payout per share will be greater than
 *      cost-per-share when the losing side had significant volume, and approximately
 *      equal to cost-per-share in a one-sided market (no arb profit available).
 */
contract MeridianMarket is Ownable {
    // ─── Market Structure ───

    struct Market {
        string question;
        string resolutionCriteria;
        address collateralToken;
        uint8 collateralDecimals;
        uint256 b;               // LMSR liquidity parameter (18-decimal scale)
        uint256 qYes;            // Total YES shares outstanding (18-decimal scale)
        uint256 qNo;             // Total NO shares outstanding (18-decimal scale)
        uint256 expiry;          // Unix timestamp
        bool isResolved;
        bool outcome;            // true = YES wins, false = NO wins
        address creator;
        uint256 totalCollateral; // Net collateral held (after fees extracted)
    }

    // ─── State ───

    uint256 public marketCount;
    mapping(uint256 => Market) public markets;

    // Positions: marketId => user => share balance (18-decimal scale)
    mapping(uint256 => mapping(address => uint256)) public yesBalances;
    mapping(uint256 => mapping(address => uint256)) public noBalances;

    // Oracle & collateral config
    address public oracle;
    mapping(address => bool) public supportedCollateral;
    mapping(address => uint8) public collateralDecimals;

    // Builder fee: taken on every buy and sell, sent to feeCollector
    uint16 public builderFeeRate = 50;   // basis points — 50 bps = 0.5%
    address public feeCollector;

    uint256 internal constant INTERNAL_DECIMALS = 18;
    uint256 internal constant BPS_DENOM = 10_000;

    // ─── Events ───

    event MarketCreated(
        uint256 indexed marketId,
        string question,
        string resolutionCriteria,
        uint256 expiry,
        uint256 initialB,
        address indexed collateral,
        address indexed creator
    );
    event SharesBought(
        uint256 indexed marketId,
        address indexed buyer,
        bool isYes,
        uint256 shares,
        uint256 collateralCost,
        uint256 fee
    );
    event SharesSold(
        uint256 indexed marketId,
        address indexed seller,
        bool isYes,
        uint256 shares,
        uint256 collateralRefund,
        uint256 fee
    );
    event MarketResolved(uint256 indexed marketId, bool outcome);
    event WinningsClaimed(uint256 indexed marketId, address indexed user, uint256 payout);
    event CollateralAdded(address indexed token, uint8 decimals);
    event CollateralRemoved(address indexed token);
    event FeeCollectorSet(address indexed feeCollector);
    event BuilderFeeRateSet(uint16 newRate);

    // ─── Constructor ───

    constructor(address _oracle) Ownable(msg.sender) {
        oracle = _oracle;
        feeCollector = msg.sender; // owner collects fees until explicitly changed
    }

    // ─── Admin ───

    function addCollateral(address token, uint8 decimals) external onlyOwner {
        supportedCollateral[token] = true;
        collateralDecimals[token] = decimals;
        emit CollateralAdded(token, decimals);
    }

    function removeCollateral(address token) external onlyOwner {
        supportedCollateral[token] = false;
        emit CollateralRemoved(token);
    }

    function setOracle(address _oracle) external onlyOwner {
        oracle = _oracle;
    }

    function setFeeCollector(address _feeCollector) external onlyOwner {
        feeCollector = _feeCollector;
        emit FeeCollectorSet(_feeCollector);
    }

    function setBuilderFeeRate(uint16 _rate) external onlyOwner {
        require(_rate <= 500, "Max 5%");
        builderFeeRate = _rate;
        emit BuilderFeeRateSet(_rate);
    }

    // ─── Market Creation ───

    function createMarket(
        string calldata question,
        string calldata resolutionCriteria,
        uint256 expiry,
        uint256 initialB,
        address collateral
    ) external returns (uint256 marketId) {
        require(expiry > block.timestamp, "Expiry must be in the future");
        require(initialB > 0, "b must be > 0");
        require(supportedCollateral[collateral], "Unsupported collateral");

        marketId = marketCount++;
        uint8 decimals = collateralDecimals[collateral];

        markets[marketId] = Market({
            question: question,
            resolutionCriteria: resolutionCriteria,
            collateralToken: collateral,
            collateralDecimals: decimals,
            b: initialB,
            qYes: 0,
            qNo: 0,
            expiry: expiry,
            isResolved: false,
            outcome: false,
            creator: msg.sender,
            totalCollateral: 0
        });

        emit MarketCreated(marketId, question, resolutionCriteria, expiry, initialB, collateral, msg.sender);
    }

    // ─── Scaling Helpers ───

    function _scaleUp(uint256 amount, uint8 _decimals) internal pure returns (uint256) {
        if (_decimals >= INTERNAL_DECIMALS) return amount;
        return amount * (10 ** (INTERNAL_DECIMALS - _decimals));
    }

    function _scaleDown(uint256 amount, uint8 _decimals) internal pure returns (uint256) {
        if (_decimals >= INTERNAL_DECIMALS) return amount;
        return amount / (10 ** (INTERNAL_DECIMALS - _decimals));
    }

    // ─── LMSR Math (all internal 18-decimal scale) ───

    function costFunction(uint256 _qYes, uint256 _qNo, uint256 _b) public pure returns (uint256) {
        SD59x18 qYesSd = sd(int256(_qYes));
        SD59x18 qNoSd  = sd(int256(_qNo));
        SD59x18 bSd    = sd(int256(_b));

        SD59x18 expYes  = (qYesSd.div(bSd)).exp();
        SD59x18 expNo   = (qNoSd.div(bSd)).exp();
        SD59x18 sumExp  = expYes.add(expNo);
        SD59x18 costSd  = bSd.mul(sumExp.ln());

        return uint256(unwrap(costSd));
    }

    function getCostInternal(uint256 marketId, bool isYes, uint256 shares) public view returns (uint256) {
        Market storage m = markets[marketId];
        uint256 currentCost = costFunction(m.qYes, m.qNo, m.b);
        uint256 newCost = isYes
            ? costFunction(m.qYes + shares, m.qNo, m.b)
            : costFunction(m.qYes, m.qNo + shares, m.b);
        return newCost - currentCost;
    }

    function getCost(uint256 marketId, bool isYes, uint256 shares) public view returns (uint256) {
        Market storage m = markets[marketId];
        uint256 internalCost = getCostInternal(marketId, isYes, shares);
        return _scaleDown(internalCost, m.collateralDecimals);
    }

    /**
     * @dev LMSR sell refund (before fee): cost decreases when shares are removed.
     *      refund = C(q) - C(q - shares)
     */
    function getSellRefundInternal(uint256 marketId, bool isYes, uint256 shares) public view returns (uint256) {
        Market storage m = markets[marketId];
        require(isYes ? m.qYes >= shares : m.qNo >= shares, "Shares exceed supply");
        uint256 currentCost = costFunction(m.qYes, m.qNo, m.b);
        uint256 newCost = isYes
            ? costFunction(m.qYes - shares, m.qNo, m.b)
            : costFunction(m.qYes, m.qNo - shares, m.b);
        return currentCost - newCost;
    }

    function getSellRefund(uint256 marketId, bool isYes, uint256 shares) public view returns (uint256) {
        Market storage m = markets[marketId];
        uint256 internalRefund = getSellRefundInternal(marketId, isYes, shares);
        return _scaleDown(internalRefund, m.collateralDecimals);
    }

    // ─── Trading ───

    /**
     * @dev Buy shares. The builder fee is charged as a surcharge on top of the LMSR cost,
     *      paid directly from the buyer to feeCollector. The pool receives exactly the LMSR
     *      cost, keeping pool accounting consistent with the cost function.
     *
     *      User pays: lmsrCost + fee = lmsrCost × (1 + builderFeeRate/10000)
     *      Pool receives: lmsrCost (unchanged for LMSR math)
     *      Collector receives: fee
     */
    function buy(uint256 marketId, bool isYes, uint256 shares) external {
        Market storage m = markets[marketId];
        require(m.b > 0, "Market does not exist");
        require(!m.isResolved, "Market already resolved");
        require(block.timestamp < m.expiry, "Market expired");

        uint256 lmsrCost = _scaleDown(getCostInternal(marketId, isYes, shares), m.collateralDecimals);
        require(lmsrCost > 0, "Cost rounds to zero");

        uint256 fee = (lmsrCost * builderFeeRate) / BPS_DENOM;

        // Pool receives the raw LMSR cost
        require(
            IERC20(m.collateralToken).transferFrom(msg.sender, address(this), lmsrCost),
            "Transfer failed"
        );

        // Fee is a surcharge paid directly from buyer to collector (separate transfer)
        if (fee > 0 && feeCollector != address(0)) {
            require(
                IERC20(m.collateralToken).transferFrom(msg.sender, feeCollector, fee),
                "Fee transfer failed"
            );
        }

        if (isYes) {
            m.qYes += shares;
            yesBalances[marketId][msg.sender] += shares;
        } else {
            m.qNo += shares;
            noBalances[marketId][msg.sender] += shares;
        }

        m.totalCollateral += lmsrCost;
        emit SharesBought(marketId, msg.sender, isYes, shares, lmsrCost, fee);
    }

    /**
     * @dev Sell shares back to the AMM before market expiry.
     *      No additional fee on sell — the buyer already paid the entry fee.
     *      Pool pays the full LMSR refund to the seller.
     */
    function sell(uint256 marketId, bool isYes, uint256 shares) external {
        Market storage m = markets[marketId];
        require(m.b > 0, "Market does not exist");
        require(!m.isResolved, "Market already resolved");
        require(block.timestamp < m.expiry, "Market expired");

        uint256 userShares = isYes
            ? yesBalances[marketId][msg.sender]
            : noBalances[marketId][msg.sender];
        require(userShares >= shares, "Insufficient shares");

        uint256 refund = getSellRefund(marketId, isYes, shares);
        require(refund > 0, "Refund rounds to zero");
        require(m.totalCollateral >= refund, "Insufficient pool liquidity");

        if (isYes) {
            m.qYes -= shares;
            yesBalances[marketId][msg.sender] -= shares;
        } else {
            m.qNo -= shares;
            noBalances[marketId][msg.sender] -= shares;
        }

        m.totalCollateral -= refund;
        require(IERC20(m.collateralToken).transfer(msg.sender, refund), "Refund transfer failed");
        emit SharesSold(marketId, msg.sender, isYes, shares, refund, 0);
    }

    // ─── Resolution ───

    function resolve(uint256 marketId, bool _outcome) external {
        require(msg.sender == oracle, "Only oracle");
        Market storage m = markets[marketId];
        require(!m.isResolved, "Already resolved");
        require(m.b > 0, "Market does not exist");

        m.isResolved = true;
        m.outcome = _outcome;
        emit MarketResolved(marketId, _outcome);
    }

    /**
     * @dev Claim winning payout (pro-rata / parimutuel).
     *      payout = (userWinningShares / totalWinningShares) * totalCollateral
     *
     *      All collateral in the pool — from both the winning and losing sides —
     *      flows to winners proportionally. Balances are zeroed before transfer
     *      to prevent reentrancy.
     */
    function claim(uint256 marketId) external {
        Market storage m = markets[marketId];
        require(m.isResolved, "Not resolved yet");

        uint256 userShares;
        uint256 totalWinningShares;

        if (m.outcome) {
            userShares        = yesBalances[marketId][msg.sender];
            totalWinningShares = m.qYes;
        } else {
            userShares        = noBalances[marketId][msg.sender];
            totalWinningShares = m.qNo;
        }

        // Check shares before pool — so a second claim reverts "No winning shares" not "Pool is empty"
        require(userShares > 0, "No winning shares");
        require(totalWinningShares > 0, "No winning shares in pool");
        require(m.totalCollateral > 0, "Pool is empty");

        // Zero out before transfer — reentrancy guard
        if (m.outcome) {
            yesBalances[marketId][msg.sender] = 0;
        } else {
            noBalances[marketId][msg.sender] = 0;
        }

        // Pro-rata share of the full collateral pool
        uint256 payout = (m.totalCollateral * userShares) / totalWinningShares;

        // Guard: payout must be at least 1 unit of collateral (accounts for rounding dust)
        require(payout >= 1, "Payout rounds to zero");

        // Cap payout at pool balance to prevent rounding from overdrawing
        if (payout > m.totalCollateral) payout = m.totalCollateral;

        m.totalCollateral -= payout;
        require(IERC20(m.collateralToken).transfer(msg.sender, payout), "Transfer failed");

        emit WinningsClaimed(marketId, msg.sender, payout);
    }

    // ─── View Functions ───

    function getMarket(uint256 marketId) external view returns (
        string memory question,
        string memory resolutionCriteria,
        address collateralToken,
        uint256 qYes,
        uint256 qNo,
        uint256 expiry,
        bool isResolved,
        bool outcome,
        address creator,
        uint256 totalCollateral
    ) {
        Market storage m = markets[marketId];
        return (
            m.question,
            m.resolutionCriteria,
            m.collateralToken,
            m.qYes,
            m.qNo,
            m.expiry,
            m.isResolved,
            m.outcome,
            m.creator,
            m.totalCollateral
        );
    }

    function getUserPosition(uint256 marketId, address user) external view returns (uint256 yesShares, uint256 noShares) {
        return (yesBalances[marketId][user], noBalances[marketId][user]);
    }

    function getPrice(uint256 marketId) external view returns (uint256 yesPrice, uint256 noPrice) {
        Market storage m = markets[marketId];
        if (m.b == 0) return (5000, 5000);

        SD59x18 bSd    = sd(int256(m.b));
        SD59x18 expYes = (sd(int256(m.qYes)).div(bSd)).exp();
        SD59x18 expNo  = (sd(int256(m.qNo)).div(bSd)).exp();
        SD59x18 sumExp = expYes.add(expNo);
        SD59x18 tenK   = sd(10000e18);

        yesPrice = uint256(unwrap(expYes.div(sumExp).mul(tenK))) / 1e18;
        noPrice  = 10000 - yesPrice;
    }
}
