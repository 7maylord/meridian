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
 */
contract MeridianMarket is Ownable {
    // ─── Market Structure ───

    struct Market {
        string question;
        string resolutionCriteria;
        address collateralToken;
        uint8 collateralDecimals;
        uint256 b;              // LMSR liquidity parameter (18-decimal scale)
        uint256 qYes;           // Total YES shares outstanding (18-decimal scale)
        uint256 qNo;            // Total NO shares outstanding (18-decimal scale)
        uint256 expiry;         // Unix timestamp for market expiry
        bool isResolved;
        bool outcome;           // true = YES wins, false = NO wins
        address creator;
        uint256 totalCollateral; // Total collateral held for this market
    }

    // ─── State ───

    uint256 public marketCount;
    mapping(uint256 => Market) public markets;

    // Positions: marketId => user => YES/NO balance (18-decimal scale)
    mapping(uint256 => mapping(address => uint256)) public yesBalances;
    mapping(uint256 => mapping(address => uint256)) public noBalances;

    // Oracle & collateral config
    address public oracle;
    mapping(address => bool) public supportedCollateral;
    mapping(address => uint8) public collateralDecimals;

    uint256 internal constant INTERNAL_DECIMALS = 18;

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
    event SharesBought(uint256 indexed marketId, address indexed buyer, bool isYes, uint256 shares, uint256 collateralCost);
    event SharesSold(uint256 indexed marketId, address indexed seller, bool isYes, uint256 shares, uint256 collateralRefund);
    event MarketResolved(uint256 indexed marketId, bool outcome);
    event WinningsClaimed(uint256 indexed marketId, address indexed user, uint256 payout);
    event CollateralAdded(address indexed token, uint8 decimals);
    event CollateralRemoved(address indexed token);

    // ─── Constructor ───

    constructor(address _oracle) Ownable(msg.sender) {
        oracle = _oracle;
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

    // ─── Market Creation ───

    /**
     * @dev Create a new prediction market. Does NOT deploy a new contract.
     * @return marketId The ID of the newly created market
     */
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

    /**
     * @dev Calculates cost function C(q) = b * ln(exp(qYes/b) + exp(qNo/b))
     */
    function costFunction(uint256 _qYes, uint256 _qNo, uint256 _b) public pure returns (uint256) {
        SD59x18 qYesSd = sd(int256(_qYes));
        SD59x18 qNoSd = sd(int256(_qNo));
        SD59x18 bSd = sd(int256(_b));

        SD59x18 expYes = (qYesSd.div(bSd)).exp();
        SD59x18 expNo = (qNoSd.div(bSd)).exp();
        SD59x18 sumExp = expYes.add(expNo);
        SD59x18 lnSumExp = sumExp.ln();
        SD59x18 costSd = bSd.mul(lnSumExp);

        return uint256(unwrap(costSd));
    }

    /**
     * @dev Calculate internal cost (18-decimal) to buy `shares` of an outcome in a specific market
     */
    function getCostInternal(uint256 marketId, bool isYes, uint256 shares) public view returns (uint256) {
        Market storage m = markets[marketId];
        uint256 currentCost = costFunction(m.qYes, m.qNo, m.b);
        uint256 newCost;

        if (isYes) {
            newCost = costFunction(m.qYes + shares, m.qNo, m.b);
        } else {
            newCost = costFunction(m.qYes, m.qNo + shares, m.b);
        }

        return newCost - currentCost;
    }

    /**
     * @dev Calculate cost in collateral-token decimals
     */
    function getCost(uint256 marketId, bool isYes, uint256 shares) public view returns (uint256) {
        Market storage m = markets[marketId];
        uint256 internalCost = getCostInternal(marketId, isYes, shares);
        return _scaleDown(internalCost, m.collateralDecimals);
    }

    // ─── Trading ───

    /**
     * @dev Buy shares of YES or NO in a specific market
     * @param marketId The market to trade in
     * @param isYes true to buy YES, false to buy NO
     * @param shares Number of shares in internal 18-decimal scale
     */
    function buy(uint256 marketId, bool isYes, uint256 shares) external {
        Market storage m = markets[marketId];
        require(!m.isResolved, "Market already resolved");
        require(m.b > 0, "Market does not exist");

        uint256 internalCost = getCostInternal(marketId, isYes, shares);
        uint256 collateralCost = _scaleDown(internalCost, m.collateralDecimals);
        require(collateralCost > 0, "Cost rounds to zero");

        require(
            IERC20(m.collateralToken).transferFrom(msg.sender, address(this), collateralCost),
            "Transfer failed"
        );

        if (isYes) {
            m.qYes += shares;
            yesBalances[marketId][msg.sender] += shares;
        } else {
            m.qNo += shares;
            noBalances[marketId][msg.sender] += shares;
        }

        m.totalCollateral += collateralCost;
        emit SharesBought(marketId, msg.sender, isYes, shares, collateralCost);
    }

    // ─── Resolution ───

    /**
     * @dev Resolve a market — only callable by the oracle
     */
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
     * @dev Claim winnings after resolution.
     *      Distributes the total collateral pool pro-rata among winning share holders.
     *      payout = (userWinningShares / totalWinningShares) * totalCollateral
     */
    function claim(uint256 marketId) external {
        Market storage m = markets[marketId];
        require(m.isResolved, "Not resolved yet");

        uint256 userShares;
        uint256 totalWinningShares;

        if (m.outcome) {
            userShares = yesBalances[marketId][msg.sender];
            totalWinningShares = m.qYes;
        } else {
            userShares = noBalances[marketId][msg.sender];
            totalWinningShares = m.qNo;
        }

        require(userShares > 0, "No winning shares");

        // Zero out balance before transfer (reentrancy guard)
        if (m.outcome) {
            yesBalances[marketId][msg.sender] = 0;
        } else {
            noBalances[marketId][msg.sender] = 0;
        }

        // Pro-rata payout from the pool
        uint256 payout = (m.totalCollateral * userShares) / totalWinningShares;
        require(payout > 0, "Payout rounds to zero");

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
        if (m.b == 0) return (5000, 5000); // 50/50 for non-existent

        // Price = exp(q_i / b) / (exp(q_yes / b) + exp(q_no / b))
        // Returns basis points (0-10000)
        SD59x18 bSd = sd(int256(m.b));
        SD59x18 expYes = (sd(int256(m.qYes)).div(bSd)).exp();
        SD59x18 expNo = (sd(int256(m.qNo)).div(bSd)).exp();
        SD59x18 sumExp = expYes.add(expNo);

        // Multiply by 10000 for basis points
        SD59x18 tenK = sd(10000e18);
        yesPrice = uint256(unwrap(expYes.div(sumExp).mul(tenK))) / 1e18;
        noPrice = 10000 - yesPrice;
    }
}
