// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";
import {AgentVault, ITeller} from "../src/AgentVault.sol";

contract MockUSDC_AV is ERC20 {
    constructor() ERC20("Mock USDC", "USDC") {}
    function decimals() public pure override returns (uint8) { return 6; }
    function mint(address to, uint256 amount) external { _mint(to, amount); }
}

contract MockUSYC is ERC20 {
    constructor() ERC20("Mock USYC", "USYC") {}
    function decimals() public pure override returns (uint8) { return 6; }
    function mint(address to, uint256 amount) external { _mint(to, amount); }
    function burn(address from, uint256 amount) external { _burn(from, amount); }
}

contract MockTeller is ITeller {
    MockUSDC_AV public usdc;
    MockUSYC public usyc;

    constructor(address _usdc, address _usyc) {
        usdc = MockUSDC_AV(_usdc);
        usyc = MockUSYC(_usyc);
    }

    function deposit(uint256 assets, address receiver) external returns (uint256) {
        usdc.transferFrom(msg.sender, address(this), assets);
        // 1:1 minting for simplicity in tests
        usyc.mint(receiver, assets);
        return assets;
    }

    function redeem(uint256 shares, address receiver, address account) external returns (uint256) {
        usyc.transferFrom(account, address(this), shares);
        usyc.burn(address(this), shares);
        usdc.mint(receiver, shares); // Return USDC
        return shares;
    }
}

