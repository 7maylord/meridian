// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";
import {ResolutionOracle} from "../src/ResolutionOracle.sol";
import {PredictionMarket} from "../src/PredictionMarket.sol";

// Mock Chainlink-style price feed
contract MockPriceFeed {
    int256 public price;
    function setPrice(int256 _price) external { price = _price; }
    function latestAnswer() external view returns (int256) { return price; }
}

contract MockUSDC4 is ERC20 {
    constructor() ERC20("Mock USDC", "USDC") {}
}

contract ResolutionOracleTest is Test {
    ResolutionOracle public oracle;
    MockPriceFeed public feed;
    MockUSDC4 public usdc;
    PredictionMarket public market;

    address public owner = makeAddr("owner");
    address public verifier = makeAddr("verifier");
    address public attacker = makeAddr("attacker");

    function setUp() public {
        usdc = new MockUSDC4();
        feed = new MockPriceFeed();
        feed.setPrice(150000000000); // $1500.00 (8 decimals)

        vm.prank(owner);
        oracle = new ResolutionOracle();

        market = new PredictionMarket("Will ETH > $1500?", address(usdc), 100e18);
    }

    // ─── Constructor ───

    function test_constructor_ownerIsVerifier() public view {
        assertTrue(oracle.verifiers(owner));
    }

    // ─── Configure Oracle ───

    function test_configureOracle_feed() public {
        vm.prank(owner);
        oracle.configureOracle(
            address(market),
            ResolutionOracle.OracleTier.Feed,
            address(feed),
            ResolutionOracle.ComparisonType.GreaterThan,
            150000000000, // $1500
            block.timestamp + 7 days
        );

        (
            ResolutionOracle.OracleTier tier,
            address feedAddr,
            ,
            int256 threshold,
            uint256 expiry,
            bool resolved
        ) = oracle.oracleConfigs(address(market));

        assertEq(uint8(tier), uint8(ResolutionOracle.OracleTier.Feed));
        assertEq(feedAddr, address(feed));
        assertEq(threshold, 150000000000);
        assertTrue(expiry > block.timestamp);
        assertFalse(resolved);
    }

    function test_configureOracle_admin() public {
        vm.prank(owner);
        oracle.configureOracle(
            address(market),
            ResolutionOracle.OracleTier.Admin,
            address(0),
            ResolutionOracle.ComparisonType.GreaterThan,
            0,
            block.timestamp + 7 days
        );

        (ResolutionOracle.OracleTier tier, , , , , ) = oracle.oracleConfigs(address(market));
        assertEq(uint8(tier), uint8(ResolutionOracle.OracleTier.Admin));
    }

    function test_configureOracle_revertsIfNotOwner() public {
        vm.prank(attacker);
        vm.expectRevert();
        oracle.configureOracle(
            address(market), ResolutionOracle.OracleTier.Feed, address(feed),
            ResolutionOracle.ComparisonType.GreaterThan, 0, block.timestamp + 1 days
        );
    }

    function test_configureOracle_revertsIfExpiryInPast() public {
        vm.prank(owner);
        vm.expectRevert("Expiry in past");
        oracle.configureOracle(
            address(market), ResolutionOracle.OracleTier.Feed, address(feed),
            ResolutionOracle.ComparisonType.GreaterThan, 0, block.timestamp - 1
        );
    }

    function test_configureOracle_revertsIfFeedTierNoAddress() public {
        vm.prank(owner);
        vm.expectRevert("Feed address required for Tier 1");
        oracle.configureOracle(
            address(market), ResolutionOracle.OracleTier.Feed, address(0),
            ResolutionOracle.ComparisonType.GreaterThan, 0, block.timestamp + 1 days
        );
    }

    // ─── Resolve From Feed (Tier 1) ───

    function test_resolveFromFeed_yesOutcome() public {
        vm.prank(owner);
        oracle.configureOracle(
            address(market), ResolutionOracle.OracleTier.Feed, address(feed),
            ResolutionOracle.ComparisonType.GreaterThan, 140000000000, // threshold $1400
            block.timestamp + 1 days
        );

        // Feed returns $1500, threshold is $1400, comparison is GreaterThan → YES
        feed.setPrice(150000000000);
        vm.warp(block.timestamp + 1 days);

        oracle.resolveFromFeed(address(market));

        assertTrue(market.isResolved());
        assertTrue(market.outcome());
    }

    function test_resolveFromFeed_noOutcome() public {
        vm.prank(owner);
        oracle.configureOracle(
            address(market), ResolutionOracle.OracleTier.Feed, address(feed),
            ResolutionOracle.ComparisonType.GreaterThan, 160000000000, // threshold $1600
            block.timestamp + 1 days
        );

        feed.setPrice(150000000000); // $1500 < $1600 → NO
        vm.warp(block.timestamp + 1 days);

        oracle.resolveFromFeed(address(market));

        assertTrue(market.isResolved());
        assertFalse(market.outcome());
    }

    function test_resolveFromFeed_revertsBeforeExpiry() public {
        vm.prank(owner);
        oracle.configureOracle(
            address(market), ResolutionOracle.OracleTier.Feed, address(feed),
            ResolutionOracle.ComparisonType.GreaterThan, 0, block.timestamp + 7 days
        );

        vm.expectRevert("Not yet expired");
        oracle.resolveFromFeed(address(market));
    }

    function test_resolveFromFeed_revertsIfAlreadyResolved() public {
        vm.prank(owner);
        oracle.configureOracle(
            address(market), ResolutionOracle.OracleTier.Feed, address(feed),
            ResolutionOracle.ComparisonType.GreaterThan, 0, block.timestamp + 1 days
        );

        vm.warp(block.timestamp + 1 days);
        oracle.resolveFromFeed(address(market));

        vm.expectRevert("Already resolved");
        oracle.resolveFromFeed(address(market));
    }

    // ─── Resolve Admin (Tier 2) ───

    function test_resolveAdmin() public {
        vm.prank(owner);
        oracle.configureOracle(
            address(market), ResolutionOracle.OracleTier.Admin, address(0),
            ResolutionOracle.ComparisonType.GreaterThan, 0, block.timestamp + 1 days
        );

        vm.prank(owner);
        oracle.setVerifier(verifier, true);

        vm.warp(block.timestamp + 1 days);
        vm.prank(verifier);
        oracle.resolveAdmin(address(market), true);

        assertTrue(market.isResolved());
        assertTrue(market.outcome());
    }

    function test_resolveAdmin_revertsIfNotVerifier() public {
        vm.prank(owner);
        oracle.configureOracle(
            address(market), ResolutionOracle.OracleTier.Admin, address(0),
            ResolutionOracle.ComparisonType.GreaterThan, 0, block.timestamp + 1 days
        );

        vm.warp(block.timestamp + 1 days);
        vm.prank(attacker);
        vm.expectRevert("Not a verifier");
        oracle.resolveAdmin(address(market), true);
    }

    function test_resolveAdmin_revertsIfFeedTier() public {
        vm.prank(owner);
        oracle.configureOracle(
            address(market), ResolutionOracle.OracleTier.Feed, address(feed),
            ResolutionOracle.ComparisonType.GreaterThan, 0, block.timestamp + 1 days
        );

        vm.warp(block.timestamp + 1 days);
        vm.prank(owner);
        vm.expectRevert("Not an admin-resolved market");
        oracle.resolveAdmin(address(market), true);
    }

    // ─── Verifier Management ───

    function test_setVerifier() public {
        vm.prank(owner);
        oracle.setVerifier(verifier, true);
        assertTrue(oracle.verifiers(verifier));

        vm.prank(owner);
        oracle.setVerifier(verifier, false);
        assertFalse(oracle.verifiers(verifier));
    }

    function test_setVerifier_revertsIfNotOwner() public {
        vm.prank(attacker);
        vm.expectRevert();
        oracle.setVerifier(verifier, true);
    }
}
