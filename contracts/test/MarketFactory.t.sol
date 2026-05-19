// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";
import {MarketFactory} from "../src/MarketFactory.sol";
import {PredictionMarket} from "../src/PredictionMarket.sol";

contract MockUSDC2 is ERC20 {
    constructor() ERC20("Mock USDC", "USDC") {}
}

contract MarketFactoryTest is Test {
    MarketFactory public factory;
    MockUSDC2 public usdc;

    address public owner = makeAddr("owner");
    address public oracle = makeAddr("oracle");
    address public alice = makeAddr("alice");

    function setUp() public {
        usdc = new MockUSDC2();

        vm.prank(owner);
        factory = new MarketFactory(address(usdc), oracle);
    }

    // ─── Constructor ───

    function test_constructor_setsCollateralToken() public view {
        assertEq(factory.collateralToken(), address(usdc));
    }

    function test_constructor_setsOracle() public view {
        assertEq(factory.oracle(), oracle);
    }

    function test_constructor_setsOwner() public view {
        assertEq(factory.owner(), owner);
    }

    // ─── Create Market ───

    function test_createMarket_deploysMarket() public {
        address marketAddr = factory.createMarket(
            "Will CBN cut rates?",
            "CBN announces rate decision by June 2026",
            block.timestamp + 30 days,
            100e18
        );

        assertTrue(marketAddr != address(0));
        assertTrue(factory.isMarket(marketAddr));
    }

    function test_createMarket_incrementsCount() public {
        factory.createMarket("Q1", "criteria", block.timestamp + 1 days, 100e18);
        factory.createMarket("Q2", "criteria", block.timestamp + 2 days, 200e18);

        assertEq(factory.getMarketCount(), 2);
    }

    function test_createMarket_storesInArray() public {
        address m1 = factory.createMarket("Q1", "criteria", block.timestamp + 1 days, 100e18);
        address m2 = factory.createMarket("Q2", "criteria", block.timestamp + 2 days, 200e18);

        address[] memory markets = factory.getMarkets();
        assertEq(markets.length, 2);
        assertEq(markets[0], m1);
        assertEq(markets[1], m2);
    }

    function test_createMarket_setsQuestion() public {
        address marketAddr = factory.createMarket(
            "Will BRL weaken?",
            "criteria",
            block.timestamp + 7 days,
            100e18
        );

        PredictionMarket market = PredictionMarket(marketAddr);
        assertEq(market.question(), "Will BRL weaken?");
    }

    function test_createMarket_emitsEvent() public {
        vm.expectEmit(false, false, false, false);
        emit MarketFactory.MarketCreated(
            address(0), "Q1", "criteria", block.timestamp + 1 days, 100e18, address(this)
        );

        factory.createMarket("Q1", "criteria", block.timestamp + 1 days, 100e18);
    }

    function test_createMarket_revertsIfExpiryInPast() public {
        vm.expectRevert("Expiry must be in the future");
        factory.createMarket("Q1", "criteria", block.timestamp - 1, 100e18);
    }

    function test_createMarket_revertsIfBIsZero() public {
        vm.expectRevert("b must be > 0");
        factory.createMarket("Q1", "criteria", block.timestamp + 1 days, 0);
    }

    // ─── Builder Fee ───

    function test_setBuilderFeeRate_onlyOwner() public {
        vm.prank(alice);
        vm.expectRevert();
        factory.setBuilderFeeRate(50);
    }

    function test_setBuilderFeeRate_setsRate() public {
        vm.prank(owner);
        factory.setBuilderFeeRate(50); // 0.5%

        assertEq(factory.builderFeeRate(), 50);
    }

    function test_setBuilderFeeRate_revertsIfTooHigh() public {
        vm.prank(owner);
        vm.expectRevert("Fee too high");
        factory.setBuilderFeeRate(1001); // > 10%
    }

    // ─── Oracle ───

    function test_setOracle_onlyOwner() public {
        vm.prank(alice);
        vm.expectRevert();
        factory.setOracle(address(0x123));
    }

    function test_setOracle_updatesOracle() public {
        address newOracle = makeAddr("newOracle");

        vm.prank(owner);
        factory.setOracle(newOracle);

        assertEq(factory.oracle(), newOracle);
    }
}
