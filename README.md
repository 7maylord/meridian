# Meridian

**Autonomous Prediction Markets for Non-English Financial News — Built on Arc**

Meridian is a self-sustaining prediction market factory. An autonomous AI agent monitors foreign-language financial news (Arabic, Mandarin, Portuguese, Korean, Japanese, Swahili, Turkish, French), structures binary prediction questions in real time, stakes USDC on its own probability estimates via Kelly sizing, bootstraps LMSR liquidity as an AMM, and earns 0.5% builder fees on every trade.

Markets that an English-only trader would miss are live and tradeable before the news hits Western wire services.

---

## How It Works

```
Foreign RSS Feeds (Arabic, Mandarin, PT, KO, …)
        │
        ▼
  NewsIngestionService ──► unprocessed articles in DB
        │
        ▼
  TranslationService (Claude API)
        │  – translates + structures into binary question
        │  – emits: question, pYes, confidence, resolutionDeadline, vertical
        ▼
  DecisionEngineService
        │  – confidence gate (≥ 65%)
        │  – vault capital gate (≥ $100 USDC)
        │  – Kelly fraction sizing (half-Kelly, max 20% of vault)
        │  – duplicate question detection
        ▼
  MarketFactoryService
        │  – createMarket() on MeridianMarket
        │  – configureOracle() on ResolutionOracle (Admin tier)
        │  – deployCapital() on AgentVault (Kelly-sized stake)
        ▼
  On-chain LMSR Market (Arc Testnet)
        │
        ├── Users trade YES/NO shares via frontend
        ├── RequotingService re-sizes position if price drifts >5%
        └── ResolutionService resolves at expiry → ERC-8004 reputation
```

### Agent Loop (every 10 minutes)

1. Poll RSS feeds in 8+ languages
2. Claude structures each article into a binary question with a probability estimate
3. Duplicate detection skips questions already deployed
4. Decision engine gates on confidence and vault capital; sizes position with Kelly criterion
5. Market deployed on-chain, oracle configured, agent stakes capital
6. Requoting loop rebalances position if market price drifts >5% from agent belief
7. Resolution loop auto-resolves expired markets and records Brier-score reputation on ERC-8004

---

## Tech Stack

| Layer                | Technology                                                             |
| :------------------- | :--------------------------------------------------------------------- |
| **Blockchain**       | Arc L1 (Chain ID 5042002, sub-second finality, ~$0.01 USDC gas)        |
| **Smart Contracts**  | Solidity 0.8.20, Foundry, OpenZeppelin, PRBMath SD59x18                |
| **AMM**              | LMSR (Logarithmic Market Scoring Rule) — `C(q) = b·ln(Σ exp(qi/b))`    |
| **Collateral**       | USDC + EURC (6 decimals)                                               |
| **Yield**            | USYC (Circle tokenized money market fund) via Teller                   |
| **Agent Backend**    | NestJS (TypeScript), TypeORM, Supabase                                 |
| **AI**               | Claude API (`claude-sonnet-4-6`) — translation & structuring           |
| **Agent Identity**   | ERC-8004 (Arc) — IdentityRegistry + ReputationRegistry                 |
| **Wallets**          | Circle Programmable Wallets (Developer-Controlled)                     |
| **Frontend**         | Next.js 15, Tailwind CSS, Wagmi v3, Privy, React Query                 |
| **API Monetization** | Nanopayment guard — $0.01 USDC per premium API call, verified on-chain |

---

## Deployed Contracts (Arc Testnet)

| Contract             | Address                                      |
| :------------------- | :------------------------------------------- |
| **MeridianMarket**   | `0x90b9f05f1BD2f71463b2BbF2d433C8bA001bEB50` |
| **ResolutionOracle** | `0x27ff14E3E3580De92538427190A02da105B438A5` |
| **AgentVault**       | `0x08bA64Ee4C58884B9cDd2917997Fd0B60D616519` |

**Agent wallet (Circle):** `0x02B8513B41363D39C36AF102Fa50Ba6941e5Deb9`
**ERC-8004 Agent ID:** `18359`

See [`contracts/README.md`](./contracts/README.md) for full details and external dependency addresses.

---

## Project Structure

