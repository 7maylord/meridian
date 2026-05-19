// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";
import {MarketFactory} from "../src/MarketFactory.sol";
import {PredictionMarket} from "../src/PredictionMarket.sol";

contract MockUSDC_MF is ERC20 {
    constructor() ERC20("Mock USDC", "USDC") {}
    function decimals() public pure override returns (uint8) { return 6; }
}

contract MockEURC_MF is ERC20 {
    constructor() ERC20("Mock EURC", "EURC") {}
    function decimals() public pure override returns (uint8) { return 6; }
}

contract MarketFactoryTest is Test {
    MarketFactory public factory;
    MockUSDC_MF public usdc;
    MockEURC_MF public eurc;

    address public owner = makeAddr("owner");
    address public oracleAddr = makeAddr("oracle");
    address public alice = makeAddr("alice");

    function setUp() public {
        usdc = new MockUSDC_MF();
        eurc = new MockEURC_MF();

        vm.startPrank(owner);
        factory = new MarketFactory(oracleAddr);
        factory.addCollateral(address(usdc), 6);
        factory.addCollateral(address(eurc), 6);
        vm.stopPrank();
    }

    // ─── Constructor ───

    function test_constructor_setsOracle() public view {
        assertEq(factory.oracle(), oracleAddr);
    }

    function test_constructor_setsOwner() public view {
        assertEq(factory.owner(), owner);
    }

    // ─── Collateral Management ───

    function test_addCollateral() public view {
        assertTrue(factory.supportedCollateral(address(usdc)));
        assertTrue(factory.supportedCollateral(address(eurc)));
        assertEq(factory.collateralDecimals(address(usdc)), 6);
        assertEq(factory.collateralDecimals(address(eurc)), 6);
    }

    function test_addCollateral_onlyOwner() public {
        vm.prank(alice);
        vm.expectRevert();
        factory.addCollateral(address(0x123), 18);
    }

    function test_removeCollateral() public {
        vm.prank(owner);
        factory.removeCollateral(address(eurc));
        assertFalse(factory.supportedCollateral(address(eurc)));
    }

    // ─── Create Market ───

    function test_createMarket_withUSDC() public {
        address marketAddr = factory.createMarket(
            "Will CBN cut rates?", "CBN announcement", block.timestamp + 30 days, 100e18, address(usdc)
        );

        assertTrue(marketAddr != address(0));
        assertTrue(factory.isMarket(marketAddr));

        PredictionMarket market = PredictionMarket(marketAddr);
        assertEq(market.question(), "Will CBN cut rates?");
        assertEq(market.collateralDecimals(), 6);
        assertEq(address(market.collateralToken()), address(usdc));
        assertEq(market.oracle(), oracleAddr);
    }

    function test_createMarket_withEURC() public {
        address marketAddr = factory.createMarket(
            "Will ECB raise rates?", "ECB announcement", block.timestamp + 14 days, 200e18, address(eurc)
        );

        PredictionMarket market = PredictionMarket(marketAddr);
        assertEq(address(market.collateralToken()), address(eurc));
        assertEq(market.collateralDecimals(), 6);
    }

    function test_createMarket_incrementsCount() public {
        factory.createMarket("Q1", "c", block.timestamp + 1 days, 100e18, address(usdc));
        factory.createMarket("Q2", "c", block.timestamp + 2 days, 200e18, address(eurc));
        assertEq(factory.getMarketCount(), 2);
    }

    function test_createMarket_storesInArray() public {
        address m1 = factory.createMarket("Q1", "c", block.timestamp + 1 days, 100e18, address(usdc));
        address m2 = factory.createMarket("Q2", "c", block.timestamp + 2 days, 200e18, address(eurc));

        address[] memory mkts = factory.getMarkets();
        assertEq(mkts.length, 2);
        assertEq(mkts[0], m1);
        assertEq(mkts[1], m2);
    }

    function test_createMarket_revertsIfExpiryInPast() public {
        vm.expectRevert("Expiry must be in the future");
        factory.createMarket("Q1", "c", block.timestamp - 1, 100e18, address(usdc));
    }

    function test_createMarket_revertsIfBIsZero() public {
        vm.expectRevert("b must be > 0");
        factory.createMarket("Q1", "c", block.timestamp + 1 days, 0, address(usdc));
    }

    function test_createMarket_revertsIfUnsupportedCollateral() public {
        address unsupported = makeAddr("randomToken");
        vm.expectRevert("Unsupported collateral");
        factory.createMarket("Q1", "c", block.timestamp + 1 days, 100e18, unsupported);
    }

    // ─── Builder Fee ───

    function test_setBuilderFeeRate() public {
        vm.prank(owner);
        factory.setBuilderFeeRate(50);
        assertEq(factory.builderFeeRate(), 50);
    }

    function test_setBuilderFeeRate_onlyOwner() public {
        vm.prank(alice);
        vm.expectRevert();
        factory.setBuilderFeeRate(50);
    }

    function test_setBuilderFeeRate_revertsIfTooHigh() public {
        vm.prank(owner);
        vm.expectRevert("Fee too high");
        factory.setBuilderFeeRate(1001);
    }

    // ─── Oracle ───

    function test_setOracle() public {
        address newOracle = makeAddr("newOracle");
        vm.prank(owner);
        factory.setOracle(newOracle);
        assertEq(factory.oracle(), newOracle);
    }

    function test_setOracle_onlyOwner() public {
        vm.prank(alice);
        vm.expectRevert();
        factory.setOracle(address(0x123));
    }
}
