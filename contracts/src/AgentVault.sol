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

/// @dev Interface for the unified MeridianMarket contract
interface IMeridianMarketVault {
    function buy(uint256 marketId, bool isYes, uint256 shares) external;
    function claim(uint256 marketId) external;
    function getCost(uint256 marketId, bool isYes, uint256 shares) external view returns (uint256);
    function getUserPosition(uint256 marketId, address user) external view returns (uint256 yesShares, uint256 noShares);
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
    );
}

/**
 * @title AgentVault
 * @dev Holds the agent's USDC reserves, deploys capital into MeridianMarket markets,
 *      tracks calibration P&L, and earns yield on idle capital via USYC.
 *      Now wired to the single MeridianMarket contract using market IDs.
 */
contract AgentVault is Ownable {
    IERC20 public collateralToken; // USDC (6 decimals on Arc)
    IERC20 public usycToken;       // USYC token (6 decimals)
    ITeller public teller;         // USYC Teller contract
    address public agent;          // Authorized agent EOA
    IMeridianMarketVault public meridianMarket; // The single market contract

    // Calibration tracking per market (now by ID)
    struct MarketPosition {
        uint256 amountDeployed; // Collateral spent (6-decimal USDC)
        uint256 shares;         // Shares purchased (18-decimal scale)
        bool isYes;
        bool settled;
        uint256 payout;
    }

    mapping(uint256 => MarketPosition) public positions;
    uint256[] public activeMarketIds;

    // Aggregate P&L tracking
    uint256 public totalDeployed;
    uint256 public totalReturned;
    uint256 public marketsWon;
    uint256 public marketsLost;

    event CapitalDeployed(uint256 indexed marketId, uint256 amount, uint256 shares, bool isYes);
    event CapitalClaimed(uint256 indexed marketId, uint256 payout);
    event OutcomeRecorded(uint256 indexed marketId, bool won, uint256 payout);
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
        address _agent,
        address _meridianMarket,
        address[] memory _extraCollateral
    ) Ownable(msg.sender) {
        collateralToken = IERC20(_collateralToken);
        usycToken = IERC20(_usycToken);
        teller = ITeller(_teller);
        agent = _agent;
        meridianMarket = IMeridianMarketVault(_meridianMarket);

        // Pre-approve the MeridianMarket contract to pull primary collateral
        IERC20(_collateralToken).approve(_meridianMarket, type(uint256).max);

        // Pre-approve additional collateral tokens (e.g. EURC for European markets)
        for (uint256 i = 0; i < _extraCollateral.length; i++) {
            IERC20(_extraCollateral[i]).approve(_meridianMarket, type(uint256).max);
        }
    }

    /**
     * @dev Approve an additional collateral token for MeridianMarket spending.
     *      Use when new collateral types are added to MeridianMarket.
     */
    function approveCollateral(address token) external onlyOwner {
        IERC20(token).approve(address(meridianMarket), type(uint256).max);
    }

    // ──────────────────────────────────────────────
    // Market Trading
    // ──────────────────────────────────────────────

    /**
     * @dev Deploy capital from the vault into a prediction market by buying shares.
     *      The vault approves and calls MeridianMarket.buy() directly.
     * @param marketId The MeridianMarket market ID
     * @param isYes true = buy YES, false = buy NO
     * @param shares Number of shares in 18-decimal scale
     */
    function deployCapital(uint256 marketId, bool isYes, uint256 shares) external onlyAgent {
        require(positions[marketId].amountDeployed == 0, "Already deployed to this market");

        // Calculate the cost first
        uint256 cost = meridianMarket.getCost(marketId, isYes, shares);
        require(collateralToken.balanceOf(address(this)) >= cost, "Insufficient vault balance");

        // Buy shares on the MeridianMarket
        meridianMarket.buy(marketId, isYes, shares);

        positions[marketId] = MarketPosition({
            amountDeployed: cost,
            shares: shares,
            isYes: isYes,
            settled: false,
            payout: 0
        });
        activeMarketIds.push(marketId);
        totalDeployed += cost;

        emit CapitalDeployed(marketId, cost, shares, isYes);
    }

    /**
     * @dev Claim winnings from a resolved market. 
     *      Calls MeridianMarket.claim() which transfers collateral back to the vault.
     */
    function claimWinnings(uint256 marketId) external onlyAgent {
        MarketPosition storage pos = positions[marketId];
        require(pos.amountDeployed > 0, "No position in this market");
        require(!pos.settled, "Already settled");

        // Check if market is resolved
        (,,,,,,bool isResolved, bool outcome,,) = meridianMarket.getMarket(marketId);
        require(isResolved, "Market not resolved yet");

        uint256 balBefore = collateralToken.balanceOf(address(this));

        // Determine if we won
        bool won = (outcome == pos.isYes);

        if (won) {
            // Claim payout from MeridianMarket
            meridianMarket.claim(marketId);
        }

        uint256 balAfter = collateralToken.balanceOf(address(this));
        uint256 payout = balAfter - balBefore;

        pos.settled = true;
        pos.payout = payout;
        totalReturned += payout;

        if (won) {
            marketsWon++;
        } else {
            marketsLost++;
        }

        emit OutcomeRecorded(marketId, won, payout);
    }

    // ──────────────────────────────────────────────
    // View Functions
    // ──────────────────────────────────────────────

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
     * @dev Get the net P&L of the vault
     */
    function getNetPnL() external view returns (int256) {
        return int256(totalReturned) - int256(totalDeployed);
    }

    /**
     * @dev Get active market count
     */
    function getActiveMarketCount() external view returns (uint256) {
        return activeMarketIds.length;
    }

    /**
     * @dev Update the authorized agent address
     */
    function setAgent(address _agent) external onlyOwner {
        agent = _agent;
    }

    /**
     * @dev Update the MeridianMarket contract (and re-approve)
     */
    function setMeridianMarket(address _meridianMarket) external onlyOwner {
        // Revoke old approval
        collateralToken.approve(address(meridianMarket), 0);
        // Set new
        meridianMarket = IMeridianMarketVault(_meridianMarket);
        collateralToken.approve(_meridianMarket, type(uint256).max);
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
        collateralToken.approve(address(teller), amount);
        uint256 usycReceived = teller.deposit(amount, address(this));
        emit DepositedToUsyc(amount, usycReceived);
    }

    /**
     * @dev Redeem USYC back to USDC via Teller (to deploy into markets)
     * @param amount Amount of USYC to redeem (6 decimals)
     */
    function redeemFromUsyc(uint256 amount) external onlyAgent {
        require(usycToken.balanceOf(address(this)) >= amount, "Insufficient USYC");
        usycToken.approve(address(teller), amount);
        uint256 usdcReceived = teller.redeem(amount, address(this), address(this));
        emit RedeemedFromUsyc(amount, usdcReceived);
    }
}
