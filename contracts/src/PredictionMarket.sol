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
    IERC20 public collateralToken; // Collateral (Assuming 18 decimals for simplicity with PRBMath)
    OutcomeToken public yesToken;
    OutcomeToken public noToken;

    string public question;
    uint256 public b; // Liquidity parameter, scaled by 1e18
    
    uint256 public qYes; // Total YES shares sold (scaled 1e18)
    uint256 public qNo;  // Total NO shares sold (scaled 1e18)

    bool public isResolved;
    bool public outcome; // true = YES, false = NO

    event MarketResolved(bool outcome);
    event SharesBought(address indexed buyer, bool isYes, uint256 shares, uint256 cost);

    constructor(string memory _question, address _collateralToken, uint256 _b) {
        question = _question;
        collateralToken = IERC20(_collateralToken);
        b = _b;

        yesToken = new OutcomeToken("YES Token", "YES");
        noToken = new OutcomeToken("NO Token", "NO");
    }

    /**
     * @dev Calculates the cost function C(q) = b * ln(exp(qYes/b) + exp(qNo/b))
     * Uses PRBMath SD59x18 for logarithms and exponentials
     */
    function costFunction(uint256 _qYes, uint256 _qNo) public view returns (uint256) {
        SD59x18 qYesSD = sd(int256(_qYes));
        SD59x18 qNoSD = sd(int256(_qNo));
        SD59x18 bSD = sd(int256(b));

        // exp(qYes/b)
        SD59x18 expYes = (qYesSD.div(bSD)).exp();
        // exp(qNo/b)
        SD59x18 expNo = (qNoSD.div(bSD)).exp();

        // ln(exp(qYes/b) + exp(qNo/b))
        SD59x18 sumExp = expYes.add(expNo);
        SD59x18 lnSumExp = sumExp.ln();

        // b * ln(...)
        SD59x18 costSD = bSD.mul(lnSumExp);

        return uint256(unwrap(costSD));
    }

    /**
     * @dev Calculate cost to buy `shares` of an outcome
     */
    function getCost(bool isYes, uint256 shares) public view returns (uint256) {
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
     * @dev Buy shares of YES or NO
     */
    function buy(bool isYes, uint256 shares) external {
        require(!isResolved, "Market already resolved");
        
        uint256 cost = getCost(isYes, shares);
        
        // Transfer collateral from buyer to market
        require(collateralToken.transferFrom(msg.sender, address(this), cost), "Transfer failed");

        if (isYes) {
            qYes += shares;
            yesToken.mint(msg.sender, shares);
        } else {
            qNo += shares;
            noToken.mint(msg.sender, shares);
        }

        emit SharesBought(msg.sender, isYes, shares, cost);
    }

    /**
     * @dev Resolve the market
     * Note: In production, this should be restricted to the ResolutionOracle
     */
    function resolve(bool _outcome) external {
        require(!isResolved, "Already resolved");
        isResolved = true;
        outcome = _outcome;
        emit MarketResolved(_outcome);
    }

    /**
     * @dev Claim winnings (1 collateral token per winning share)
     */
    function claim() external {
        require(isResolved, "Not resolved yet");

        uint256 payout = 0;
        if (outcome) {
            uint256 balance = yesToken.balanceOf(msg.sender);
            if (balance > 0) {
                yesToken.burn(msg.sender, balance);
                payout += balance;
            }
        } else {
            uint256 balance = noToken.balanceOf(msg.sender);
            if (balance > 0) {
                noToken.burn(msg.sender, balance);
                payout += balance;
            }
        }

        require(payout > 0, "No winning shares");
        require(collateralToken.transfer(msg.sender, payout), "Transfer failed");
    }
}
