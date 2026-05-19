// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import {ERC20} from "openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "openzeppelin-contracts/contracts/access/Ownable.sol";
import {SD59x18, sd, unwrap} from "prb-math/SD59x18.sol";

contract OutcomeToken is ERC20, Ownable {
    constructor(string memory name, string memory symbol) ERC20(name, symbol) Ownable(msg.sender) {}

    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }

    function burn(address from, uint256 amount) external onlyOwner {
        _burn(from, amount);
    }
}

contract PredictionMarket {
    IERC20 public collateralToken;
    OutcomeToken public yesToken;
    OutcomeToken public noToken;

    string public question;
    uint8 public collateralDecimals; // 6 for USDC/EURC on Arc
    uint256 public b; // Liquidity parameter (internal 18-decimal scale)

    uint256 public qYes; // Total YES shares outstanding (internal 18-decimal scale)
    uint256 public qNo;  // Total NO shares outstanding (internal 18-decimal scale)

    bool public isResolved;
    bool public outcome; // true = YES, false = NO
    address public oracle; // Address authorized to resolve

    uint256 internal constant INTERNAL_DECIMALS = 18;

    event MarketResolved(bool outcome);
    event SharesBought(address indexed buyer, bool isYes, uint256 shares, uint256 collateralCost);

    constructor(
        string memory _question,
        address _collateralToken,
        uint8 _collateralDecimals,
        uint256 _b,
        address _oracle
    ) {
        question = _question;
        collateralToken = IERC20(_collateralToken);
        collateralDecimals = _collateralDecimals;
        b = _b;
        oracle = _oracle;

        yesToken = new OutcomeToken("YES Token", "YES");
        noToken = new OutcomeToken("NO Token", "NO");
    }

    // ─── Scaling Helpers ───

    /// @dev Convert from collateral decimals (e.g. 6) to internal 18-decimal scale
    function _scaleUp(uint256 amount) internal view returns (uint256) {
        if (collateralDecimals >= INTERNAL_DECIMALS) return amount;
        return amount * (10 ** (INTERNAL_DECIMALS - collateralDecimals));
    }

    /// @dev Convert from internal 18-decimal scale to collateral decimals (e.g. 6)
    function _scaleDown(uint256 amount) internal view returns (uint256) {
        if (collateralDecimals >= INTERNAL_DECIMALS) return amount;
        return amount / (10 ** (INTERNAL_DECIMALS - collateralDecimals));
    }

    // ─── LMSR Math (all internal 18-decimal scale) ───

    /**
     * @dev Calculates cost function C(q) = b * ln(exp(qYes/b) + exp(qNo/b))
     */
    function costFunction(uint256 _qYes, uint256 _qNo) public view returns (uint256) {
        // forge-lint: disable-next-line(unsafe-typecast)
        SD59x18 qYesSd = sd(int256(_qYes));
        // forge-lint: disable-next-line(unsafe-typecast)
        SD59x18 qNoSd = sd(int256(_qNo));
        // forge-lint: disable-next-line(unsafe-typecast)
        SD59x18 bSd = sd(int256(b));

        SD59x18 expYes = (qYesSd.div(bSd)).exp();
        SD59x18 expNo = (qNoSd.div(bSd)).exp();

        SD59x18 sumExp = expYes.add(expNo);
        SD59x18 lnSumExp = sumExp.ln();

        SD59x18 costSd = bSd.mul(lnSumExp);

        return uint256(unwrap(costSd));
    }

    /**
     * @dev Calculate internal cost (18-decimal) to buy `shares` of an outcome
     */
    function getCostInternal(bool isYes, uint256 shares) public view returns (uint256) {
        uint256 currentCost = costFunction(qYes, qNo);
        uint256 newCost;

        if (isYes) {
            newCost = costFunction(qYes + shares, qNo);
        } else {
            newCost = costFunction(qYes, qNo + shares);
        }

        return newCost - currentCost;
    }

    /**
     * @dev Calculate cost in collateral-token decimals to buy `shares` of an outcome
     *      `shares` is in internal 18-decimal scale
     */
    function getCost(bool isYes, uint256 shares) public view returns (uint256) {
        uint256 internalCost = getCostInternal(isYes, shares);
        return _scaleDown(internalCost);
    }

    /**
     * @dev Buy shares of YES or NO
     * @param isYes true to buy YES, false to buy NO
     * @param shares Number of shares in internal 18-decimal scale
     */
    function buy(bool isYes, uint256 shares) external {
        require(!isResolved, "Market already resolved");

        uint256 internalCost = getCostInternal(isYes, shares);
        uint256 collateralCost = _scaleDown(internalCost);
        require(collateralCost > 0, "Cost rounds to zero");

        require(
            collateralToken.transferFrom(msg.sender, address(this), collateralCost),
            "Transfer failed"
        );

        if (isYes) {
            qYes += shares;
            yesToken.mint(msg.sender, shares);
        } else {
            qNo += shares;
            noToken.mint(msg.sender, shares);
        }

        emit SharesBought(msg.sender, isYes, shares, collateralCost);
    }

    /**
     * @dev Resolve the market — only callable by the oracle
     */
    function resolve(bool _outcome) external {
        require(msg.sender == oracle, "Only oracle");
        require(!isResolved, "Already resolved");
        isResolved = true;
        outcome = _outcome;
        emit MarketResolved(_outcome);
    }

    /**
     * @dev Claim winnings — pays out 1 collateral unit per share (scaled down)
     */
    function claim() external {
        require(isResolved, "Not resolved yet");

        uint256 payout = 0;
        if (outcome) {
            uint256 balance = yesToken.balanceOf(msg.sender);
            if (balance > 0) {
                yesToken.burn(msg.sender, balance);
                payout += _scaleDown(balance);
            }
        } else {
            uint256 balance = noToken.balanceOf(msg.sender);
            if (balance > 0) {
                noToken.burn(msg.sender, balance);
                payout += _scaleDown(balance);
            }
        }

        require(payout > 0, "No winning shares");
        require(collateralToken.transfer(msg.sender, payout), "Transfer failed");
    }
}
