// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console} from "forge-std/Test.sol";
import {ERC20} from "openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";
import {PredictionMarket, OutcomeToken} from "../src/PredictionMarket.sol";

// Mock ERC20 for collateral
contract MockUSDC is ERC20 {
    constructor() ERC20("Mock USDC", "USDC") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract PredictionMarketTest is Test {
    PredictionMarket public market;
    MockUSDC public usdc;

    address public alice = makeAddr("alice");
    address public bob = makeAddr("bob");

    uint256 constant B_PARAM = 100e18; // 100 USDC liquidity parameter
    uint256 constant INITIAL_BALANCE = 10_000e18;

    function setUp() public {
        usdc = new MockUSDC();
        market = new PredictionMarket("Will CBN cut rates?", address(usdc), B_PARAM);

        // Fund test users
        usdc.mint(alice, INITIAL_BALANCE);
        usdc.mint(bob, INITIAL_BALANCE);

        // Approve market to spend
        vm.prank(alice);
        usdc.approve(address(market), type(uint256).max);

        vm.prank(bob);
        usdc.approve(address(market), type(uint256).max);
    }

    // ─── Constructor ───

    function test_constructor_setsQuestion() public view {
        assertEq(market.question(), "Will CBN cut rates?");
    }

    function test_constructor_setsB() public view {
        assertEq(market.b(), B_PARAM);
    }

    function test_constructor_deploysTokens() public view {
        assertTrue(address(market.yesToken()) != address(0));
        assertTrue(address(market.noToken()) != address(0));
    }

    function test_constructor_initialState() public view {
        assertEq(market.qYes(), 0);
        assertEq(market.qNo(), 0);
        assertFalse(market.isResolved());
    }

    // ─── LMSR Cost Function ───

    function test_costFunction_symmetricAtZero() public view {
        // At qYes=0, qNo=0, cost should be b * ln(2) ≈ 69.31e18
        uint256 cost = market.costFunction(0, 0);
        // b * ln(2) = 100 * 0.6931... = 69.31...
        assertApproxEqRel(cost, 69_314718055994530941, 0.001e18); // 0.1% tolerance
    }

    function test_costFunction_increasesWithShares() public view {
        uint256 cost0 = market.costFunction(0, 0);
        uint256 cost1 = market.costFunction(10e18, 0);
        uint256 cost2 = market.costFunction(50e18, 0);

        assertTrue(cost1 > cost0);
        assertTrue(cost2 > cost1);
    }

    function test_getCost_buyYes() public view {
        uint256 cost = market.getCost(true, 10e18);
        assertTrue(cost > 0);
        // Buying 10 YES shares should cost more than 0 but less than 10 USDC
        assertTrue(cost < 10e18);
    }

    function test_getCost_buyNo() public view {
        uint256 cost = market.getCost(false, 10e18);
        assertTrue(cost > 0);
        assertTrue(cost < 10e18);
    }

    function test_getCost_symmetricForEqualShares() public view {
        uint256 costYes = market.getCost(true, 10e18);
        uint256 costNo = market.getCost(false, 10e18);
        // At equal qYes/qNo (both 0), costs should be identical
        assertEq(costYes, costNo);
    }

    function test_getCost_priceIncreasesWithDemand() public {
        // Buy some YES first to shift the price
        vm.prank(alice);
        market.buy(true, 50e18);

        uint256 costYesBefore = market.getCost(true, 10e18);
        uint256 costNoBefore = market.getCost(false, 10e18);

        // YES should now be more expensive than NO
        assertTrue(costYesBefore > costNoBefore);
    }

    // ─── Buy ───

    function test_buy_yes_mintsTokens() public {
        uint256 shares = 10e18;

        vm.prank(alice);
        market.buy(true, shares);

        assertEq(market.yesToken().balanceOf(alice), shares);
        assertEq(market.qYes(), shares);
    }

    function test_buy_no_mintsTokens() public {
        uint256 shares = 10e18;

        vm.prank(alice);
        market.buy(false, shares);

        assertEq(market.noToken().balanceOf(alice), shares);
        assertEq(market.qNo(), shares);
    }

    function test_buy_transfersCollateral() public {
        uint256 shares = 10e18;
        uint256 balanceBefore = usdc.balanceOf(alice);

        vm.prank(alice);
        market.buy(true, shares);

        uint256 balanceAfter = usdc.balanceOf(alice);
        assertTrue(balanceBefore > balanceAfter);
        assertTrue(usdc.balanceOf(address(market)) > 0);
    }

    function test_buy_emitsEvent() public {
        uint256 shares = 10e18;
        uint256 cost = market.getCost(true, shares);

        vm.expectEmit(true, false, false, true);
        emit PredictionMarket.SharesBought(alice, true, shares, cost);

        vm.prank(alice);
        market.buy(true, shares);
    }

    function test_buy_revertsAfterResolution() public {
        market.resolve(true);

        vm.prank(alice);
        vm.expectRevert("Market already resolved");
        market.buy(true, 10e18);
    }

    function test_buy_multipleBuyers() public {
        vm.prank(alice);
        market.buy(true, 20e18);

        vm.prank(bob);
        market.buy(false, 15e18);

        assertEq(market.qYes(), 20e18);
        assertEq(market.qNo(), 15e18);
        assertEq(market.yesToken().balanceOf(alice), 20e18);
        assertEq(market.noToken().balanceOf(bob), 15e18);
    }

    // ─── Resolve ───

    function test_resolve_setsOutcome() public {
        market.resolve(true);

        assertTrue(market.isResolved());
        assertTrue(market.outcome());
    }

    function test_resolve_emitsEvent() public {
        vm.expectEmit(false, false, false, true);
        emit PredictionMarket.MarketResolved(true);

        market.resolve(true);
    }

    function test_resolve_revertsIfAlreadyResolved() public {
        market.resolve(true);

        vm.expectRevert("Already resolved");
        market.resolve(false);
    }

    // ─── Claim ───

    function test_claim_yesWins() public {
        uint256 shares = 10e18;

        vm.prank(alice);
        market.buy(true, shares);

        // Fund the market so it can pay out
        usdc.mint(address(market), shares);

        market.resolve(true);

        uint256 balanceBefore = usdc.balanceOf(alice);

        vm.prank(alice);
        market.claim();

        assertEq(usdc.balanceOf(alice) - balanceBefore, shares);
        assertEq(market.yesToken().balanceOf(alice), 0);
    }

    function test_claim_noWins() public {
        uint256 shares = 10e18;

        vm.prank(bob);
        market.buy(false, shares);

        usdc.mint(address(market), shares);

        market.resolve(false);

        uint256 balanceBefore = usdc.balanceOf(bob);

        vm.prank(bob);
        market.claim();

        assertEq(usdc.balanceOf(bob) - balanceBefore, shares);
        assertEq(market.noToken().balanceOf(bob), 0);
    }

    function test_claim_revertsIfNotResolved() public {
        vm.prank(alice);
        market.buy(true, 10e18);

        vm.prank(alice);
        vm.expectRevert("Not resolved yet");
        market.claim();
    }

    function test_claim_revertsIfNoWinningShares() public {
        vm.prank(alice);
        market.buy(true, 10e18);

        market.resolve(false); // NO wins, alice holds YES

        vm.prank(alice);
        vm.expectRevert("No winning shares");
        market.claim();
    }
}
