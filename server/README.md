# Meridian Agent Server

NestJS autonomous agent backend for Meridian. Polls foreign-language RSS feeds, uses Claude to structure binary prediction questions, and deploys LMSR markets on Arc testnet via Circle Programmable Wallets.

## Architecture

```
AppModule
├── AgentModule
│   ├── AgentLoopService       — 10-min cron: ingest → translate → decide → deploy
│   ├── TranslationService     — Claude API: article → structured market
│   ├── DecisionEngineService  — confidence gate, vault capital gate, Kelly sizing
│   ├── RequotingService       — 10-min cron: re-size position if price drifts >5%
│   └── (agent.types.ts)       — StructuredMarket, DeploymentDecision interfaces
├── MarketsModule
│   ├── MarketFactoryService   — createMarket + configureOracle + deployCapital
│   ├── ResolutionService      — 10-min cron: resolve expired markets + ERC-8004 reputation
│   └── (market.entity.ts)     — TypeORM entity for DB-persisted market state
├── NewsModule
│   ├── NewsIngestionService   — RSS polling, deduplication, article storage
│   └── FeedRegistry           — 8+ language feed definitions
├── BlockchainModule
│   └── BlockchainService      — ethers.js reads + calldata encoders (no signing here)
├── CircleModule
│   ├── WalletsService         — Circle Developer-Controlled Wallet signing
│   └── Erc8004Service         — ERC-8004 registration + Brier-score reputation events
└── ApiModule
    ├── ApiController          — REST endpoints
    └── NanopaymentGuard       — $0.01 USDC per premium call, verified on-chain
```

---

## Agent Loop (every 10 minutes)

1. **Ingest** — poll RSS feeds, store unprocessed articles in DB
2. **Translate** — Claude (`claude-sonnet-4-6`) structures each article:
   - Generates a binary yes/no question
   - Estimates `pYes` (0–1 probability), `confidence` (0–1), `resolutionDeadline`
   - Tags `vertical` (central-bank, fx-direction, trade-policy) and `settlementToken` (USDC/EURC)
3. **Duplicate check** — skip if identical question already deployed
4. **Decision engine** — gates on `confidence ≥ 0.65` and `vaultCapital ≥ $100 USDC`; sizes stake with half-Kelly (max 20% of vault)
5. **Deploy** — `createMarket()` → `configureOracle()` → `deployCapital()`
6. **Persist** — save market to DB with on-chain `marketId` and `txHash`

### Requoting (every 10 minutes)

For each active market, reads on-chain `getPrice()`. If `|onChainPrice - agentPYes| > 5%` and the market moved against the agent's position, adds up to 10% of vault capital to the position at the improved price.

### Resolution (every 10 minutes)

Finds DB markets past their `resolutionDeadline`. For each:
- If already resolved on-chain: syncs DB state
- Otherwise: calls `oracle.resolveAdmin(marketId, outcome)` using the agent wallet
- Records Brier-score reputation on ERC-8004 ReputationRegistry

---

## REST API

Base URL: `http://localhost:3001/api`

| Method | Path | Description |
| :--- | :--- | :--- |
| `GET` | `/health` | Server health + wallet status |
| `GET` | `/markets` | All markets (DB, most recent first) |
| `GET` | `/markets/:id` | Single market by UUID |
| `GET` | `/agent/stats` | Vault capital, win rate, calibration score |
| `POST` | `/markets/:id/resolve` | Manually set resolution outcome (admin) |
| `POST` | `/wallet/create` | Create a new Circle wallet |
| `GET` | `/markets/:id/recommendation` | **Premium** — agent pYes estimate (requires `X-Payment-Tx` header) |

### Nanopayment Guard

The `/recommendation` endpoint requires a `X-Payment-Tx` header containing the hash of a confirmed USDC transfer of ≥ `$0.01` to the agent wallet on Arc. The guard verifies the transfer on-chain and rejects replayed hashes.

