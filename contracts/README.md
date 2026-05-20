# Meridian Contracts

Smart contracts for the Meridian prediction market protocol — deployed on [Arc Testnet](https://docs.arc.network) (Chain ID: `5042002`).

## Deployed Addresses (Arc Testnet)

| Contract | Address | Explorer Link |
| :--- | :--- | :--- |
| **MeridianMarket** | `0xc626eba3f91d97e9c94ca20cf1449e5857d4f082` | [View on Explorer](https://explorer.testnet.arc-node.thecanteenapp.com/address/0xc626eba3f91d97e9c94ca20cf1449e5857d4f082) |
| **ResolutionOracle** | `0x98c021d2700d49ec5b3bf21011c85012e6c68ff6` | [View on Explorer](https://explorer.testnet.arc-node.thecanteenapp.com/address/0x98c021d2700d49ec5b3bf21011c85012e6c68ff6) |
| **AgentVault** | `0xd37670aca0a61df9123713d7b21b3af9e15f7466` | [View on Explorer](https://explorer.testnet.arc-node.thecanteenapp.com/address/0xd37670aca0a61df9123713d7b21b3af9e15f7466) |

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
                       ┌──────────────────────┐
                       │   ResolutionOracle   │
                       └──────────┬───────────┘
                                  │
                          resolves marketId
                                  │
                                  ▼
┌──────────────┐         ┌──────────────────────┐
│  AgentVault  ├─buys/───►    MeridianMarket    ◄───trades/approves─── User / Trader
└──────────────┘ claims  │  (Unified Registry)  │                      (USDC Collateral)
                         └──────────────────────┘
                         ├── Sequential marketId
                         └── 18-decimal internal math (LMSR)
```

## Contracts

### `MeridianMarket.sol`
A unified prediction market registry implementing a logarithmic market scoring rule (LMSR) automated market maker.
- Accepts 6-decimal collateral (USDC/EURC) and scales internal calculations to 18 decimals via [PRBMath](https://github.com/PaulRBerg/prb-math).
- Supports buying shares on any active market via `buy(marketId, isYes, shares)`.
- Implements pro-rata pool claiming via `claim(marketId)` when resolved, ensuring pool solvency.
- Restricts resolution calls to the configured `ResolutionOracle` address.

### `AgentVault.sol`
Manages the autonomous agent's capital reserves.
- Deploys capital into specific markets on the registry via `deployCapital(marketId, isYes, shares)`.
- Claims payouts from resolved markets using `claim(marketId)`.
- Tracks agent-specific win/loss stats, calibration scores, and P&L.
- Interacts with Circle's USYC Teller to convert idle USDC into USYC, capturing yield.

### `ResolutionOracle.sol`
Resolves prediction markets registered on `MeridianMarket` via a numeric market identifier.
- **Tier 1 (Automated Feeds)**: Validates resolutions using on-chain Chainlink / Pyth data feeds by performing comparative checks (e.g. `>` or `<` thresholds).
- **Tier 2 (Admin Resolution)**: Provides a trusted admin-verified resolution fallback if no live data feed exists or is supported.

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

Create a `.env` file in the `contracts` directory:

```env
PRIVATE_KEY=your_deployer_private_key
ARC_RPC_URL=https://rpc.testnet.arc-node.thecanteenapp.com/v1/your_key
```
