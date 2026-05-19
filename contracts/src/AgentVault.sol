// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import {Ownable} from "openzeppelin-contracts/contracts/access/Ownable.sol";

/**
 * @title AgentVault
 * @dev Holds the agent's USDC reserves, authorizes capital deployment into markets,
 *      and tracks calibration P&L. USYC integration is stubbed for future yield.
 */
contract AgentVault is Ownable {
    IERC20 public collateralToken; // USDC
    address public agent; // Authorized agent EOA

    // Calibration tracking per market
    struct MarketPosition {
        uint256 amountDeployed;
        bool isYes; // side the agent staked on
        bool settled;
        uint256 payout;
    }

    mapping(address => MarketPosition) public positions;
    address[] public activeMarkets;

    // Aggregate P&L tracking
    uint256 public totalDeployed;
    uint256 public totalReturned;
    uint256 public marketsWon;
    uint256 public marketsLost;

    event CapitalDeployed(address indexed market, uint256 amount, bool isYes);
    event CapitalWithdrawn(address indexed market, uint256 payout);
    event OutcomeRecorded(address indexed market, bool won, uint256 payout);
    event DepositedToUSYC(uint256 amount);
    event RedeemedFromUSYC(uint256 amount);

    modifier onlyAgent() {
        require(msg.sender == agent, "Only agent");
        _;
    }

    constructor(address _collateralToken, address _agent) Ownable(msg.sender) {
        collateralToken = IERC20(_collateralToken);
        agent = _agent;
    }

    /**
     * @dev Deploy capital from the vault into a prediction market
     * @param market The PredictionMarket contract address
     * @param amount Amount of collateral to deploy (scaled 1e18)
     * @param isYes Whether to stake on YES or NO
     */
    function deployCapital(address market, uint256 amount, bool isYes) external onlyAgent {
        require(positions[market].amountDeployed == 0, "Already deployed to this market");
        require(collateralToken.balanceOf(address(this)) >= amount, "Insufficient vault balance");

        // Approve the market to pull collateral
        collateralToken.approve(market, amount);

        positions[market] = MarketPosition({
            amountDeployed: amount,
            isYes: isYes,
            settled: false,
            payout: 0
        });
        activeMarkets.push(market);
        totalDeployed += amount;

        emit CapitalDeployed(market, amount, isYes);
    }

    /**
     * @dev Record the outcome of a resolved market (called by agent after claiming)
     * @param market The resolved PredictionMarket address
     * @param won Whether the agent's position won
     * @param payout The amount returned from the market
     */
    function recordOutcome(address market, bool won, uint256 payout) external onlyAgent {
        MarketPosition storage pos = positions[market];
        require(pos.amountDeployed > 0, "No position in this market");
        require(!pos.settled, "Already settled");

        pos.settled = true;
        pos.payout = payout;
        totalReturned += payout;

        if (won) {
            marketsWon++;
        } else {
            marketsLost++;
        }

        emit OutcomeRecorded(market, won, payout);
    }

    /**
     * @dev Get the available capital in the vault (not deployed)
     */
    function getAvailableCapital() external view returns (uint256) {
        return collateralToken.balanceOf(address(this));
    }

    /**
     * @dev Get the agent's calibration score (win rate as basis points)
     */
    function getCalibrationScore() external view returns (uint256 winRate, uint256 totalMarkets) {
        totalMarkets = marketsWon + marketsLost;
        if (totalMarkets == 0) return (0, 0);
        winRate = (marketsWon * 10000) / totalMarkets; // basis points
    }

    /**
     * @dev Update the authorized agent address
     */
    function setAgent(address _agent) external onlyOwner {
        agent = _agent;
    }

    // ──────────────────────────────────────────────
    // USYC Stubs — to be implemented with Circle SDK
    // ──────────────────────────────────────────────

    /**
     * @dev Stub: Deposit idle USDC into USYC for yield
     */
    function depositToUSYC(uint256 amount) external onlyAgent {
        // TODO: Integrate with Circle's USYC contract
        // collateralToken.approve(usycContract, amount);
        // IUsyc(usycContract).deposit(amount);
        emit DepositedToUSYC(amount);
    }

    /**
     * @dev Stub: Redeem USYC back to USDC for market deployment
     */
    function redeemFromUSYC(uint256 amount) external onlyAgent {
        // TODO: Integrate with Circle's USYC contract
        // IUsyc(usycContract).redeem(amount);
        emit RedeemedFromUSYC(amount);
    }
}