```
meridian/
├── contracts/                  # Solidity (Foundry)
│   ├── src/
│   │   ├── MeridianMarket.sol  # Unified LMSR prediction market registry
│   │   ├── AgentVault.sol      # Agent capital manager + USYC yield
│   │   └── ResolutionOracle.sol # Chainlink/admin resolution
│   ├── test/                   # 71 Foundry tests
│   └── script/DeployMeridian.s.sol
├── server/                     # NestJS autonomous agent
│   └── src/
│       ├── agent/              # Loop, translation, decision engine, requoting
│       ├── markets/            # Market factory + resolution service
│       ├── news/               # RSS ingestion + feed registry
│       ├── blockchain/         # Ethers read helpers + calldata encoders
│       ├── circle/             # Circle Wallet + ERC-8004 services
│       └── api/                # REST endpoints + nanopayment guard
└── client/                     # Next.js frontend
    ├── app/
    │   ├── page.tsx            # Market discovery + search/filter
    │   ├── markets/[id]/       # Market detail + live price chart + trade panel
    │   └── portfolio/          # On-chain positions + claim button
    └── components/ui/
        ├── TradePanel.tsx      # Buy YES/NO + Sell YES/NO tabs, real getCost()
        └── PriceChart.tsx      # Live getPrice() poll every 2s
```

---

## Getting Started

### Prerequisites

- [Foundry](https://getfoundry.sh/) — contract build/test/deploy
- Node.js 20+, pnpm
- Arc testnet RPC URL (from Canteen)
- Circle Developer API key + entity secret
- Anthropic API key

### Smart Contracts

```bash
cd contracts
forge build
forge test          # 71 tests
```

### Agent Backend

```bash
cd server
pnpm install
cp .env.example .env   # fill in API keys
pnpm start:dev
```

### Frontend

```bash
cd client
pnpm install
pnpm dev
```

---

## Environment Variables

### `contracts/.env`

```env
PRIVATE_KEY=<deployer EOA private key>
ARC_RPC_URL=https://rpc.testnet.arc-node.thecanteenapp.com/v1/<key>
AGENT_WALLET=0x02B8513B41363D39C36AF102Fa50Ba6941e5Deb9
```

### `server/.env`

```env
ARC_RPC_URL=https://rpc.testnet.arc-node.thecanteenapp.com/v1/<key>
CIRCLE_API_KEY=<circle api key>
CIRCLE_ENTITY_SECRET=<circle entity secret>
CIRCLE_WALLET_ID=<circle wallet id>
ANTHROPIC_API_KEY=<anthropic api key>
DATABASE_URL=<supabase postgres url>
ERC8004_AGENT_ID=18359
ERC8004_METADATA_URI=ipfs://<your-metadata-cid>
```

### `client/.env.local`

```env
NEXT_PUBLIC_API_URL=http://localhost:3001/api
NEXT_PUBLIC_ARC_RPC_URL=https://rpc.testnet.arc-node.thecanteenapp.com/v1/<key>
```

---

## Key Design Decisions

**Fee model — surcharge, not deduction.** The 0.5% builder fee is charged as a separate `transferFrom` on top of the LMSR cost. The pool receives exactly the LMSR cost, which keeps the pool accounting consistent with the cost function and allows round-trip buy→sell without liquidity shortfalls.

**Parimutuel payout.** `payout = (userWinningShares / totalWinningShares) × totalCollateral`. All collateral — from both YES and NO sides — flows to winners proportionally. There is no fixed $1 redemption per share.

**Half-Kelly sizing.** The agent sizes positions at 0.5× Kelly fraction (max 20% of vault). This balances confidence signalling with risk management.

**ERC-8004 reputation.** After each resolution, the agent records a Brier-score-derived reputation event (`score = round((1 - brierScore) × 100)`) on Arc's ReputationRegistry. Agents that consistently call markets correctly build an on-chain track record.

**Nanopayments.** The `/api/markets/:id/recommendation` endpoint requires a `X-Payment-Tx` header containing the hash of a USDC transfer (≥$0.01) to the agent wallet on Arc. The guard verifies the transfer on-chain before serving the agent's probability estimate.

---

## License

MIT
