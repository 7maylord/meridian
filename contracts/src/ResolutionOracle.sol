// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "openzeppelin-contracts/contracts/access/Ownable.sol";

interface IMeridianMarket {
    function resolve(uint256 marketId, bool outcome) external;
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
 * @title ResolutionOracle
 * @dev Resolves prediction markets via data feeds (Tier 1) or admin verification (Tier 2).
 *      Now references markets by ID rather than by contract address.
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

    // The single MeridianMarket contract
    IMeridianMarket public meridianMarket;

    // marketId => oracle config
    mapping(uint256 => OracleConfig) public oracleConfigs;

    // Authorized verifiers for Tier 2 (admin) resolution
    mapping(address => bool) public verifiers;

    event OracleConfigured(uint256 indexed marketId, OracleTier tier, uint256 expiry);
    event MarketResolved(uint256 indexed marketId, bool outcome, OracleTier tier);
    event VerifierUpdated(address indexed verifier, bool authorized);

    constructor(address _meridianMarket) Ownable(msg.sender) {
        meridianMarket = IMeridianMarket(_meridianMarket);
        verifiers[msg.sender] = true;
    }

    modifier onlyVerifier() {
        require(verifiers[msg.sender], "Not a verifier");
        _;
    }

    /**
     * @dev Configure oracle for a market
     */
    function configureOracle(
        uint256 marketId,
        OracleTier tier,
        address feedAddress,
        ComparisonType comparison,
        int256 threshold,
        uint256 expiry
    ) external onlyOwner {
        require(!oracleConfigs[marketId].resolved, "Already resolved");
        require(expiry > block.timestamp, "Expiry in past");

        if (tier == OracleTier.Feed) {
            require(feedAddress != address(0), "Feed address required for Tier 1");
        }

        oracleConfigs[marketId] = OracleConfig({
            tier: tier,
            feedAddress: feedAddress,
            comparison: comparison,
            threshold: threshold,
            expiry: expiry,
            resolved: false
        });

        emit OracleConfigured(marketId, tier, expiry);
    }

    /**
     * @dev Tier 1: Resolve a market from a Chainlink/Pyth data feed
     */
    function resolveFromFeed(uint256 marketId) external {
        OracleConfig storage config = oracleConfigs[marketId];
        require(!config.resolved, "Already resolved");
        require(config.tier == OracleTier.Feed, "Not a feed-based market");
        require(block.timestamp >= config.expiry, "Not yet expired");

        (bool success, bytes memory data) = config.feedAddress.staticcall(
            abi.encodeWithSignature("latestAnswer()")
        );
        require(success, "Feed call failed");
        int256 answer = abi.decode(data, (int256));

        bool outcome = _compare(answer, config.comparison, config.threshold);
        config.resolved = true;

        meridianMarket.resolve(marketId, outcome);
        emit MarketResolved(marketId, outcome, OracleTier.Feed);
    }

    /**
     * @dev Tier 2: Admin-verified resolution
     */
    function resolveAdmin(uint256 marketId, bool outcome) external onlyVerifier {
        OracleConfig storage config = oracleConfigs[marketId];
        require(!config.resolved, "Already resolved");
        require(config.tier == OracleTier.Admin, "Not an admin-resolved market");
        require(block.timestamp >= config.expiry, "Not yet expired");

        config.resolved = true;

        meridianMarket.resolve(marketId, outcome);
        emit MarketResolved(marketId, outcome, OracleTier.Admin);
    }

    function setVerifier(address verifier, bool authorized) external onlyOwner {
        verifiers[verifier] = authorized;
        emit VerifierUpdated(verifier, authorized);
    }

    function setMeridianMarket(address _meridianMarket) external onlyOwner {
        meridianMarket = IMeridianMarket(_meridianMarket);
    }

    function _compare(int256 value, ComparisonType comp, int256 threshold) internal pure returns (bool) {
        if (comp == ComparisonType.GreaterThan) return value > threshold;
        if (comp == ComparisonType.LessThan) return value < threshold;
        if (comp == ComparisonType.EqualTo) return value == threshold;
        if (comp == ComparisonType.GreaterThanOrEqual) return value >= threshold;
        if (comp == ComparisonType.LessThanOrEqual) return value <= threshold;
        return false;
    }
}
