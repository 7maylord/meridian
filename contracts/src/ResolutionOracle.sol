// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "openzeppelin-contracts/contracts/access/Ownable.sol";

/**
 * @title ResolutionOracle
 * @dev Resolves prediction markets via data feeds (Tier 1) or admin verification (Tier 2).
 *      Tier 1: Chainlink/Pyth price feeds for FX, rates, etc.
 *      Tier 2: Admin-verified resolution for events without on-chain feeds.
 */
contract ResolutionOracle is Ownable {
    enum OracleTier { Feed, Admin }
    enum ComparisonType { GreaterThan, LessThan, EqualTo, GreaterThanOrEqual, LessThanOrEqual }

    struct OracleConfig {
        OracleTier tier;
        address feedAddress;        // Chainlink/Pyth feed (Tier 1 only)
        ComparisonType comparison;  // How to compare feed value to threshold
        int256 threshold;           // Value to compare against
        uint256 expiry;             // When resolution can be triggered
        bool resolved;
    }

    // market address => oracle config
    mapping(address => OracleConfig) public oracleConfigs;

    // Authorized verifiers for Tier 2 (admin) resolution
    mapping(address => bool) public verifiers;

    event OracleConfigured(address indexed market, OracleTier tier, uint256 expiry);
    event MarketResolved(address indexed market, bool outcome, OracleTier tier);
    event VerifierUpdated(address indexed verifier, bool authorized);

    constructor() Ownable(msg.sender) {
        verifiers[msg.sender] = true;
    }

    modifier onlyVerifier() {
        require(verifiers[msg.sender], "Not a verifier");
        _;
    }

    /**
     * @dev Configure oracle for a market
     * @param market The PredictionMarket address
     * @param tier Resolution tier (Feed or Admin)
     * @param feedAddress Chainlink/Pyth feed address (address(0) for Tier 2)
     * @param comparison How to compare feed value to threshold
     * @param threshold The value to compare against (scaled by feed decimals)
     * @param expiry When resolution can be triggered
     */
    function configureOracle(
        address market,
        OracleTier tier,
        address feedAddress,
        ComparisonType comparison,
        int256 threshold,
        uint256 expiry
    ) external onlyOwner {
        require(!oracleConfigs[market].resolved, "Already resolved");
        require(expiry > block.timestamp, "Expiry in past");

        if (tier == OracleTier.Feed) {
            require(feedAddress != address(0), "Feed address required for Tier 1");
        }

        oracleConfigs[market] = OracleConfig({
            tier: tier,
            feedAddress: feedAddress,
            comparison: comparison,
            threshold: threshold,
            expiry: expiry,
            resolved: false
        });

        emit OracleConfigured(market, tier, expiry);
    }

    /**
     * @dev Tier 1: Resolve a market from a Chainlink/Pyth data feed
     * @param market The PredictionMarket to resolve
     */
    function resolveFromFeed(address market) external {
        OracleConfig storage config = oracleConfigs[market];
        require(!config.resolved, "Already resolved");
        require(config.tier == OracleTier.Feed, "Not a feed-based market");
        require(block.timestamp >= config.expiry, "Not yet expired");

        // Read latest answer from Chainlink-style feed
        // Interface: function latestAnswer() external view returns (int256)
        (bool success, bytes memory data) = config.feedAddress.staticcall(
            abi.encodeWithSignature("latestAnswer()")
        );
        require(success, "Feed call failed");
        int256 answer = abi.decode(data, (int256));

        bool outcome = _compare(answer, config.comparison, config.threshold);
        config.resolved = true;

        // Call resolve on the PredictionMarket
        (bool resolveSuccess,) = market.call(
            abi.encodeWithSignature("resolve(bool)", outcome)
        );
        require(resolveSuccess, "Market resolve failed");

        emit MarketResolved(market, outcome, OracleTier.Feed);
    }

    /**
     * @dev Tier 2: Admin-verified resolution
     * @param market The PredictionMarket to resolve
     * @param outcome The resolution outcome (true = YES wins)
     */
    function resolveAdmin(address market, bool outcome) external onlyVerifier {
        OracleConfig storage config = oracleConfigs[market];
        require(!config.resolved, "Already resolved");
        require(config.tier == OracleTier.Admin, "Not an admin-resolved market");
        require(block.timestamp >= config.expiry, "Not yet expired");

        config.resolved = true;

        // Call resolve on the PredictionMarket
        (bool resolveSuccess,) = market.call(
            abi.encodeWithSignature("resolve(bool)", outcome)
        );
        require(resolveSuccess, "Market resolve failed");

        emit MarketResolved(market, outcome, OracleTier.Admin);
    }

    /**
     * @dev Add or remove a verifier
     */
    function setVerifier(address verifier, bool authorized) external onlyOwner {
        verifiers[verifier] = authorized;
        emit VerifierUpdated(verifier, authorized);
    }

    /**
     * @dev Internal comparison function
     */
    function _compare(int256 value, ComparisonType comp, int256 threshold) internal pure returns (bool) {
        if (comp == ComparisonType.GreaterThan) return value > threshold;
        if (comp == ComparisonType.LessThan) return value < threshold;
        if (comp == ComparisonType.EqualTo) return value == threshold;
        if (comp == ComparisonType.GreaterThanOrEqual) return value >= threshold;
        if (comp == ComparisonType.LessThanOrEqual) return value <= threshold;
        return false;
    }
}