contract AgentVaultTest is Test {
    AgentVault public vault;
    MockUSDC_AV public usdc;
    MockUSYC public usyc;
    MockTeller public teller;

    address public owner = makeAddr("owner");
    address public agent = makeAddr("agent");
    address public attacker = makeAddr("attacker");
    address public market1 = makeAddr("market1");
    address public market2 = makeAddr("market2");

    uint256 constant VAULT_BALANCE = 10_000e6; // 10,000 USDC (6 decimals)

    function setUp() public {
        usdc = new MockUSDC_AV();
        usyc = new MockUSYC();
        teller = new MockTeller(address(usdc), address(usyc));

        vm.prank(owner);
        vault = new AgentVault(address(usdc), address(usyc), address(teller), agent);

        usdc.mint(address(vault), VAULT_BALANCE);
    }

    // ─── Constructor ───

    function test_constructor() public view {
        assertEq(address(vault.collateralToken()), address(usdc));
        assertEq(address(vault.usycToken()), address(usyc));
        assertEq(address(vault.teller()), address(teller));
        assertEq(vault.agent(), agent);
        assertEq(vault.owner(), owner);
    }

    // ─── Deploy Capital ───

    function test_deployCapital() public {
        vm.prank(agent);
        vault.deployCapital(market1, 1000e6, true);

        (uint256 amount, bool isYes, bool settled, uint256 payout) = vault.positions(market1);
        assertEq(amount, 1000e6);
        assertTrue(isYes);
        assertFalse(settled);
        assertEq(payout, 0);
        assertEq(vault.totalDeployed(), 1000e6);
        assertEq(usdc.allowance(address(vault), market1), 1000e6);
    }

    function test_deployCapital_revertsIfNotAgent() public {
        vm.prank(attacker);
        vm.expectRevert("Only agent");
        vault.deployCapital(market1, 1000e6, true);
    }

    function test_deployCapital_revertsIfAlreadyDeployed() public {
        vm.prank(agent);
        vault.deployCapital(market1, 1000e6, true);
        vm.prank(agent);
        vm.expectRevert("Already deployed to this market");
        vault.deployCapital(market1, 500e6, false);
    }

    function test_deployCapital_revertsIfInsufficientBalance() public {
        vm.prank(agent);
        vm.expectRevert("Insufficient vault balance");
        vault.deployCapital(market1, VAULT_BALANCE + 1, true);
    }

    // ─── Record Outcome ───

    function test_recordOutcome_win() public {
        vm.startPrank(agent);
        vault.deployCapital(market1, 1000e6, true);
        vault.recordOutcome(market1, true, 1500e6);
        vm.stopPrank();

        (, , bool settled, uint256 payout) = vault.positions(market1);
        assertTrue(settled);
        assertEq(payout, 1500e6);
        assertEq(vault.marketsWon(), 1);
        assertEq(vault.totalReturned(), 1500e6);
    }

    function test_recordOutcome_loss() public {
        vm.startPrank(agent);
        vault.deployCapital(market1, 1000e6, true);
        vault.recordOutcome(market1, false, 0);
        vm.stopPrank();

        assertEq(vault.marketsLost(), 1);
        assertEq(vault.totalReturned(), 0);
    }

    function test_recordOutcome_revertsIfNoPosition() public {
        vm.prank(agent);
        vm.expectRevert("No position in this market");
        vault.recordOutcome(market1, true, 1000e6);
    }

    function test_recordOutcome_revertsIfAlreadySettled() public {
        vm.startPrank(agent);
        vault.deployCapital(market1, 1000e6, true);
        vault.recordOutcome(market1, true, 1500e6);
        vm.expectRevert("Already settled");
        vault.recordOutcome(market1, false, 0);
        vm.stopPrank();
    }

    // ─── Calibration Score ───

    function test_getCalibrationScore_noMarkets() public view {
        (uint256 winRate, uint256 totalMarkets) = vault.getCalibrationScore();
        assertEq(winRate, 0);
        assertEq(totalMarkets, 0);
    }

    function test_getCalibrationScore_mixed() public {
        vm.startPrank(agent);
        vault.deployCapital(market1, 1000e6, true);
        vault.recordOutcome(market1, true, 1500e6);
        vault.deployCapital(market2, 1000e6, false);
        vault.recordOutcome(market2, false, 0);
        vm.stopPrank();

        (uint256 winRate, uint256 totalMarkets) = vault.getCalibrationScore();
        assertEq(winRate, 5000); // 50%
        assertEq(totalMarkets, 2);
    }

    // ─── Available Capital ───

    function test_getAvailableCapital() public view {
        assertEq(vault.getAvailableCapital(), VAULT_BALANCE);
    }

    // ─── USYC Integration ───

    function test_depositToUsyc() public {
        uint256 depositAmount = 5000e6; // 5,000 USDC

        vm.prank(agent);
        vault.depositToUsyc(depositAmount);

        // USDC should have decreased
        assertEq(usdc.balanceOf(address(vault)), VAULT_BALANCE - depositAmount);
        // USYC should have increased (1:1 in mock)
        assertEq(usyc.balanceOf(address(vault)), depositAmount);
    }

    function test_depositToUsyc_emitsEvent() public {
        vm.expectEmit(false, false, false, true);
        emit AgentVault.DepositedToUsyc(5000e6, 5000e6);

        vm.prank(agent);
        vault.depositToUsyc(5000e6);
    }

    function test_depositToUsyc_revertsIfInsufficientUSDC() public {
        vm.prank(agent);
        vm.expectRevert("Insufficient USDC");
        vault.depositToUsyc(VAULT_BALANCE + 1);
    }

    function test_depositToUsyc_revertsIfNotAgent() public {
        vm.prank(attacker);
        vm.expectRevert("Only agent");
        vault.depositToUsyc(1000e6);
    }

    function test_redeemFromUsyc() public {
        // First deposit
        vm.prank(agent);
        vault.depositToUsyc(5000e6);

        uint256 usdcBefore = usdc.balanceOf(address(vault));

        // Then redeem
        vm.prank(agent);
        vault.redeemFromUsyc(3000e6);

        assertEq(usdc.balanceOf(address(vault)), usdcBefore + 3000e6);
        assertEq(usyc.balanceOf(address(vault)), 2000e6); // 5000 - 3000
    }

    function test_redeemFromUsyc_emitsEvent() public {
        vm.prank(agent);
        vault.depositToUsyc(5000e6);

        vm.expectEmit(false, false, false, true);
        emit AgentVault.RedeemedFromUsyc(3000e6, 3000e6);

        vm.prank(agent);
        vault.redeemFromUsyc(3000e6);
    }

    function test_redeemFromUsyc_revertsIfInsufficientUSYC() public {
        vm.prank(agent);
        vm.expectRevert("Insufficient USYC");
        vault.redeemFromUsyc(1000e6);
    }

    function test_redeemFromUsyc_revertsIfNotAgent() public {
        vm.prank(attacker);
        vm.expectRevert("Only agent");
        vault.redeemFromUsyc(1000e6);
    }

    function test_depositThenDeployCapital() public {
        // Deposit 8k to USYC, keeping 2k liquid
        vm.prank(agent);
        vault.depositToUsyc(8000e6);

        assertEq(vault.getAvailableCapital(), 2000e6);
        assertEq(vault.getUsycBalance(), 8000e6);

        // Deploy 1k from liquid USDC (approves market, USDC stays until market pulls)
        vm.prank(agent);
        vault.deployCapital(market1, 1000e6, true);

        // USDC is still in vault (approved, not yet pulled by market)
        assertEq(vault.getAvailableCapital(), 2000e6);

        // Need more capital? Redeem from USYC
        vm.prank(agent);
        vault.redeemFromUsyc(3000e6);

        assertEq(vault.getAvailableCapital(), 5000e6); // 2k existing + 3k redeemed
        assertEq(vault.getUsycBalance(), 5000e6);
    }

    // ─── Access Control ───

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
}
