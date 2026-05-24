# Meridian Frontend

Next.js 15 frontend for Meridian prediction markets. Connects to Arc testnet via Wagmi v3 + Privy, reads on-chain market state directly, and lets users trade YES/NO shares with real-time LMSR cost quotes.

## Pages

| Route | Description |
| :--- | :--- |
| `/` | Market discovery — search by keyword, filter by vertical (central-bank, fx-direction, trade-policy) |
| `/markets/[id]` | Market detail — live price chart (polls `getPrice()` every 2s), trade panel, agent stake info |
| `/portfolio` | User positions — reads `getUserPosition()` on-chain for all markets, Claim button for resolved winners |
| `/agent` | Agent stats — vault capital, win rate, calibration score |
| `/admin` | Admin resolution panel |

---

## Components

### `TradePanel`

4-tab trade interface:
- **Buy YES / Buy NO** — reads `getCost()` from chain for real LMSR cost; shows price impact
- **Sell YES / Sell NO** — reads `getSellRefund()` from chain; no sell fee
- Handles USDC approval if allowance is insufficient
- Integrates with Privy embedded wallet or any injected wallet via Wagmi

### `PriceChart`

Live YES price chart. Polls `getPrice(marketId)` every 2 seconds via `useReadContract({ refetchInterval: 2000 })`. Maintains a 60-point rolling window (2 minutes). Built with Recharts.

### `Portfolio Page`

Batches `getUserPosition(marketId, address)` reads across all known markets using `useReadContracts` (multicall). Filters out zero balances. For resolved markets, shows WON/LOST badge and a Claim button that calls `claim(marketId)` on-chain.

---

## Contract Integration

The client reads directly from Arc testnet — no backend proxy for on-chain state.

**Contracts:**

| Contract | Address |
| :--- | :--- |
| `MeridianMarket` | `0x2276EcD90c1E8A8939C70c8F70dcE69C3c2704f6` |
| `ResolutionOracle` | `0x0bdE05DBFf1706586F5a499b4aA68A07E301ba0f` |
| `AgentVault` | `0x31f85C18172BAA5d796Ff140D8dB4799bcF1a8BF` |
| `USDC` | `0x3600000000000000000000000000000000000000` |

ABIs are sourced directly from Foundry build artifacts at `lib/abi/`.

---

## Setup

### Install

```bash
pnpm install
```

### Environment Variables

Create `client/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:3001/api
NEXT_PUBLIC_ARC_RPC_URL=https://rpc.testnet.arc-node.thecanteenapp.com/v1/<key>
```

### Run

```bash
pnpm dev       # http://localhost:3000
pnpm build
pnpm start
```

---

## Tech Stack

| | |
| :--- | :--- |
| **Framework** | Next.js 15 (App Router) |
| **Styling** | Tailwind CSS, custom glass-morphism design system |
| **Chain reads** | Wagmi v3 + Viem |
| **Wallet** | Privy (embedded + external wallets) |
| **Data fetching** | TanStack React Query |
| **Charts** | Recharts |
| **Icons** | Lucide React |

---

## Key Files

| File | Purpose |
| :--- | :--- |
| `lib/config.ts` | Contract addresses + chain config |
| `lib/abis.ts` | ABI imports (sourced from Foundry artifacts) |
| `lib/abi/MeridianMarket.json` | Full ABI — update from `contracts/out/` after redeploy |
| `app/providers.tsx` | Wagmi + Privy + React Query provider tree |
| `components/ui/TradePanel.tsx` | Buy/Sell tabs with on-chain cost reads |
| `components/ui/PriceChart.tsx` | Live polling price chart |
| `app/portfolio/page.tsx` | On-chain position reader + claim UI |

---

## Updating ABIs After Redeploy

After redeploying contracts, copy fresh ABIs from Foundry build output:

```bash
# From project root
cp contracts/out/MeridianMarket.sol/MeridianMarket.json client/lib/abi/MeridianMarket.json
cp contracts/out/AgentVault.sol/AgentVault.json client/lib/abi/AgentVault.json
cp contracts/out/ResolutionOracle.sol/ResolutionOracle.json client/lib/abi/ResolutionOracle.json
```

Then update the addresses in `lib/config.ts`.
