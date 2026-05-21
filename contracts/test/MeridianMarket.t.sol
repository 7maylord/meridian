// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console} from "forge-std/Test.sol";
import {MeridianMarket} from "../src/MeridianMarket.sol";
import {ResolutionOracle} from "../src/ResolutionOracle.sol";
import {ERC20} from "openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";

// Mock USDC token for testing
contract MockUSDC is ERC20 {
    constructor() ERC20("Mock USDC", "USDC") {}
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
    function decimals() public pure override returns (uint8) {
        return 6;
    }
}

// Mock Chainlink price feed for testing Tier 1 resolution
contract MockPriceFeed {
    int256 public latestAnswer;
    function setAnswer(int256 _answer) external {
        latestAnswer = _answer;
    }
}

contract MeridianMarketTest is Test {
    MeridianMarket public market;
    ResolutionOracle public oracle;
    MockUSDC public usdc;
    MockPriceFeed public priceFeed;

    address public owner = address(this);
    address public alice = address(0xA11CE);
    address public bob = address(0xB0B);
    address public agent = address(0xA6E47);

    uint256 constant B_PARAM = 100e18; // Liquidity parameter
    uint256 constant ONE_SHARE = 1e18;
    uint256 constant INITIAL_BALANCE = 100_000e6; // 100k USDC

    function setUp() public {
        // Deploy mock USDC
        usdc = new MockUSDC();

        // Deploy MeridianMarket (oracle set later)
        market = new MeridianMarket(address(0));

        // Deploy ResolutionOracle pointing at the market
        oracle = new ResolutionOracle(address(market));

        // Set the oracle on the market
        market.setOracle(address(oracle));

        // Register USDC as collateral
        market.addCollateral(address(usdc), 6);

        // Deploy mock price feed
        priceFeed = new MockPriceFeed();

        // Mint USDC to test users
        usdc.mint(alice, INITIAL_BALANCE);
        usdc.mint(bob, INITIAL_BALANCE);
        usdc.mint(agent, INITIAL_BALANCE);

        // Approve the market contract to spend USDC
        vm.prank(alice);
        usdc.approve(address(market), type(uint256).max);

        vm.prank(bob);
        usdc.approve(address(market), type(uint256).max);

        vm.prank(agent);
        usdc.approve(address(market), type(uint256).max);
    }

    // ─── Market Creation Tests ───

    function test_CreateMarket() public {
        uint256 id = market.createMarket(
            "Will ETH hit 10k?",
            "Based on CoinGecko ETH/USD spot price",
            block.timestamp + 30 days,
            B_PARAM,
            address(usdc)
        );

        assertEq(id, 0);
        assertEq(market.marketCount(), 1);

        (string memory question,,,,,,,,, ) = market.getMarket(0);
        assertEq(question, "Will ETH hit 10k?");
    }

    function test_CreateMultipleMarkets() public {
        market.createMarket("Q1?", "C1", block.timestamp + 30 days, B_PARAM, address(usdc));
        market.createMarket("Q2?", "C2", block.timestamp + 60 days, B_PARAM, address(usdc));
        market.createMarket("Q3?", "C3", block.timestamp + 90 days, B_PARAM, address(usdc));

        assertEq(market.marketCount(), 3);

        (string memory q2,,,,,,,,, ) = market.getMarket(1);
        assertEq(q2, "Q2?");
    }

    function test_RevertCreateMarket_ExpiryInPast() public {
        vm.expectRevert("Expiry must be in the future");
        market.createMarket("Q?", "C", block.timestamp - 1, B_PARAM, address(usdc));
    }

    function test_RevertCreateMarket_ZeroB() public {
        vm.expectRevert("b must be > 0");
        market.createMarket("Q?", "C", block.timestamp + 30 days, 0, address(usdc));
    }

    function test_RevertCreateMarket_UnsupportedCollateral() public {
        vm.expectRevert("Unsupported collateral");
        market.createMarket("Q?", "C", block.timestamp + 30 days, B_PARAM, address(0xDEAD));
    }

    // ─── Trading Tests ───

    function test_BuyYesShares() public {
        uint256 id = market.createMarket("Q?", "C", block.timestamp + 30 days, B_PARAM, address(usdc));

        uint256 lmsrCost = market.getCost(id, true, 10 * ONE_SHARE);
        assertTrue(lmsrCost > 0, "Cost should be > 0");
        uint256 fee = (lmsrCost * market.builderFeeRate()) / 10_000;

        uint256 aliceBefore = usdc.balanceOf(alice);
        vm.prank(alice);
        market.buy(id, true, 10 * ONE_SHARE);

        uint256 aliceAfter = usdc.balanceOf(alice);
        assertEq(aliceBefore - aliceAfter, lmsrCost + fee, "Alice pays LMSR cost + fee surcharge");

        (uint256 yesShares, uint256 noShares) = market.getUserPosition(id, alice);
        assertEq(yesShares, 10 * ONE_SHARE);
        assertEq(noShares, 0);
    }

    function test_BuyNoShares() public {
        uint256 id = market.createMarket("Q?", "C", block.timestamp + 30 days, B_PARAM, address(usdc));

        vm.prank(bob);
        market.buy(id, false, 5 * ONE_SHARE);

        (uint256 yesShares, uint256 noShares) = market.getUserPosition(id, bob);
        assertEq(yesShares, 0);
        assertEq(noShares, 5 * ONE_SHARE);
    }

    function test_MultipleBuyers() public {
        uint256 id = market.createMarket("Q?", "C", block.timestamp + 30 days, B_PARAM, address(usdc));

        vm.prank(alice);
        market.buy(id, true, 10 * ONE_SHARE);

        vm.prank(bob);
        market.buy(id, false, 10 * ONE_SHARE);

        // Use getUserPosition for individual positions
        (uint256 aliceYes, ) = market.getUserPosition(id, alice);
        (, uint256 bobNo) = market.getUserPosition(id, bob);
        assertEq(aliceYes, 10 * ONE_SHARE);
        assertEq(bobNo, 10 * ONE_SHARE);
    }

    function test_RevertBuy_ResolvedMarket() public {
        uint256 id = market.createMarket("Q?", "C", block.timestamp + 30 days, B_PARAM, address(usdc));

        // Resolve the market
        vm.prank(address(oracle));
        market.resolve(id, true);

        vm.prank(alice);
        vm.expectRevert("Market already resolved");
        market.buy(id, true, ONE_SHARE);
    }

    function test_RevertBuy_NonExistentMarket() public {
        vm.prank(alice);
        vm.expectRevert("Market does not exist");
        market.buy(999, true, ONE_SHARE);
    }

    // ─── Price Tests ───

    function test_InitialPriceIs5050() public {
        uint256 id = market.createMarket("Q?", "C", block.timestamp + 30 days, B_PARAM, address(usdc));

        (uint256 yesPrice, uint256 noPrice) = market.getPrice(id);
        assertEq(yesPrice, 5000, "Initial YES price should be 50%");
        assertEq(noPrice, 5000, "Initial NO price should be 50%");
    }

    function test_PriceMovesAfterBuy() public {
        uint256 id = market.createMarket("Q?", "C", block.timestamp + 30 days, B_PARAM, address(usdc));

        // Buy lots of YES shares to move the price
        vm.prank(alice);
        market.buy(id, true, 50 * ONE_SHARE);

        (uint256 yesPrice, uint256 noPrice) = market.getPrice(id);
        assertTrue(yesPrice > 5000, "YES price should increase after YES buys");
        assertTrue(noPrice < 5000, "NO price should decrease after YES buys");
        assertEq(yesPrice + noPrice, 10000, "Prices must sum to 100%");
    }

    // ─── Resolution & Claiming Tests ───

    function test_ResolveAndClaimYes() public {
        uint256 id = market.createMarket("Q?", "C", block.timestamp + 30 days, B_PARAM, address(usdc));

        vm.prank(alice);
        market.buy(id, true, 10 * ONE_SHARE);

        // Resolve YES
        vm.prank(address(oracle));
        market.resolve(id, true);

        uint256 balBefore = usdc.balanceOf(alice);
        vm.prank(alice);
        market.claim(id);
        uint256 balAfter = usdc.balanceOf(alice);

        uint256 payout = balAfter - balBefore;
        assertTrue(payout > 0, "Alice should receive payout for winning YES shares");
        console.log("Alice payout (USDC):", payout);
    }

    function test_ResolveAndClaimNo() public {
        uint256 id = market.createMarket("Q?", "C", block.timestamp + 30 days, B_PARAM, address(usdc));

        vm.prank(bob);
        market.buy(id, false, 10 * ONE_SHARE);

        // Resolve NO
        vm.prank(address(oracle));
        market.resolve(id, false);

        uint256 balBefore = usdc.balanceOf(bob);
        vm.prank(bob);
        market.claim(id);
        uint256 balAfter = usdc.balanceOf(bob);

        assertTrue(balAfter > balBefore, "Bob should receive payout for winning NO shares");
    }

    function test_LoserCannotClaim() public {
        uint256 id = market.createMarket("Q?", "C", block.timestamp + 30 days, B_PARAM, address(usdc));

        vm.prank(alice);
        market.buy(id, true, 10 * ONE_SHARE);

        // Resolve NO — Alice loses
        vm.prank(address(oracle));
        market.resolve(id, false);

        vm.prank(alice);
        vm.expectRevert("No winning shares");
        market.claim(id);
    }

    function test_CannotClaimBeforeResolution() public {
        uint256 id = market.createMarket("Q?", "C", block.timestamp + 30 days, B_PARAM, address(usdc));

        vm.prank(alice);
        market.buy(id, true, 10 * ONE_SHARE);

        vm.prank(alice);
        vm.expectRevert("Not resolved yet");
        market.claim(id);
    }

    function test_CannotClaimTwice() public {
        uint256 id = market.createMarket("Q?", "C", block.timestamp + 30 days, B_PARAM, address(usdc));

        vm.prank(alice);
        market.buy(id, true, 10 * ONE_SHARE);

        vm.prank(address(oracle));
        market.resolve(id, true);

        vm.prank(alice);
        market.claim(id);

        // Second claim should fail
        vm.prank(alice);
        vm.expectRevert("No winning shares");
        market.claim(id);
    }

    // ─── Oracle Resolution Tests ───

    function test_OnlyOracleCanResolve() public {
        uint256 id = market.createMarket("Q?", "C", block.timestamp + 30 days, B_PARAM, address(usdc));

        vm.prank(alice);
        vm.expectRevert("Only oracle");
        market.resolve(id, true);
    }

    function test_CannotResolveNonExistentMarket() public {
        vm.prank(address(oracle));
        vm.expectRevert("Market does not exist");
        market.resolve(999, true);
    }

    function test_CannotResolveTwice() public {
        uint256 id = market.createMarket("Q?", "C", block.timestamp + 30 days, B_PARAM, address(usdc));

        vm.prank(address(oracle));
        market.resolve(id, true);

        vm.prank(address(oracle));
        vm.expectRevert("Already resolved");
        market.resolve(id, true);
    }

    // ─── Oracle Tier 2 (Admin) Resolution via ResolutionOracle ───

    function test_OracleAdminResolution() public {
        uint256 id = market.createMarket("Q?", "C", block.timestamp + 30 days, B_PARAM, address(usdc));

        // Configure oracle for admin resolution
        oracle.configureOracle(
            id,
            ResolutionOracle.OracleTier.Admin,
            address(0),
            ResolutionOracle.ComparisonType.GreaterThan,
            0,
            block.timestamp + 1 // Expiry in 1 second
        );

        // Fast forward past expiry
        vm.warp(block.timestamp + 2);

        // Admin resolves
        oracle.resolveAdmin(id, true);

        (,,,,,,bool isResolved, bool outcome,, ) = market.getMarket(id);
        assertTrue(isResolved);
        assertTrue(outcome);
    }

    function test_OracleAdminResolution_RevertsBeforeExpiry() public {
        uint256 id = market.createMarket("Q?", "C", block.timestamp + 30 days, B_PARAM, address(usdc));

        oracle.configureOracle(
            id,
            ResolutionOracle.OracleTier.Admin,
            address(0),
            ResolutionOracle.ComparisonType.GreaterThan,
            0,
            block.timestamp + 100
        );

        vm.expectRevert("Not yet expired");
        oracle.resolveAdmin(id, true);
    }

    // ─── Oracle Tier 1 (Feed) Resolution via ResolutionOracle ───

    function test_OracleFeedResolution_GreaterThan() public {
        uint256 id = market.createMarket("Q?", "C", block.timestamp + 30 days, B_PARAM, address(usdc));

        // Set price feed answer above threshold
        priceFeed.setAnswer(15000e8); // $15,000

        oracle.configureOracle(
            id,
            ResolutionOracle.OracleTier.Feed,
            address(priceFeed),
            ResolutionOracle.ComparisonType.GreaterThan,
            10000e8, // threshold: $10,000
            block.timestamp + 1
        );

        vm.warp(block.timestamp + 2);
        oracle.resolveFromFeed(id);

        (,,,,,,bool isResolved, bool outcome,, ) = market.getMarket(id);
        assertTrue(isResolved);
        assertTrue(outcome, "Price 15000 > 10000 should resolve YES");
    }

    function test_OracleFeedResolution_LessThan() public {
        uint256 id = market.createMarket("Q?", "C", block.timestamp + 30 days, B_PARAM, address(usdc));

        priceFeed.setAnswer(8000e8); // $8,000

        oracle.configureOracle(
            id,
            ResolutionOracle.OracleTier.Feed,
            address(priceFeed),
            ResolutionOracle.ComparisonType.GreaterThan,
            10000e8,
            block.timestamp + 1
        );

        vm.warp(block.timestamp + 2);
        oracle.resolveFromFeed(id);

        (,,,,,,bool isResolved, bool outcome,, ) = market.getMarket(id);
        assertTrue(isResolved);
        assertFalse(outcome, "Price 8000 < 10000 should resolve NO");
    }

    // ─── Collateral Admin Tests ───

    function test_AddAndRemoveCollateral() public {
        address fakeToken = address(0x1234);
        market.addCollateral(fakeToken, 18);
        assertTrue(market.supportedCollateral(fakeToken));

        market.removeCollateral(fakeToken);
        assertFalse(market.supportedCollateral(fakeToken));
    }

    function test_OnlyOwnerCanAddCollateral() public {
        vm.prank(alice);
        vm.expectRevert();
        market.addCollateral(address(0x1234), 18);
    }

    // ─── Full End-to-End Flow ───

    function test_EndToEnd_AliceWins() public {
        // 1. Create market
        uint256 id = market.createMarket(
            "Will BTC hit 100k by EOY 2025?",
            "CoinGecko BTC/USD >= 100000",
            block.timestamp + 365 days,
            B_PARAM,
            address(usdc)
        );

        // 2. Alice buys YES, Bob buys NO
        vm.prank(alice);
        market.buy(id, true, 20 * ONE_SHARE);

        vm.prank(bob);
        market.buy(id, false, 15 * ONE_SHARE);

        // 3. Check prices moved
        (uint256 yesPrice, uint256 noPrice) = market.getPrice(id);
        console.log("YES price (bps):", yesPrice);
        console.log("NO price (bps):", noPrice);

        // 4. Configure and execute admin resolution (YES wins)
        oracle.configureOracle(
            id,
            ResolutionOracle.OracleTier.Admin,
            address(0),
            ResolutionOracle.ComparisonType.GreaterThan,
            0,
            block.timestamp + 1
        );
        vm.warp(block.timestamp + 2);
        oracle.resolveAdmin(id, true);

        // 5. Alice claims, Bob cannot
        uint256 aliceBefore = usdc.balanceOf(alice);
        vm.prank(alice);
        market.claim(id);
        uint256 alicePayout = usdc.balanceOf(alice) - aliceBefore;

        console.log("Alice payout (USDC):", alicePayout);
        assertTrue(alicePayout > 0, "Alice should profit");

        vm.prank(bob);
        vm.expectRevert("No winning shares");
        market.claim(id);
    }

    // ─── Builder Fee Tests ───

    function test_BuilderFeeCollectedOnBuy() public {
        address collector = address(0xFEE);
        market.setFeeCollector(collector);

        uint256 id = market.createMarket("Q?", "C", block.timestamp + 30 days, B_PARAM, address(usdc));
        uint256 grossCost = market.getCost(id, true, 10 * ONE_SHARE);
        uint256 expectedFee = (grossCost * 50) / 10_000; // 0.5%

        uint256 collectorBefore = usdc.balanceOf(collector);
        vm.prank(alice);
        market.buy(id, true, 10 * ONE_SHARE);

        uint256 collectorAfter = usdc.balanceOf(collector);
        assertEq(collectorAfter - collectorBefore, expectedFee, "Fee collector should receive 0.5% fee");
    }

    function test_TotalCollateralEqualsLmsrCost() public {
        address collector = address(0xFEE);
        market.setFeeCollector(collector);

        uint256 id = market.createMarket("Q?", "C", block.timestamp + 30 days, B_PARAM, address(usdc));
        uint256 lmsrCost = market.getCost(id, true, 10 * ONE_SHARE);

        vm.prank(alice);
        market.buy(id, true, 10 * ONE_SHARE);

        (,,,,,,,,, uint256 totalCollateral) = market.getMarket(id);
        // Fee is a surcharge paid directly to collector; pool gets the full LMSR cost
        assertEq(totalCollateral, lmsrCost, "totalCollateral equals LMSR cost (fee is a separate surcharge)");
    }

    function test_SetBuilderFeeRateRevertsAbove500Bps() public {
        vm.expectRevert("Max 5%");
        market.setBuilderFeeRate(501);
    }

    function test_OnlyOwnerCanSetFeeCollector() public {
        vm.prank(alice);
        vm.expectRevert();
        market.setFeeCollector(alice);
    }

    function test_ZeroFeeWhenNoCollector() public {
        // feeCollector is set to address(0) by default in this test (no setFeeCollector call)
        // Deploy a fresh market instance with address(0) as initial fee collector
        MeridianMarket freshMarket = new MeridianMarket(address(0));
        freshMarket.setOracle(address(oracle));
        freshMarket.addCollateral(address(usdc), 6);

        // feeCollector defaults to msg.sender (owner) in constructor, not address(0)
        // Set it explicitly to address(0)
        freshMarket.setFeeCollector(address(0));

        uint256 id = freshMarket.createMarket("Q?", "C", block.timestamp + 30 days, B_PARAM, address(usdc));
        uint256 grossCost = freshMarket.getCost(id, true, 10 * ONE_SHARE);

        vm.prank(alice);
        usdc.approve(address(freshMarket), type(uint256).max);

        uint256 aliceBefore = usdc.balanceOf(alice);
        vm.prank(alice);
        freshMarket.buy(id, true, 10 * ONE_SHARE);

        // Alice still pays grossCost; fee goes nowhere (feeCollector == address(0))
        assertEq(aliceBefore - usdc.balanceOf(alice), grossCost, "Alice pays full cost when no collector");
    }

    // ─── Sell Tests ───

    function test_SellSharesReturnsFunds() public {
        uint256 id = market.createMarket("Q?", "C", block.timestamp + 30 days, B_PARAM, address(usdc));

        vm.prank(alice);
        market.buy(id, true, 20 * ONE_SHARE);

        uint256 aliceMid = usdc.balanceOf(alice);

        // Sell half back
        vm.prank(alice);
        market.sell(id, true, 10 * ONE_SHARE);

        uint256 aliceAfter = usdc.balanceOf(alice);
        assertTrue(aliceAfter > aliceMid, "Alice should receive USDC on sell");

        (uint256 yesShares,) = market.getUserPosition(id, alice);
        assertEq(yesShares, 10 * ONE_SHARE, "Alice should have 10 shares remaining");
    }

    function test_SellReducesQYes() public {
        uint256 id = market.createMarket("Q?", "C", block.timestamp + 30 days, B_PARAM, address(usdc));

        vm.prank(alice);
        market.buy(id, true, 20 * ONE_SHARE);

        // getMarket returns: question, criteria, collateral, qYes, qNo, expiry, isResolved, outcome, creator, totalCollateral
        (,,, uint256 qYesBefore,,,,,, ) = market.getMarket(id);

        vm.prank(alice);
        market.sell(id, true, 10 * ONE_SHARE);

        (,,, uint256 qYesAfter,,,,,, ) = market.getMarket(id);
        assertEq(qYesBefore - qYesAfter, 10 * ONE_SHARE, "qYes must decrease by sold shares");
    }

    function test_SellNoFee() public {
        address collector = address(0xFEE);
        market.setFeeCollector(collector);

        uint256 id = market.createMarket("Q?", "C", block.timestamp + 30 days, B_PARAM, address(usdc));
        vm.prank(alice);
        market.buy(id, true, 20 * ONE_SHARE);

        uint256 fullRefund = market.getSellRefund(id, true, 10 * ONE_SHARE);

        uint256 collectorBefore = usdc.balanceOf(collector);
        uint256 aliceBefore = usdc.balanceOf(alice);

        vm.prank(alice);
        market.sell(id, true, 10 * ONE_SHARE);

        // Sell has no fee — buyer already paid at entry
        assertEq(usdc.balanceOf(alice) - aliceBefore, fullRefund, "Full LMSR refund on sell (no fee)");
        assertEq(usdc.balanceOf(collector) - collectorBefore, 0, "No sell fee");
    }

    function test_SellRevertsInsufficientShares() public {
        uint256 id = market.createMarket("Q?", "C", block.timestamp + 30 days, B_PARAM, address(usdc));

        vm.prank(alice);
        market.buy(id, true, 5 * ONE_SHARE);

        vm.prank(alice);
        vm.expectRevert("Insufficient shares");
        market.sell(id, true, 10 * ONE_SHARE);
    }

    function test_SellRevertsOnResolvedMarket() public {
        uint256 id = market.createMarket("Q?", "C", block.timestamp + 30 days, B_PARAM, address(usdc));

        vm.prank(alice);
        market.buy(id, true, 10 * ONE_SHARE);

        vm.prank(address(oracle));
        market.resolve(id, true);

        vm.prank(alice);
        vm.expectRevert("Market already resolved");
        market.sell(id, true, 5 * ONE_SHARE);
    }

    function test_SellRevertsAfterExpiry() public {
        uint256 id = market.createMarket("Q?", "C", block.timestamp + 30 days, B_PARAM, address(usdc));

        vm.prank(alice);
        market.buy(id, true, 10 * ONE_SHARE);

        vm.warp(block.timestamp + 31 days);

        vm.prank(alice);
        vm.expectRevert("Market expired");
        market.sell(id, true, 5 * ONE_SHARE);
    }

    function test_BuyRevertsAfterExpiry() public {
        uint256 id = market.createMarket("Q?", "C", block.timestamp + 30 days, B_PARAM, address(usdc));

        vm.warp(block.timestamp + 31 days);

        vm.prank(alice);
        vm.expectRevert("Market expired");
        market.buy(id, true, 10 * ONE_SHARE);
    }

    function test_PriceMovesAfterSell() public {
        uint256 id = market.createMarket("Q?", "C", block.timestamp + 30 days, B_PARAM, address(usdc));

        vm.prank(alice);
        market.buy(id, true, 50 * ONE_SHARE);

        (uint256 yesPriceHigh, ) = market.getPrice(id);

        vm.prank(alice);
        market.sell(id, true, 40 * ONE_SHARE);

        (uint256 yesPriceLow, ) = market.getPrice(id);
        assertTrue(yesPriceLow < yesPriceHigh, "YES price should drop after selling YES shares");
    }

    // ─── Claim Guard Tests ───

    function test_ClaimRevertsWhenNoWinningShares() public {
        uint256 id = market.createMarket("Q?", "C", block.timestamp + 30 days, B_PARAM, address(usdc));

        vm.prank(alice);
        market.buy(id, true, 10 * ONE_SHARE);

        // Sell all shares — alice holds nothing
        vm.prank(alice);
        market.sell(id, true, 10 * ONE_SHARE);

        vm.prank(address(oracle));
        market.resolve(id, true);

        // Alice has 0 shares, so claim reverts
        vm.prank(alice);
        vm.expectRevert("No winning shares");
        market.claim(id);
    }

    function test_FullFlowWithFeesAndSell() public {
        address collector = address(0xFEE);
        market.setFeeCollector(collector);

        // Capture collector balance BEFORE any trades
        uint256 collectorStart = usdc.balanceOf(collector);

        uint256 id = market.createMarket("Full flow?", "Resolves YES if true", block.timestamp + 30 days, B_PARAM, address(usdc));

        // Agent buys YES (directional bet)
        vm.prank(agent);
        market.buy(id, true, 30 * ONE_SHARE);

        // Alice buys YES
        vm.prank(alice);
        market.buy(id, true, 20 * ONE_SHARE);

        // Bob buys NO (opposing bet)
        vm.prank(bob);
        market.buy(id, false, 25 * ONE_SHARE);

        // Alice sells half her YES shares early
        vm.prank(alice);
        market.sell(id, true, 10 * ONE_SHARE);

        // Fees should already be in collector from 4 trades above
        assertTrue(usdc.balanceOf(collector) > collectorStart, "Fees collected from trades");

        // Resolve YES
        vm.prank(address(oracle));
        market.resolve(id, true);

        uint256 agentBefore = usdc.balanceOf(agent);
        uint256 aliceBefore = usdc.balanceOf(alice);

        vm.prank(agent);
        market.claim(id);

        vm.prank(alice);
        market.claim(id);

        uint256 agentPayout = usdc.balanceOf(agent) - agentBefore;
        uint256 alicePayout = usdc.balanceOf(alice) - aliceBefore;

        assertTrue(agentPayout > 0, "Agent profits from claim");
        assertTrue(alicePayout > 0, "Alice profits from claim");

        // Bob cannot claim (lost)
        vm.prank(bob);
        vm.expectRevert("No winning shares");
        market.claim(id);
    }

    function test_EndToEnd_MultipleMarkets() public {
        // Create 3 markets
        uint256 id0 = market.createMarket("Market 0?", "C0", block.timestamp + 30 days, B_PARAM, address(usdc));
        uint256 id1 = market.createMarket("Market 1?", "C1", block.timestamp + 60 days, B_PARAM, address(usdc));
        uint256 id2 = market.createMarket("Market 2?", "C2", block.timestamp + 90 days, B_PARAM, address(usdc));

        assertEq(id0, 0);
        assertEq(id1, 1);
        assertEq(id2, 2);

        // Trade in each
        vm.prank(alice);
        market.buy(id0, true, 5 * ONE_SHARE);
        vm.prank(alice);
        market.buy(id1, false, 5 * ONE_SHARE);
        vm.prank(bob);
        market.buy(id2, true, 5 * ONE_SHARE);

        // Verify independent state
        (uint256 a0Yes, ) = market.getUserPosition(id0, alice);
        (, uint256 a1No) = market.getUserPosition(id1, alice);
        (uint256 b2Yes, ) = market.getUserPosition(id2, bob);

        assertEq(a0Yes, 5 * ONE_SHARE);
        assertEq(a1No, 5 * ONE_SHARE);
        assertEq(b2Yes, 5 * ONE_SHARE);

        // Ensure markets are fully independent
        (, uint256 a0No) = market.getUserPosition(id0, alice);
        (uint256 a1Yes, ) = market.getUserPosition(id1, alice);
        assertEq(a0No, 0);
        assertEq(a1Yes, 0);
    }
}
