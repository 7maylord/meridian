// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import {Ownable} from "openzeppelin-contracts/contracts/access/Ownable.sol";

/// @dev Interface for Circle's USYC Teller contract on Arc
interface ITeller {
    /// @notice Deposits USDC to receive USYC
    /// @param assets The amount of USDC to deposit (6 decimals)
    /// @param receiver The address to receive the USYC
    /// @return The amount of USYC minted
    function deposit(uint256 assets, address receiver) external returns (uint256);

    /// @notice Redeems USYC to receive USDC
    /// @param shares The amount of USYC to redeem (6 decimals)
    /// @param receiver The address to receive the USDC
    /// @param account The address that holds the USYC
    /// @return The amount of USDC payout
    function redeem(uint256 shares, address receiver, address account) external returns (uint256);
}

/**
 * @title AgentVault
 * @dev Holds the agent's USDC reserves, authorizes capital deployment into markets,
 *      tracks calibration P&L, and earns yield on idle capital via USYC.
 */
contract AgentVault is Ownable {
    IERC20 public collateralToken; // USDC (6 decimals on Arc)
    IERC20 public usycToken;       // USYC token (6 decimals)
    ITeller public teller;         // USYC Teller contract
    address public agent;          // Authorized agent EOA

    // Calibration tracking per market
    struct MarketPosition {
        uint256 amountDeployed;
        bool isYes;
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
    event DepositedToUsyc(uint256 usdcAmount, uint256 usycReceived);
    event RedeemedFromUsyc(uint256 usycAmount, uint256 usdcReceived);

    modifier onlyAgent() {
        require(msg.sender == agent, "Only agent");
        _;
    }

    constructor(
        address _collateralToken,
        address _usycToken,
        address _teller,
        address _agent
    ) Ownable(msg.sender) {
        collateralToken = IERC20(_collateralToken);
        usycToken = IERC20(_usycToken);
        teller = ITeller(_teller);
        agent = _agent;
    }

    /**
     * @dev Deploy capital from the vault into a prediction market
     */
    function deployCapital(address market, uint256 amount, bool isYes) external onlyAgent {
        require(positions[market].amountDeployed == 0, "Already deployed to this market");
        require(collateralToken.balanceOf(address(this)) >= amount, "Insufficient vault balance");

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
     * @dev Record the outcome of a resolved market
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
     * @dev Get available USDC capital (not deployed, not in USYC)
     */
    function getAvailableCapital() external view returns (uint256) {
        return collateralToken.balanceOf(address(this));
    }

    /**
     * @dev Get USYC balance (idle capital earning yield)
     */
    function getUsycBalance() external view returns (uint256) {
        return usycToken.balanceOf(address(this));
    }

    /**
     * @dev Get the agent's calibration score (win rate as basis points)
     */
    function getCalibrationScore() external view returns (uint256 winRate, uint256 totalMarkets) {
        totalMarkets = marketsWon + marketsLost;
        if (totalMarkets == 0) return (0, 0);
        winRate = (marketsWon * 10000) / totalMarkets;
    }

    /**
     * @dev Update the authorized agent address
     */
    function setAgent(address _agent) external onlyOwner {
        agent = _agent;
    }

    // ──────────────────────────────────────────────
    // USYC Yield Integration
    // ──────────────────────────────────────────────

    /**
     * @dev Deposit idle USDC into USYC via Teller for yield
     * @param amount Amount of USDC to deposit (6 decimals)
     */
    function depositToUsyc(uint256 amount) external onlyAgent {
        require(collateralToken.balanceOf(address(this)) >= amount, "Insufficient USDC");

        // Approve Teller to pull USDC
        collateralToken.approve(address(teller), amount);

        // Deposit USDC → receive USYC
        uint256 usycReceived = teller.deposit(amount, address(this));

        emit DepositedToUsyc(amount, usycReceived);
    }

    /**
     * @dev Redeem USYC back to USDC via Teller (to deploy into markets)
     * @param amount Amount of USYC to redeem (6 decimals)
     */
    function redeemFromUsyc(uint256 amount) external onlyAgent {
        require(usycToken.balanceOf(address(this)) >= amount, "Insufficient USYC");

        // Approve Teller to pull USYC
        usycToken.approve(address(teller), amount);

        // Redeem USYC → receive USDC
        uint256 usdcReceived = teller.redeem(amount, address(this), address(this));

        emit RedeemedFromUsyc(amount, usdcReceived);
    }
}
