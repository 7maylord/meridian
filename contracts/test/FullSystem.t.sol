// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console} from "forge-std/Test.sol";
import {MeridianMarket} from "../src/MeridianMarket.sol";
import {ResolutionOracle} from "../src/ResolutionOracle.sol";
import {AgentVault} from "../src/AgentVault.sol";
import {ERC20} from "openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";

contract MockUSDC is ERC20 {
    constructor() ERC20("Mock USDC", "USDC") {}
    function mint(address to, uint256 amount) external { _mint(to, amount); }
    function decimals() public pure override returns (uint8) { return 6; }
}

contract MockUSYC is ERC20 {
    constructor() ERC20("Mock USYC", "USYC") {}
    function mint(address to, uint256 amount) external { _mint(to, amount); }
    function decimals() public pure override returns (uint8) { return 6; }
}

contract MockTeller {
    MockUSDC public usdc;
    MockUSYC public usyc;
    constructor(address _usdc, address _usyc) { usdc = MockUSDC(_usdc); usyc = MockUSYC(_usyc); }
    function deposit(uint256 assets, address receiver) external returns (uint256) {
        usdc.transferFrom(msg.sender, address(this), assets);
        usyc.mint(receiver, assets); // 1:1 for testing
        return assets;
    }
    function redeem(uint256 shares, address receiver, address) external returns (uint256) {
        usyc.transferFrom(msg.sender, address(this), shares);
        usdc.mint(receiver, shares);
        return shares;
    }
}

contract MockPriceFeed {
    int256 public latestAnswer;
    function setAnswer(int256 _answer) external { latestAnswer = _answer; }
}

