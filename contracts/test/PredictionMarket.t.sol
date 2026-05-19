// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";
import {PredictionMarket} from "../src/PredictionMarket.sol";

// Mock USDC with 6 decimals (matching Arc's native USDC ERC-20 interface)
contract MockUSDC6 is ERC20 {
    constructor() ERC20("Mock USDC", "USDC") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract PredictionMarketTest is Test {
    PredictionMarket public market;
    MockUSDC6 public usdc;

    address public oracleAddr = makeAddr("oracle");
    address public alice = makeAddr("alice");
    address public bob = makeAddr("bob");

    uint8 constant COLLATERAL_DECIMALS = 6;
    uint256 constant B_PARAM = 100e18; // 100 USDC in internal 18-decimal scale
    uint256 constant INITIAL_BALANCE = 10_000e6; // 10,000 USDC (6 decimals)

    function setUp() public {
        usdc = new MockUSDC6();
        market = new PredictionMarket(
            "Will CBN cut rates?", address(usdc), COLLATERAL_DECIMALS, B_PARAM, oracleAddr
        );

        usdc.mint(alice, INITIAL_BALANCE);
        usdc.mint(bob, INITIAL_BALANCE);

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

    function test_constructor_setsDecimals() public view {
        assertEq(market.collateralDecimals(), 6);
    }

    function test_constructor_setsOracle() public view {
        assertEq(market.oracle(), oracleAddr);
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

    // ─── LMSR Cost Function (internal 18-decimal) ───

    function test_costFunction_symmetricAtZero() public view {
        uint256 cost = market.costFunction(0, 0);
        // b * ln(2) = 100e18 * 0.6931... ≈ 69.31e18
        assertApproxEqRel(cost, 69_314718055994530941, 0.001e18);
    }

    function test_costFunction_increasesWithShares() public view {
        uint256 cost0 = market.costFunction(0, 0);
        uint256 cost1 = market.costFunction(10e18, 0);
        uint256 cost2 = market.costFunction(50e18, 0);
        assertTrue(cost1 > cost0);
        assertTrue(cost2 > cost1);
    }

    // ─── Decimal Scaling ───

    function test_getCost_returns6DecimalValue() public view {
        // Internal cost for 10 shares (18-decimal) scaled down to 6 decimals
        uint256 costInternal = market.getCostInternal(true, 10e18);
        uint256 costCollateral = market.getCost(true, 10e18);

        // costCollateral should be costInternal / 1e12
        assertEq(costCollateral, costInternal / 1e12);
        assertTrue(costCollateral > 0);
        assertTrue(costCollateral < 10e6); // Less than 10 USDC (6 decimals)
    }

    function test_getCost_symmetricForEqualShares() public view {
        uint256 costYes = market.getCost(true, 10e18);
        uint256 costNo = market.getCost(false, 10e18);
        assertEq(costYes, costNo);
    }

    function test_getCost_priceIncreasesWithDemand() public {
        // Buy some YES first
        vm.prank(alice);
        market.buy(true, 50e18);

        uint256 costYes = market.getCost(true, 10e18);
        uint256 costNo = market.getCost(false, 10e18);

        // YES should now be more expensive than NO
        assertTrue(costYes > costNo);
    }

    // ─── Buy ───

    function test_buy_yes_mintsTokens() public {
        uint256 shares = 10e18; // 18-decimal internal shares

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

    function test_buy_transfers6DecimalCollateral() public {
        uint256 shares = 10e18;
        uint256 expectedCost = market.getCost(true, shares); // 6-decimal cost
        uint256 balanceBefore = usdc.balanceOf(alice);

        vm.prank(alice);
        market.buy(true, shares);

        uint256 balanceAfter = usdc.balanceOf(alice);
        assertEq(balanceBefore - balanceAfter, expectedCost);
        assertEq(usdc.balanceOf(address(market)), expectedCost);
    }

    function test_buy_revertsAfterResolution() public {
        vm.prank(oracleAddr);
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
    }

    // ─── Resolve ───

    function test_resolve_setsOutcome() public {
        vm.prank(oracleAddr);
        market.resolve(true);
        assertTrue(market.isResolved());
        assertTrue(market.outcome());
    }

    function test_resolve_onlyOracle() public {
        vm.prank(alice);
        vm.expectRevert("Only oracle");
        market.resolve(true);
    }

    function test_resolve_revertsIfAlreadyResolved() public {
        vm.prank(oracleAddr);
        market.resolve(true);
        vm.prank(oracleAddr);
        vm.expectRevert("Already resolved");
        market.resolve(false);
    }

    // ─── Claim ───

    function test_claim_yesWins_pays6Decimals() public {
        uint256 shares = 10e18;
        uint256 expectedPayout = shares / 1e12; // 10e18 → 10e6 (10 USDC)

        vm.prank(alice);
        market.buy(true, shares);

        // Fund the market so it can pay out
        usdc.mint(address(market), expectedPayout);

        vm.prank(oracleAddr);
        market.resolve(true);

        uint256 balanceBefore = usdc.balanceOf(alice);

        vm.prank(alice);
        market.claim();

        assertEq(usdc.balanceOf(alice) - balanceBefore, expectedPayout);
        assertEq(market.yesToken().balanceOf(alice), 0);
    }

    function test_claim_noWins_pays6Decimals() public {
        uint256 shares = 10e18;
        uint256 expectedPayout = shares / 1e12; // 10e6

        vm.prank(bob);
        market.buy(false, shares);

        usdc.mint(address(market), expectedPayout);

        vm.prank(oracleAddr);
        market.resolve(false);

        uint256 balanceBefore = usdc.balanceOf(bob);

        vm.prank(bob);
        market.claim();

        assertEq(usdc.balanceOf(bob) - balanceBefore, expectedPayout);
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

        vm.prank(oracleAddr);
        market.resolve(false);

        vm.prank(alice);
        vm.expectRevert("No winning shares");
        market.claim();
    }

    // ─── 18-Decimal Collateral (e.g. testnet mock) ───

    function test_worksWithEurc6Decimals() public {
        // Simulate EURC with same 6 decimals
        MockUSDC6 eurc = new MockUSDC6();
        PredictionMarket eurcMarket = new PredictionMarket(
            "Will ECB raise rates?", address(eurc), 6, B_PARAM, oracleAddr
        );

        eurc.mint(alice, 10_000e6);
        vm.prank(alice);
        eurc.approve(address(eurcMarket), type(uint256).max);

        vm.prank(alice);
        eurcMarket.buy(true, 10e18);

        assertEq(eurcMarket.yesToken().balanceOf(alice), 10e18);
        assertTrue(eurc.balanceOf(address(eurcMarket)) > 0);
    }
}
