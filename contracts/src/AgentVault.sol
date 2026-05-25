// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import {Ownable} from "openzeppelin-contracts/contracts/access/Ownable.sol";

interface ITeller {
    function deposit(uint256 assets, address receiver) external returns (uint256);
    function redeem(uint256 shares, address receiver, address account) external returns (uint256);
}

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

contract AgentVault is Ownable {
    IERC20 public collateralToken;
    IERC20 public usycToken;
    ITeller public teller;
    address public agent;
    IMeridianMarketVault public meridianMarket;

    struct MarketPosition {
        uint256 amountDeployed;
        uint256 shares;
        bool isYes;
        bool settled;
        uint256 payout;
    }

    mapping(uint256 => MarketPosition) public positions;
    uint256[] public activeMarketIds;

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

        IERC20(_collateralToken).approve(_meridianMarket, type(uint256).max);

        for (uint256 i = 0; i < _extraCollateral.length; i++) {
            IERC20(_extraCollateral[i]).approve(_meridianMarket, type(uint256).max);
        }
    }

    function approveCollateral(address token) external onlyOwner {
        IERC20(token).approve(address(meridianMarket), type(uint256).max);
    }

    function deployCapital(uint256 marketId, bool isYes, uint256 shares) external onlyAgent {
        require(positions[marketId].amountDeployed == 0, "Already deployed to this market");

        uint256 cost = meridianMarket.getCost(marketId, isYes, shares);
        require(collateralToken.balanceOf(address(this)) >= cost, "Insufficient vault balance");

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

    function claimWinnings(uint256 marketId) external onlyAgent {
        MarketPosition storage pos = positions[marketId];
        require(pos.amountDeployed > 0, "No position in this market");
        require(!pos.settled, "Already settled");

        (,,,,,,bool isResolved, bool outcome,,) = meridianMarket.getMarket(marketId);
        require(isResolved, "Market not resolved yet");

        uint256 balBefore = collateralToken.balanceOf(address(this));

        bool won = (outcome == pos.isYes);

        if (won) {
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

    function getAvailableCapital() external view returns (uint256) {
        return collateralToken.balanceOf(address(this));
    }

    function getUsycBalance() external view returns (uint256) {
        return usycToken.balanceOf(address(this));
    }

    function getCalibrationScore() external view returns (uint256 winRate, uint256 totalMarkets) {
        totalMarkets = marketsWon + marketsLost;
        if (totalMarkets == 0) return (0, 0);
        winRate = (marketsWon * 10000) / totalMarkets;
    }

    function getNetPnL() external view returns (int256) {
        return int256(totalReturned) - int256(totalDeployed);
    }

    function getActiveMarketCount() external view returns (uint256) {
        return activeMarketIds.length;
    }

    function setAgent(address _agent) external onlyOwner {
        agent = _agent;
    }

    function setMeridianMarket(address _meridianMarket) external onlyOwner {
        collateralToken.approve(address(meridianMarket), 0);
        meridianMarket = IMeridianMarketVault(_meridianMarket);
        collateralToken.approve(_meridianMarket, type(uint256).max);
    }

    function depositToUsyc(uint256 amount) external onlyAgent {
        require(collateralToken.balanceOf(address(this)) >= amount, "Insufficient USDC");
        collateralToken.approve(address(teller), amount);
        uint256 usycReceived = teller.deposit(amount, address(this));
        emit DepositedToUsyc(amount, usycReceived);
    }

    function redeemFromUsyc(uint256 amount) external onlyAgent {
        require(usycToken.balanceOf(address(this)) >= amount, "Insufficient USYC");
        usycToken.approve(address(teller), amount);
        uint256 usdcReceived = teller.redeem(amount, address(this), address(this));
        emit RedeemedFromUsyc(amount, usdcReceived);
    }
}
