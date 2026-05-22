# Meridian Contracts

Solidity smart contracts for the Meridian prediction market protocol — deployed on [Arc Testnet](https://docs.arc.network) (Chain ID: `5042002`).

## Deployed Addresses (Arc Testnet)

| Contract | Address | Explorer |
| :--- | :--- | :--- |
| **MeridianMarket** | `0x90b9f05f1BD2f71463b2BbF2d433C8bA001bEB50` | [View](https://explorer.testnet.arc-node.thecanteenapp.com/address/0x90b9f05f1BD2f71463b2BbF2d433C8bA001bEB50) |
| **ResolutionOracle** | `0x27ff14E3E3580De92538427190A02da105B438A5` | [View](https://explorer.testnet.arc-node.thecanteenapp.com/address/0x27ff14E3E3580De92538427190A02da105B438A5) |
| **AgentVault** | `0x08bA64Ee4C58884B9cDd2917997Fd0B60D616519` | [View](https://explorer.testnet.arc-node.thecanteenapp.com/address/0x08bA64Ee4C58884B9cDd2917997Fd0B60D616519) |

**Deployer / Owner:** `0xAD6433f3a49eb065e6470F231a3dc3Dee26F0f9d`
**Agent wallet (Circle):** `0x02B8513B41363D39C36AF102Fa50Ba6941e5Deb9`

### External Dependencies (Arc Testnet)

| Token / Service | Address | Decimals |
| :--- | :--- | :--- |
| **USDC** (native gas token) | `0x3600000000000000000000000000000000000000` | 6 |
| **EURC** | `0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a` | 6 |
| **USYC** (Circle money market) | `0xe9185F0c5F296Ed1797AaE4238D26CCaBEadb86C` | 6 |
| **Teller** (USDC ↔ USYC) | `0x9fdF14c5B14173D74C08Af27AebFf39240dC105A` | — |
| **ERC-8004 IdentityRegistry** | `0x8004A818BFB912233c491871b3d84c89A494BD9e` | — |
| **ERC-8004 ReputationRegistry** | `0x8004B663056A597Dffe9eCcC1965A193B7388713` | — |

---

## Architecture

```
                       ┌──────────────────────┐
                       │   ResolutionOracle   │
                       │  ┌──────────────┐   │
                       │  │  Tier 1 Feed │   │  ← Chainlink/Pyth price feed
                       │  │  Tier 2 Admin│   │  ← agent wallet resolveAdmin()
                       │  └──────────────┘   │
                       └──────────┬───────────┘
                                  │ resolve(marketId, outcome)
                                  ▼
┌──────────────┐         ┌──────────────────────┐
│  AgentVault  ├─buy()──►│    MeridianMarket    │◄──buy()/sell()── Users
│              │         │   (LMSR Registry)    │
│ USDC reserve │◄─claim()┤                      │
│ USYC yield   │         │  Sequential marketId │
└──────────────┘         │  18-dec internal math│
                         └──────────────────────┘
```

---

## Contracts

### `MeridianMarket.sol`

A unified prediction market registry. All markets live in one contract — no per-market deployments.

**LMSR pricing:**
```
C(qYes, qNo, b) = b · ln(exp(qYes/b) + exp(qNo/b))
cost(shares) = C(q + shares) - C(q)
```

**Fee model (surcharge, not deduction):**
- `buy()` charges two separate `transferFrom` calls: `lmsrCost` → pool, `fee` → feeCollector
- The pool always holds exactly the LMSR cost — fee never touches pool accounting
- `sell()` has zero fee — buyers paid the entry fee; no double-charge on exit
- Default fee: `50 bps (0.5%)`, max `500 bps (5%)`

**Payout model (parimutuel):**
```
payout = (userWinningShares / totalWinningShares) × totalCollateral
```
All collateral from both YES and NO sides flows to winners proportionally. There is no fixed $1 per share — winning payout per share exceeds cost-per-share when the losing side had significant volume.

**Key functions:**

| Function | Description |
| :--- | :--- |
| `createMarket(question, criteria, expiry, b, collateral)` | Deploy a new market |
| `buy(marketId, isYes, shares)` | Buy YES or NO shares |
| `sell(marketId, isYes, shares)` | Sell shares back to AMM before expiry |
| `claim(marketId)` | Claim winning payout after resolution |
| `getCost(marketId, isYes, shares)` | Preview buy cost (6-decimal collateral) |
| `getSellRefund(marketId, isYes, shares)` | Preview sell refund (6-decimal collateral) |
| `getPrice(marketId)` | Current YES/NO prices in basis points (0–10000) |
| `resolve(marketId, outcome)` | Oracle-only resolution |

---

### `AgentVault.sol`

Manages the autonomous agent's capital reserves and on-chain P&L tracking.

- `deployCapital(marketId, isYes, shares)` — buys shares on behalf of the agent (calls `buy()` on MeridianMarket with USDC approval)
- `claimWinnings(marketId)` — claims resolved market payout back to vault
- `depositToUsyc(amount)` / `redeemFromUsyc(amount)` — move idle USDC into/out of USYC for yield
- Tracks `totalDeployed`, `totalReturned`, `marketsWon`, `marketsLost`
- `getCalibrationScore()` — returns win rate as basis points

---

### `ResolutionOracle.sol`

Resolves markets registered on `MeridianMarket`.

**Tier 1 (Feed):** Chainlink/Pyth price feed comparison. Configured with a threshold and comparison type (`GreaterThan` / `LessThan`). Call `resolveFromFeed(marketId)` once the market has expired.

**Tier 2 (Admin):** Trusted admin wallet calls `resolveAdmin(marketId, outcome)` after expiry. Used for text-based events where no on-chain price feed exists. This is what Meridian's agent uses by default.

```solidity
oracle.configureOracle(
    marketId,
    OracleTier.Admin,   // or Feed
    address(0),         // feed address (ignored for Admin)
    ComparisonType.GreaterThan,
    0,                  // threshold (ignored for Admin)
    expiry
);
```

---

## Development

### Prerequisites

- [Foundry](https://getfoundry.sh/)

### Build

```bash
forge build
```

### Test

```bash
forge test
# 71 tests: MeridianMarket suite (43) + FullSystem suite (28)
```

### Deploy

```bash
# Create contracts/.env with:
# PRIVATE_KEY=<deployer key>
# ARC_RPC_URL=<arc rpc>
# AGENT_WALLET=0x02B8513B41363D39C36AF102Fa50Ba6941e5Deb9

source .env && forge script script/DeployMeridian.s.sol:DeployMeridian \
  --rpc-url "$ARC_RPC_URL" \
  --broadcast \
  --legacy
```

The deploy script:
1. Deploys `MeridianMarket` with oracle initially set to `address(0)`
2. Deploys `ResolutionOracle` pointing at the market
3. Calls `market.setOracle(oracle)` to wire them together
4. Registers USDC and EURC as supported collateral
5. Deploys `AgentVault` with the Circle agent wallet (not the deployer)

### Environment Variables

```env
PRIVATE_KEY=<your deployer private key>
ARC_RPC_URL=https://rpc.testnet.arc-node.thecanteenapp.com/v1/<key>
AGENT_WALLET=<circle programmable wallet address>
```

---

## Testing Notes

The test suite uses a `MockUSDC` (6 decimals) and a `MockPriceFeed` to simulate Chainlink responses. Key scenarios covered:

- LMSR pricing and cost function correctness
- Fee surcharge model (buyer pays `lmsrCost + fee`, pool receives `lmsrCost`)
- Sell returns full LMSR refund with no fee
- Parimutuel payout proportionality
- Second-claim protection (zeroed balance before transfer)
- Oracle admin and feed resolution paths
- Market expiry guards on buy and sell
- Full end-to-end: create → buy → sell → resolve → claim
