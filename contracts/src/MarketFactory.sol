// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {PredictionMarket} from "./PredictionMarket.sol";
import {Ownable} from "openzeppelin-contracts/contracts/access/Ownable.sol";

contract MarketFactory is Ownable {
    // Supported collateral tokens
    mapping(address => bool) public supportedCollateral;
    mapping(address => uint8) public collateralDecimals;

    address public oracle;
    uint16 public builderFeeRate; // basis points (e.g., 50 = 0.5%)

    address[] public markets;
    mapping(address => bool) public isMarket;

    event MarketCreated(
        address indexed market,
        string question,
        string resolutionCriteria,
        uint256 expiry,
        uint256 initialB,
        address indexed collateral,
        address indexed creator
    );
    event CollateralAdded(address indexed token, uint8 decimals);
    event CollateralRemoved(address indexed token);

    constructor(address _oracle) Ownable(msg.sender) {
        oracle = _oracle;
    }

    /**
     * @dev Add a supported collateral token (USDC, EURC, etc.)
     */
    function addCollateral(address token, uint8 decimals) external onlyOwner {
        supportedCollateral[token] = true;
        collateralDecimals[token] = decimals;
        emit CollateralAdded(token, decimals);
    }

    /**
     * @dev Remove a supported collateral token
     */
    function removeCollateral(address token) external onlyOwner {
        supportedCollateral[token] = false;
        emit CollateralRemoved(token);
    }

    /**
     * @dev Deploy a new PredictionMarket instance
     * @param question The prediction market question
     * @param resolutionCriteria Exact resolution conditions
     * @param expiry Unix timestamp for market expiry
     * @param initialB LMSR liquidity parameter (internal 18-decimal scale)
     * @param collateral The collateral token address (must be supported)
     */
    function createMarket(
        string calldata question,
        string calldata resolutionCriteria,
        uint256 expiry,
        uint256 initialB,
        address collateral
    ) external returns (address marketAddress) {
        require(expiry > block.timestamp, "Expiry must be in the future");
        require(initialB > 0, "b must be > 0");
        require(supportedCollateral[collateral], "Unsupported collateral");

        uint8 decimals = collateralDecimals[collateral];

        PredictionMarket market = new PredictionMarket(
            question,
            collateral,
            decimals,
            initialB,
            oracle
        );
        marketAddress = address(market);

        markets.push(marketAddress);
        isMarket[marketAddress] = true;

        emit MarketCreated(
            marketAddress, question, resolutionCriteria, expiry, initialB, collateral, msg.sender
        );
    }

    function getMarkets() external view returns (address[] memory) {
        return markets;
    }

    function getMarketCount() external view returns (uint256) {
        return markets.length;
    }

    function setBuilderFeeRate(uint16 _rate) external onlyOwner {
        require(_rate <= 1000, "Fee too high");
        builderFeeRate = _rate;
    }

    function setOracle(address _oracle) external onlyOwner {
        oracle = _oracle;
    }
}
