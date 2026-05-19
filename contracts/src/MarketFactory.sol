// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {PredictionMarket} from "./PredictionMarket.sol";
import {Ownable} from "openzeppelin-contracts/contracts/access/Ownable.sol";

contract MarketFactory is Ownable {
    address public collateralToken;
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
        address indexed creator
    );

    constructor(address _collateralToken, address _oracle) Ownable(msg.sender) {
        collateralToken = _collateralToken;
        oracle = _oracle;
    }

    /**
     * @dev Deploy a new PredictionMarket instance
     * @param question The prediction market question
     * @param resolutionCriteria Exact, unambiguous resolution conditions
     * @param expiry Unix timestamp for market expiry
     * @param initialB LMSR liquidity parameter (scaled 1e18)
     */
    function createMarket(
        string calldata question,
        string calldata resolutionCriteria,
        uint256 expiry,
        uint256 initialB
    ) external returns (address marketAddress) {
        require(expiry > block.timestamp, "Expiry must be in the future");
        require(initialB > 0, "b must be > 0");

        PredictionMarket market = new PredictionMarket(question, collateralToken, initialB);
        marketAddress = address(market);

        markets.push(marketAddress);
        isMarket[marketAddress] = true;

        emit MarketCreated(marketAddress, question, resolutionCriteria, expiry, initialB, msg.sender);
    }

    /**
     * @dev Get all deployed market addresses
     */
    function getMarkets() external view returns (address[] memory) {
        return markets;
    }

    /**
     * @dev Get the total number of markets created
     */
    function getMarketCount() external view returns (uint256) {
        return markets.length;
    }

    /**
     * @dev Update the builder fee rate (basis points)
     */
    function setBuilderFeeRate(uint16 _rate) external onlyOwner {
        require(_rate <= 1000, "Fee too high"); // max 10%
        builderFeeRate = _rate;
    }

    /**
     * @dev Update the oracle address
     */
    function setOracle(address _oracle) external onlyOwner {
        oracle = _oracle;
    }
}
