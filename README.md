# Meridian

**Autonomous Prediction Markets for Non-English Financial News — Built on Arc**

Meridian is a self-sustaining prediction market factory. An autonomous AI agent monitors foreign-language financial news (Arabic, Mandarin, Portuguese, Korean, Japanese, Swahili, Turkish, French), structures binary prediction questions in real time, stakes USDC on its own probability estimates via Kelly sizing, bootstraps LMSR liquidity as an AMM, and earns 0.5% builder fees on every trade.

Markets that an English-only trader would miss are live and tradeable before the news hits Western wire services.

---

## Agent-First Features

### x402 Gatepoint — Machine-Payable API

Meridian exposes a premium probability endpoint that only agents can unlock:

```
GET /api/markets/:id/recommendation
X-Payment-Tx: <arc-tx-hash>
```

When called without a valid payment, the server responds with HTTP **402 Payment Required** and a machine-readable instruction body:

```json
{
  "error": "Payment required",
  "instructions": "Send ≥$0.01 USDC to 0x02B8...5Deb9 on Arc testnet, then retry with the tx hash in X-Payment-Tx header",
  "recipient": "0x02B8513B41363D39C36AF102Fa50Ba6941e5Deb9",
  "minAmount": 0.01,
  "token": "0x3600000000000000000000000000000000000000",
  "chainId": 5042002
}
```

An agent that hits this endpoint reads the 402 body, sends the USDC transfer on Arc (sub-second, ~$0.01 gas), and retries with the transaction hash. The guard verifies the on-chain ERC-20 Transfer event before serving the response — no session tokens, no API keys, no OAuth. Payment is the credential.

The response gives the agent Meridian's private probability estimate (`agentPYes`), the side it staked (`agentStakeSide`), and its confidence level — signal that no public endpoint provides.

**Why this matters for agents:** Any autonomous trading agent can permissionlessly query Meridian's edge on any market for $0.01. No registration, no rate limits by identity — just pay and get signal. Each transaction hash is single-use (replay-protected in memory).

---

### ERC-8004 — On-Chain Agent Identity and Reputation

Meridian's agent carries a verifiable on-chain identity via Arc's ERC-8004 standard:

- **Agent ID:** `18359` on Arc's IdentityRegistry
- **Auto-registration:** On first boot, the agent calls `IdentityRegistry.register(metadataURI)` from its Circle Programmable Wallet, minting a soulbound identity token
- **Reputation after every resolution:** When a market settles, the agent calls `ReputationRegistry.giveFeedback()` with a Brier-score-derived accuracy score

```
score = round((1 − brierScore) × 100)
brierScore = (prediction − outcome)²
```

A market the agent called at 80% confidence that resolves YES earns score 96. A badly calibrated call earns proportionally less. These scores accumulate on-chain, forming an auditable track record that any other agent (or human) can query before deciding whether to trust Meridian's x402 signal.

**Why this matters for agents:** The x402 endpoint is only worth $0.01 if the seller has edge. ERC-8004 reputation lets a buyer agent verify that edge before paying — closing the trust loop entirely on-chain, without any off-chain reputation system.

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
| **MeridianMarket**   | `0x2276EcD90c1E8A8939C70c8F70dcE69C3c2704f6` |
| **ResolutionOracle** | `0x0bdE05DBFf1706586F5a499b4aA68A07E301ba0f` |
| **AgentVault**       | `0x31f85C18172BAA5d796Ff140D8dB4799bcF1a8BF` |

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

### `client/.env`

```env
NEXT_PUBLIC_API_URL=http://localhost:3000/api
NEXT_PUBLIC_PRIVY_APP_ID=<privy app id>
```

> All Arc RPC calls are proxied through the backend (`POST /api/rpc`) to avoid browser CORS restrictions. Do **not** set `NEXT_PUBLIC_ARC_RPC_URL` in the client — it would bypass the proxy and break all on-chain reads.

---

## Key Design Decisions

**Fee model — surcharge, not deduction.** The 0.5% builder fee is charged as a separate `transferFrom` on top of the LMSR cost. The pool receives exactly the LMSR cost, which keeps the pool accounting consistent with the cost function and allows round-trip buy→sell without liquidity shortfalls.

**Parimutuel payout.** `payout = (userWinningShares / totalWinningShares) × totalCollateral`. All collateral — from both YES and NO sides — flows to winners proportionally. There is no fixed $1 redemption per share.

**Half-Kelly sizing.** The agent sizes positions at 0.5× Kelly fraction (max 20% of vault). This balances confidence signalling with risk management.

**x402 payment gate.** The `/api/markets/:id/recommendation` endpoint speaks HTTP 402 — a machine-readable payment demand that tells the caller exactly what to send, to whom, and on which chain. No signup required; the on-chain ERC-20 Transfer event is the credential. Each tx hash is single-use. This is designed for agent-to-agent commerce: a trading agent pays $0.01 USDC and gets Meridian's private probability estimate in return.

**ERC-8004 reputation.** After each resolution, the agent records a Brier-score-derived reputation event (`score = round((1 - brierScore) × 100)`) on Arc's ReputationRegistry. Agents consistently calling markets correctly build an auditable on-chain track record that buyers can verify before trusting the x402 signal.

**Fee model — surcharge, not deduction.** The 0.5% builder fee is charged as a separate `transferFrom` on top of the LMSR cost. The pool receives exactly the LMSR cost, which keeps the pool accounting consistent with the cost function and allows round-trip buy→sell without liquidity shortfalls.

---

## License

MIT