```bash
# Example: after sending 10000 USDC units (0.01 USDC) to the agent wallet
curl -H "X-Payment-Tx: 0xabc..." \
  http://localhost:3001/api/markets/<uuid>/recommendation
```

**402 response** (no/invalid payment):
```json
{
  "error": "Payment required",
  "recipient": "0x02B8513B41363D39C36AF102Fa50Ba6941e5Deb9",
  "minAmount": 0.01,
  "token": "0x3600000000000000000000000000000000000000",
  "chainId": 5042002
}
```

---

## Circle Programmable Wallets

The agent signs all transactions via a Circle Developer-Controlled Wallet — not an EOA private key. This means:
- The agent wallet address is `0x02B8513B41363D39C36AF102Fa50Ba6941e5Deb9`
- Signing uses Circle's SDK (`@circle-fin/developer-controlled-wallets`)
- The deployer EOA owns the contracts; the agent wallet is authorized as the vault's `agent`

---

## ERC-8004 Agent Identity

On first boot (if `ERC8004_AGENT_ID` is not set in env), the server registers the agent with Arc's ERC-8004 IdentityRegistry and fetches the assigned NFT token ID from the `Transfer` event.

**Meridian Agent ID:** `18359`

After each market resolution, `recordReputation()` posts a feedback event to the ReputationRegistry:
```
score = round((1 - brierScore) × 100)
brierScore = (1 - prediction)²
```
Where `prediction` = `pYes` if outcome was YES, `1 - pYes` if NO. Score 100 = perfect call, 75 = typical good call.

Once registered, add to `.env`:
```
ERC8004_AGENT_ID=18359
```

---

## Setup

### Install

```bash
pnpm install
```

### Environment Variables

Create `server/.env`:

```env
# Arc testnet
ARC_RPC_URL=https://rpc.testnet.arc-node.thecanteenapp.com/v1/<key>

# Circle Programmable Wallets
CIRCLE_API_KEY=<circle api key>
CIRCLE_ENTITY_SECRET=<circle entity secret>
CIRCLE_WALLET_ID=<wallet id — set after first run>

# Claude AI
ANTHROPIC_API_KEY=<anthropic api key>

# Database (Supabase)
DATABASE_URL=postgresql://...

# ERC-8004 (set after first boot)
ERC8004_AGENT_ID=18359
ERC8004_METADATA_URI=ipfs://<your-metadata-cid>
```

### Run

```bash
# Development (watch mode)
pnpm start:dev

# Production
pnpm build && pnpm start:prod
```

---

## Agent Parameters (configuration.ts)

| Parameter | Default | Description |
| :--- | :--- | :--- |
| `agent.minConfidence` | `0.65` | Minimum Claude confidence to deploy a market |
| `agent.minLiquidity` | `100` | Minimum vault USDC (dollars) before agent stakes |
| `agent.pollIntervalMs` | `900000` | Loop cadence (15 min; cron runs every 10 min) |
| `agent.defaultBParam` | `100e18` | LMSR liquidity parameter for new markets |

---

## Key Files

| File | Purpose |
| :--- | :--- |
| `agent/agent-loop.service.ts` | Main 10-min cron loop |
| `agent/translation.service.ts` | Claude API structuring prompt |
| `agent/decision-engine.service.ts` | Gate + Kelly sizing logic |
| `agent/requoting.service.ts` | Price drift rebalancing |
| `markets/market-factory.service.ts` | On-chain market + oracle + vault deployment |
| `markets/resolution.service.ts` | Auto-resolution + ERC-8004 reputation |
| `blockchain/blockchain.service.ts` | Read helpers + calldata encoders |
| `circle/wallets.service.ts` | Circle wallet signing + tx polling |
| `circle/erc8004.service.ts` | Agent registration + reputation events |
| `api/nanopayment.guard.ts` | On-chain payment verification guard |
| `config/contracts.ts` | ABI fragments for all contracts |
| `config/configuration.ts` | All addresses, parameters, env var mapping |