contract FullSystemTest is Test {
    MeridianMarket public market;
    ResolutionOracle public oracle;
    AgentVault public vault;
    MockUSDC public usdc;
    MockUSYC public usyc;
    MockTeller public teller;
    MockPriceFeed public priceFeed;

    address public owner = address(this);
    address public alice = address(0xA11CE);
    address public bob = address(0xB0B);
    address public agentEOA = address(0xA6E47);

    uint256 constant B = 100e18;
    uint256 constant ONE = 1e18;
    uint256 constant FUNDS = 100_000e6;

    function setUp() public {
        usdc = new MockUSDC();
        usyc = new MockUSYC();
        teller = new MockTeller(address(usdc), address(usyc));

        market = new MeridianMarket(address(0));
        oracle = new ResolutionOracle(address(market));
        market.setOracle(address(oracle));
        market.addCollateral(address(usdc), 6);

        vault = new AgentVault(address(usdc), address(usyc), address(teller), agentEOA, address(market));
        priceFeed = new MockPriceFeed();

        // Fund everyone
        usdc.mint(alice, FUNDS);
        usdc.mint(bob, FUNDS);
        usdc.mint(address(vault), FUNDS);

        vm.prank(alice); usdc.approve(address(market), type(uint256).max);
        vm.prank(bob); usdc.approve(address(market), type(uint256).max);
    }

    function _createMarket(string memory q) internal returns (uint256) {
        return market.createMarket(q, "criteria", block.timestamp + 30 days, B, address(usdc));
    }

    // ══════════════════════════════════════════════
    // VAULT <> MARKET INTEGRATION
    // ══════════════════════════════════════════════

    function test_VaultDeployCapital() public {
        uint256 id = _createMarket("Q?");
        uint256 balBefore = usdc.balanceOf(address(vault));

        vm.prank(agentEOA);
        vault.deployCapital(id, true, 10 * ONE);

        uint256 balAfter = usdc.balanceOf(address(vault));
        assertTrue(balBefore > balAfter, "Vault should spend USDC");

        // Verify shares are held by the vault on MeridianMarket
        (uint256 yes, uint256 no) = market.getUserPosition(id, address(vault));
        assertEq(yes, 10 * ONE);
        assertEq(no, 0);
    }

    function test_VaultDeployCapital_NO() public {
        uint256 id = _createMarket("Q?");
        vm.prank(agentEOA);
        vault.deployCapital(id, false, 5 * ONE);

        (uint256 yes, uint256 no) = market.getUserPosition(id, address(vault));
        assertEq(yes, 0);
        assertEq(no, 5 * ONE);
    }

    function test_VaultDeployCapital_RevertDoubleDeployment() public {
        uint256 id = _createMarket("Q?");
        vm.prank(agentEOA);
        vault.deployCapital(id, true, 5 * ONE);

        vm.prank(agentEOA);
        vm.expectRevert("Already deployed to this market");
        vault.deployCapital(id, true, 5 * ONE);
    }

    function test_VaultDeployCapital_RevertInsufficientBalance() public {
        // Deploy a fresh vault with no funds
        AgentVault emptyVault = new AgentVault(address(usdc), address(usyc), address(teller), agentEOA, address(market));
        uint256 id = _createMarket("Q?");

        vm.prank(agentEOA);
        vm.expectRevert("Insufficient vault balance");
        emptyVault.deployCapital(id, true, 10 * ONE);
    }

    function test_VaultDeployCapital_OnlyAgent() public {
        uint256 id = _createMarket("Q?");
        vm.prank(alice);
        vm.expectRevert("Only agent");
        vault.deployCapital(id, true, 5 * ONE);
    }

    function test_VaultClaimWinnings_YesWins() public {
        uint256 id = _createMarket("Q?");

        // Agent buys YES
        vm.prank(agentEOA);
        vault.deployCapital(id, true, 10 * ONE);

        // Alice also buys NO (adds collateral to pool)
        vm.prank(alice);
        market.buy(id, false, 10 * ONE);

        // Resolve YES
        oracle.configureOracle(id, ResolutionOracle.OracleTier.Admin, address(0),
            ResolutionOracle.ComparisonType.GreaterThan, 0, block.timestamp + 1);
        vm.warp(block.timestamp + 2);
        oracle.resolveAdmin(id, true);

        // Vault claims
        uint256 balBefore = usdc.balanceOf(address(vault));
        vm.prank(agentEOA);
        vault.claimWinnings(id);
        uint256 payout = usdc.balanceOf(address(vault)) - balBefore;

        assertTrue(payout > 0, "Vault should receive payout");
        assertEq(vault.marketsWon(), 1);
        assertEq(vault.marketsLost(), 0);
    }

    function test_VaultClaimWinnings_NoWins() public {
        uint256 id = _createMarket("Q?");

        // Agent buys NO
        vm.prank(agentEOA);
        vault.deployCapital(id, false, 10 * ONE);

        // Alice buys YES
        vm.prank(alice);
        market.buy(id, true, 10 * ONE);

        // Resolve NO
        oracle.configureOracle(id, ResolutionOracle.OracleTier.Admin, address(0),
            ResolutionOracle.ComparisonType.GreaterThan, 0, block.timestamp + 1);
        vm.warp(block.timestamp + 2);
        oracle.resolveAdmin(id, false);

        vm.prank(agentEOA);
        vault.claimWinnings(id);

        assertEq(vault.marketsWon(), 1);
    }

    function test_VaultClaimWinnings_AgentLoses() public {
        uint256 id = _createMarket("Q?");

        vm.prank(agentEOA);
        vault.deployCapital(id, true, 10 * ONE);

        // Resolve NO — agent loses
        oracle.configureOracle(id, ResolutionOracle.OracleTier.Admin, address(0),
            ResolutionOracle.ComparisonType.GreaterThan, 0, block.timestamp + 1);
        vm.warp(block.timestamp + 2);
        oracle.resolveAdmin(id, false);

        uint256 balBefore = usdc.balanceOf(address(vault));
        vm.prank(agentEOA);
        vault.claimWinnings(id);

        assertEq(usdc.balanceOf(address(vault)), balBefore, "Loser should get 0");
        assertEq(vault.marketsWon(), 0);
        assertEq(vault.marketsLost(), 1);
    }

    function test_VaultClaimWinnings_RevertNotResolved() public {
        uint256 id = _createMarket("Q?");
        vm.prank(agentEOA);
        vault.deployCapital(id, true, 5 * ONE);

        vm.prank(agentEOA);
        vm.expectRevert("Market not resolved yet");
        vault.claimWinnings(id);
    }

    function test_VaultClaimWinnings_RevertDoubleSettle() public {
        uint256 id = _createMarket("Q?");
        vm.prank(agentEOA);
        vault.deployCapital(id, true, 5 * ONE);

        oracle.configureOracle(id, ResolutionOracle.OracleTier.Admin, address(0),
            ResolutionOracle.ComparisonType.GreaterThan, 0, block.timestamp + 1);
        vm.warp(block.timestamp + 2);
        oracle.resolveAdmin(id, false);

        vm.prank(agentEOA);
        vault.claimWinnings(id);

        vm.prank(agentEOA);
        vm.expectRevert("Already settled");
        vault.claimWinnings(id);
    }

    // ══════════════════════════════════════════════
    // VAULT CALIBRATION / P&L
    // ══════════════════════════════════════════════

    function test_CalibrationScore() public {
        // Create 3 markets, win 2, lose 1
        uint256 id0 = _createMarket("M0?");
        uint256 id1 = _createMarket("M1?");
        uint256 id2 = _createMarket("M2?");

        vm.prank(agentEOA); vault.deployCapital(id0, true, 5 * ONE);
        vm.prank(agentEOA); vault.deployCapital(id1, true, 5 * ONE);
        vm.prank(agentEOA); vault.deployCapital(id2, false, 5 * ONE);

        // Resolve all
        oracle.configureOracle(id0, ResolutionOracle.OracleTier.Admin, address(0), ResolutionOracle.ComparisonType.GreaterThan, 0, block.timestamp + 1);
        oracle.configureOracle(id1, ResolutionOracle.OracleTier.Admin, address(0), ResolutionOracle.ComparisonType.GreaterThan, 0, block.timestamp + 1);
        oracle.configureOracle(id2, ResolutionOracle.OracleTier.Admin, address(0), ResolutionOracle.ComparisonType.GreaterThan, 0, block.timestamp + 1);
        vm.warp(block.timestamp + 2);

        oracle.resolveAdmin(id0, true);   // win
        oracle.resolveAdmin(id1, false);  // lose
        oracle.resolveAdmin(id2, false);  // win (agent bet NO)

        vm.prank(agentEOA); vault.claimWinnings(id0);
        vm.prank(agentEOA); vault.claimWinnings(id1);
        vm.prank(agentEOA); vault.claimWinnings(id2);

        (uint256 winRate, uint256 totalMkts) = vault.getCalibrationScore();
        assertEq(totalMkts, 3);
        assertEq(winRate, 6666); // 66.66% in basis points
    }

    function test_NetPnL() public {
        uint256 id = _createMarket("Q?");
        vm.prank(agentEOA);
        vault.deployCapital(id, true, 10 * ONE);

        // Before resolution, PnL is negative (deployed but no returns)
        assertTrue(vault.getNetPnL() < 0, "PnL should be negative before claiming");
        assertTrue(vault.totalDeployed() > 0);
    }

    // ══════════════════════════════════════════════
    // VAULT USYC YIELD
    // ══════════════════════════════════════════════

    function test_DepositToUsyc() public {
        uint256 amount = 1000e6;
        vm.prank(agentEOA);
        vault.depositToUsyc(amount);

        assertEq(usyc.balanceOf(address(vault)), amount);
        assertEq(vault.getAvailableCapital(), FUNDS - amount);
    }

    function test_RedeemFromUsyc() public {
        vm.prank(agentEOA);
        vault.depositToUsyc(1000e6);

        vm.prank(agentEOA);
        vault.redeemFromUsyc(500e6);

        assertEq(usyc.balanceOf(address(vault)), 500e6);
    }

    function test_UsycRevert_InsufficientUSDC() public {
        vm.prank(agentEOA);
        vm.expectRevert("Insufficient USDC");
        vault.depositToUsyc(FUNDS + 1);
    }

    function test_UsycRevert_InsufficientUSYC() public {
        vm.prank(agentEOA);
        vm.expectRevert("Insufficient USYC");
        vault.redeemFromUsyc(1);
    }

    // ══════════════════════════════════════════════
    // ORACLE <> MARKET INTEGRATION
    // ══════════════════════════════════════════════

    function test_OracleFeed_AllComparisons() public {
        priceFeed.setAnswer(100);

        // LessThan: 100 < 200 = true
        uint256 id0 = _createMarket("LT?");
        oracle.configureOracle(id0, ResolutionOracle.OracleTier.Feed, address(priceFeed), ResolutionOracle.ComparisonType.LessThan, 200, block.timestamp + 1);
        vm.warp(block.timestamp + 2);
        oracle.resolveFromFeed(id0);
        (,,,,,,, bool out0,,) = market.getMarket(id0);
        assertTrue(out0, "100 < 200 should be YES");

        // EqualTo: 100 == 100 = true
        uint256 id1 = _createMarket("EQ?");
        oracle.configureOracle(id1, ResolutionOracle.OracleTier.Feed, address(priceFeed), ResolutionOracle.ComparisonType.EqualTo, 100, block.timestamp + 1);
        vm.warp(block.timestamp + 2);
        oracle.resolveFromFeed(id1);
        (,,,,,,, bool out1,,) = market.getMarket(id1);
        assertTrue(out1, "100 == 100 should be YES");

        // GreaterThanOrEqual: 100 >= 100 = true
        uint256 id2 = _createMarket("GTE?");
        oracle.configureOracle(id2, ResolutionOracle.OracleTier.Feed, address(priceFeed), ResolutionOracle.ComparisonType.GreaterThanOrEqual, 100, block.timestamp + 1);
        vm.warp(block.timestamp + 2);
        oracle.resolveFromFeed(id2);
        (,,,,,,, bool out2,,) = market.getMarket(id2);
        assertTrue(out2, "100 >= 100 should be YES");

        // LessThanOrEqual: 100 <= 50 = false
        uint256 id3 = _createMarket("LTE?");
        oracle.configureOracle(id3, ResolutionOracle.OracleTier.Feed, address(priceFeed), ResolutionOracle.ComparisonType.LessThanOrEqual, 50, block.timestamp + 1);
        vm.warp(block.timestamp + 2);
        oracle.resolveFromFeed(id3);
        (,,,,,,, bool out3,,) = market.getMarket(id3);
        assertFalse(out3, "100 <= 50 should be NO");
    }

    function test_OracleVerifierAccess() public {
        uint256 id = _createMarket("Q?");
        oracle.configureOracle(id, ResolutionOracle.OracleTier.Admin, address(0), ResolutionOracle.ComparisonType.GreaterThan, 0, block.timestamp + 1);
        vm.warp(block.timestamp + 2);

        // Non-verifier cannot resolve
        vm.prank(alice);
        vm.expectRevert("Not a verifier");
        oracle.resolveAdmin(id, true);

        // Add alice as verifier
        oracle.setVerifier(alice, true);
        vm.prank(alice);
        oracle.resolveAdmin(id, true);

        (,,,,,,bool resolved,,, ) = market.getMarket(id);
        assertTrue(resolved);
    }

    function test_OracleCannotResolveFeedAsTierAdmin() public {
        uint256 id = _createMarket("Q?");
        oracle.configureOracle(id, ResolutionOracle.OracleTier.Feed, address(priceFeed), ResolutionOracle.ComparisonType.GreaterThan, 0, block.timestamp + 1);
        vm.warp(block.timestamp + 2);

        vm.expectRevert("Not an admin-resolved market");
        oracle.resolveAdmin(id, true);
    }

    function test_OracleCannotResolveAdminAsFeed() public {
        uint256 id = _createMarket("Q?");
        oracle.configureOracle(id, ResolutionOracle.OracleTier.Admin, address(0), ResolutionOracle.ComparisonType.GreaterThan, 0, block.timestamp + 1);
        vm.warp(block.timestamp + 2);

        vm.expectRevert("Not a feed-based market");
        oracle.resolveFromFeed(id);
    }

    // ══════════════════════════════════════════════
    // FULL END-TO-END: VAULT + ORACLE + MARKET
    // ══════════════════════════════════════════════

    function test_E2E_AgentAndUserTrade_AgentWins() public {
        uint256 id = _createMarket("Will ETH hit 10k?");

        // Agent (vault) buys YES via vault
        vm.prank(agentEOA);
        vault.deployCapital(id, true, 20 * ONE);

        // User buys NO directly
        vm.prank(alice);
        market.buy(id, false, 15 * ONE);

        // Check prices shifted
        (uint256 yP, uint256 nP) = market.getPrice(id);
        assertTrue(yP > 5000, "YES should be > 50%");
        console.log("YES:", yP, "NO:", nP);

        // Resolve YES via admin oracle
        oracle.configureOracle(id, ResolutionOracle.OracleTier.Admin, address(0), ResolutionOracle.ComparisonType.GreaterThan, 0, block.timestamp + 1);
        vm.warp(block.timestamp + 2);
        oracle.resolveAdmin(id, true);

        // Agent claims via vault
        uint256 vaultBefore = usdc.balanceOf(address(vault));
        vm.prank(agentEOA);
        vault.claimWinnings(id);
        uint256 vaultPayout = usdc.balanceOf(address(vault)) - vaultBefore;

        console.log("Vault payout:", vaultPayout);
        assertTrue(vaultPayout > 0);
        assertEq(vault.marketsWon(), 1);

        // Alice (loser) cannot claim
        vm.prank(alice);
        vm.expectRevert("No winning shares");
        market.claim(id);
    }

    function test_E2E_AgentAndUserTrade_AgentLoses() public {
        uint256 id = _createMarket("Will BTC crash?");

        vm.prank(agentEOA);
        vault.deployCapital(id, true, 10 * ONE);

        vm.prank(alice);
        market.buy(id, false, 10 * ONE);

        // Resolve NO — agent loses
        oracle.configureOracle(id, ResolutionOracle.OracleTier.Admin, address(0), ResolutionOracle.ComparisonType.GreaterThan, 0, block.timestamp + 1);
        vm.warp(block.timestamp + 2);
        oracle.resolveAdmin(id, false);

        // Agent claims (gets 0)
        vm.prank(agentEOA);
        vault.claimWinnings(id);
        assertEq(vault.marketsLost(), 1);

        // Alice claims winnings
        uint256 aliceBefore = usdc.balanceOf(alice);
        vm.prank(alice);
        market.claim(id);
        assertTrue(usdc.balanceOf(alice) > aliceBefore);
    }

    function test_E2E_MultipleMarkets_MixedOutcomes() public {
        uint256 id0 = _createMarket("M0?");
        uint256 id1 = _createMarket("M1?");

        // Agent: YES on M0, NO on M1
        vm.prank(agentEOA); vault.deployCapital(id0, true, 5 * ONE);
        vm.prank(agentEOA); vault.deployCapital(id1, false, 5 * ONE);

        // Users trade opposites
        vm.prank(alice); market.buy(id0, false, 5 * ONE);
        vm.prank(bob); market.buy(id1, true, 5 * ONE);

        // Resolve both
        oracle.configureOracle(id0, ResolutionOracle.OracleTier.Admin, address(0), ResolutionOracle.ComparisonType.GreaterThan, 0, block.timestamp + 1);
        oracle.configureOracle(id1, ResolutionOracle.OracleTier.Admin, address(0), ResolutionOracle.ComparisonType.GreaterThan, 0, block.timestamp + 1);
        vm.warp(block.timestamp + 2);

        oracle.resolveAdmin(id0, true);  // agent wins
        oracle.resolveAdmin(id1, true);  // agent loses (bet NO)

        vm.prank(agentEOA); vault.claimWinnings(id0);
        vm.prank(agentEOA); vault.claimWinnings(id1);

        assertEq(vault.marketsWon(), 1);
        assertEq(vault.marketsLost(), 1);
        (uint256 wr, uint256 tm) = vault.getCalibrationScore();
        assertEq(tm, 2);
        assertEq(wr, 5000); // 50% win rate

        // Verify market count tracking
        assertEq(vault.getActiveMarketCount(), 2);
    }

    function test_E2E_FeedResolution_WithVault() public {
        uint256 id = _createMarket("ETH > 5000?");

        vm.prank(agentEOA);
        vault.deployCapital(id, true, 10 * ONE);

        priceFeed.setAnswer(6000e8);

        oracle.configureOracle(id, ResolutionOracle.OracleTier.Feed, address(priceFeed), ResolutionOracle.ComparisonType.GreaterThan, 5000e8, block.timestamp + 1);
        vm.warp(block.timestamp + 2);
        oracle.resolveFromFeed(id);

        vm.prank(agentEOA);
        vault.claimWinnings(id);
        assertEq(vault.marketsWon(), 1);
    }

    // ══════════════════════════════════════════════
    // ADMIN FUNCTIONS
    // ══════════════════════════════════════════════

    function test_VaultSetAgent() public {
        address newAgent = address(0x1111);
        vault.setAgent(newAgent);
        
        uint256 id = _createMarket("Q?");
        vm.prank(newAgent);
        vault.deployCapital(id, true, 1 * ONE);

        // Old agent rejected
        uint256 id2 = _createMarket("Q2?");
        vm.prank(agentEOA);
        vm.expectRevert("Only agent");
        vault.deployCapital(id2, true, 1 * ONE);
    }

    function test_VaultSetAgent_OnlyOwner() public {
        vm.prank(alice);
        vm.expectRevert();
        vault.setAgent(alice);
    }

    function test_OracleSetMeridianMarket() public {
        address newMarket = address(0x1234);
        oracle.setMeridianMarket(newMarket);
        assertEq(address(oracle.meridianMarket()), newMarket);
    }

    function test_MarketSetOracle_OnlyOwner() public {
        vm.prank(alice);
        vm.expectRevert();
        market.setOracle(alice);
    }
}
