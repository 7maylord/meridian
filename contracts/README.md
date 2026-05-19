# Meridian Contracts

Smart contracts for the Meridian prediction market protocol — deployed on [Arc Testnet](https://docs.arc.network) (Chain ID: `5042002`).

## Deployed Addresses (Arc Testnet)

| Contract | Address |
| :--- | :--- |
| **ResolutionOracle** | [`0x3379CdE825960C49b456c62f6bb485902B7dA830`](https://explorer.testnet.arc.network/address/0x3379CdE825960C49b456c62f6bb485902B7dA830) |
| **MarketFactory** | [`0xF3DeE532B0d0d29c4E4B64b004b7f286E1Cf9814`](https://explorer.testnet.arc.network/address/0xF3DeE532B0d0d29c4E4B64b004b7f286E1Cf9814) |
| **AgentVault** | [`0x18453c5914ce22F9a9c2022b24eF3Bf16eb21a71`](https://explorer.testnet.arc.network/address/0x18453c5914ce22F9a9c2022b24eF3Bf16eb21a71) |

### External Dependencies (Arc Testnet)

| Token / Service | Address | Decimals |
| :--- | :--- | :--- |
| **USDC** (native gas token) | `0x3600000000000000000000000000000000000000` | 6 |
| **EURC** | `0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a` | 6 |
| **USYC** | `0xe9185F0c5F296Ed1797AaE4238D26CCaBEadb86C` | 6 |
| **Teller** (USDC ↔ USYC) | `0x9fdF14c5B14173D74C08Af27AebFf39240dC105A` | — |

**Deployer / Owner:** `0xAD6433f3a49eb065e6470F231a3dc3Dee26F0f9d`

---

## Architecture

```
MarketFactory ──creates──▶ PredictionMarket (LMSR AMM)
       │                         │
       │                         ├── YES / NO ERC-20 tokens
       │                         └── USDC or EURC collateral (6 decimals)
       │
ResolutionOracle ──resolves──▶ PredictionMarket
       │
       ├── Tier 1: Chainlink / Pyth price feeds
       └── Tier 2: Admin-verified resolution

AgentVault
       │
       ├── Deploys capital into markets
       ├── Tracks P&L and calibration score
       └── Earns yield on idle USDC via USYC Teller
```

## Contracts

### `PredictionMarket.sol`
LMSR automated market maker with YES/NO outcome tokens. Accepts 6-decimal collateral (USDC/EURC) and uses 18-decimal internal math via [PRBMath](https://github.com/PaulRBerg/prb-math). Only the designated oracle can resolve the market.

### `MarketFactory.sol`
Deploys new `PredictionMarket` instances. Supports multiple collateral tokens (USDC, EURC) with configurable builder fee rates.

### `AgentVault.sol`
Holds the autonomous agent's USDC reserves. Manages capital deployment into markets, tracks win/loss calibration, and integrates with Circle's USYC Teller for yield on idle funds.

### `ResolutionOracle.sol`
Resolves prediction markets via on-chain price feeds (Tier 1) or admin verification (Tier 2). Supports Chainlink and Pyth data feeds.

---

## Development

### Build

```bash
forge build
```

### Test

```bash
forge test
```

### Deploy

```bash
source .env && forge script script/DeployMeridian.s.sol:DeployMeridian \
  --rpc-url $ARC_RPC_URL \
  --broadcast \
  -vvvv
```

### Environment Variables

Create a `.env` file in this directory:

```env
PRIVATE_KEY=your_deployer_private_key
ARC_RPC_URL=https://rpc.testnet.arc-node.thecanteenapp.com/v1/your_key
```
