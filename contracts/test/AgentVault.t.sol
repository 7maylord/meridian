// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";
import {AgentVault} from "../src/AgentVault.sol";

contract MockUSDC3 is ERC20 {
    constructor() ERC20("Mock USDC", "USDC") {}
    function mint(address to, uint256 amount) external { _mint(to, amount); }
}

contract AgentVaultTest is Test {
    AgentVault public vault;
    MockUSDC3 public usdc;
    address public owner = makeAddr("owner");
    address public agent = makeAddr("agent");
    address public attacker = makeAddr("attacker");
    address public market1 = makeAddr("market1");
    address public market2 = makeAddr("market2");
    uint256 constant VAULT_BALANCE = 10_000e18;

    function setUp() public {
        usdc = new MockUSDC3();
        vm.prank(owner);
        vault = new AgentVault(address(usdc), agent);
        usdc.mint(address(vault), VAULT_BALANCE);
    }

    function test_constructor() public view {
        assertEq(address(vault.collateralToken()), address(usdc));
        assertEq(vault.agent(), agent);
        assertEq(vault.owner(), owner);
    }

    function test_deployCapital() public {
        vm.prank(agent);
        vault.deployCapital(market1, 1000e18, true);
        (uint256 amount, bool isYes, bool settled, uint256 payout) = vault.positions(market1);
        assertEq(amount, 1000e18);
        assertTrue(isYes);
        assertFalse(settled);
        assertEq(payout, 0);
        assertEq(vault.totalDeployed(), 1000e18);
        assertEq(usdc.allowance(address(vault), market1), 1000e18);
    }

    function test_deployCapital_revertsIfNotAgent() public {
        vm.prank(attacker);
        vm.expectRevert("Only agent");
        vault.deployCapital(market1, 1000e18, true);
    }

    function test_deployCapital_revertsIfAlreadyDeployed() public {
        vm.prank(agent);
        vault.deployCapital(market1, 1000e18, true);
        vm.prank(agent);
        vm.expectRevert("Already deployed to this market");
        vault.deployCapital(market1, 500e18, false);
    }

    function test_deployCapital_revertsIfInsufficientBalance() public {
        vm.prank(agent);
        vm.expectRevert("Insufficient vault balance");
        vault.deployCapital(market1, VAULT_BALANCE + 1, true);
    }

    function test_recordOutcome_win() public {
        vm.startPrank(agent);
        vault.deployCapital(market1, 1000e18, true);
        vault.recordOutcome(market1, true, 1500e18);
        vm.stopPrank();
        (, , bool settled, uint256 payout) = vault.positions(market1);
        assertTrue(settled);
        assertEq(payout, 1500e18);
        assertEq(vault.marketsWon(), 1);
        assertEq(vault.totalReturned(), 1500e18);
    }

    function test_recordOutcome_loss() public {
        vm.startPrank(agent);
        vault.deployCapital(market1, 1000e18, true);
        vault.recordOutcome(market1, false, 0);
        vm.stopPrank();
        assertEq(vault.marketsLost(), 1);
        assertEq(vault.totalReturned(), 0);
    }

    function test_recordOutcome_revertsIfNoPosition() public {
        vm.prank(agent);
        vm.expectRevert("No position in this market");
        vault.recordOutcome(market1, true, 1000e18);
    }

    function test_recordOutcome_revertsIfAlreadySettled() public {
        vm.startPrank(agent);
        vault.deployCapital(market1, 1000e18, true);
        vault.recordOutcome(market1, true, 1500e18);
        vm.expectRevert("Already settled");
        vault.recordOutcome(market1, false, 0);
        vm.stopPrank();
    }

    function test_getCalibrationScore_noMarkets() public view {
        (uint256 winRate, uint256 totalMarkets) = vault.getCalibrationScore();
        assertEq(winRate, 0);
        assertEq(totalMarkets, 0);
    }

    function test_getCalibrationScore_mixed() public {
        vm.startPrank(agent);
        vault.deployCapital(market1, 1000e18, true);
        vault.recordOutcome(market1, true, 1500e18);
        vault.deployCapital(market2, 1000e18, false);
        vault.recordOutcome(market2, false, 0);
        vm.stopPrank();
        (uint256 winRate, uint256 totalMarkets) = vault.getCalibrationScore();
        assertEq(winRate, 5000);
        assertEq(totalMarkets, 2);
    }

    function test_getAvailableCapital() public view {
        assertEq(vault.getAvailableCapital(), VAULT_BALANCE);
    }

    function test_setAgent() public {
        address newAgent = makeAddr("newAgent");
        vm.prank(owner);
        vault.setAgent(newAgent);
        assertEq(vault.agent(), newAgent);
    }

    function test_setAgent_revertsIfNotOwner() public {
        vm.prank(attacker);
        vm.expectRevert();
        vault.setAgent(attacker);
    }

    function test_usycStubs_emitEvents() public {
        vm.startPrank(agent);
        vm.expectEmit(false, false, false, true);
        emit AgentVault.DepositedToUSYC(1000e18);
        vault.depositToUSYC(1000e18);

        vm.expectEmit(false, false, false, true);
        emit AgentVault.RedeemedFromUSYC(500e18);
        vault.redeemFromUSYC(500e18);
        vm.stopPrank();
    }

    function test_usycStubs_revertIfNotAgent() public {
        vm.prank(attacker);
        vm.expectRevert("Only agent");
        vault.depositToUSYC(1000e18);
    }
}
