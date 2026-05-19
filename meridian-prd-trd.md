# Meridian — PRD & TRD

### Skin-in-the-Game Translation Markets on Arc

**Hackathon:** Agora Agents Hackathon — Canteen × Circle | May 11–25, 2026
**Version:** 0.1 (Hackathon Scope)

---

## Table of Contents

1. [Product Requirements Document (PRD)](#prd)
2. [Technical Requirements Document (TRD)](#trd)
3. [11-Day Build Plan](#build-plan)

---

# 1. Product Requirements Document (PRD) {#prd}

## 1.1 Vision

Prediction markets are the best price-discovery mechanism ever built — but they only work where liquidity meets information. Today, 90% of that liquidity lives in English-language US events. Billions of people making economic decisions in Arabic, Mandarin, Yoruba, Portuguese, Korean, and Hindi are invisible to the market.

Meridian is a **self-sustaining prediction market factory** for non-English financial and geopolitical events. An AI agent monitors foreign-language news, structures prediction market questions, stakes USDC on its own probability estimates, bootstraps liquidity as an AMM, and earns builder fees per fill. The market grades the agent's translation quality automatically — no committee required.

---

## 1.2 Problem Statement

| Problem                             | Current State                      | Meridian's Fix                          |
| ----------------------------------- | ---------------------------------- | --------------------------------------- |
| Non-English events are untraded     | Polymarket/Kalshi are English-only | Agent translates + structures + creates |
| New markets die thin                | No bootstrapping mechanism         | Agent acts as seed AMM                  |
| Translation quality is unverifiable | Human curators = slow + biased     | Agent stakes USDC on its own estimate   |
| Market creation is unprofitable     | Creator earns nothing per fill     | Builder fee model via Polymarket V2     |
| Idle reserve capital earns nothing  | AMM capital sits dormant           | Reserves park in USYC between fills     |

---

## 1.3 Target Users

**Primary — Traders**

- Crypto-native traders looking for edge in low-attention markets
- Regional traders who understand local events better than the English internet does
- Arbitrageurs who spot lag between regional news and market prices

**Secondary — Market Creators (Human)**

- Regional journalists, analysts, researchers who can flag events the agent misses
- Earn builder fees for creating markets the agent wouldn't find

**Tertiary — Protocol / DAO Treasuries (Post-hackathon)**

- Need hedging instruments for geopolitical and macro events
- No TradFi equivalent for onchain hedging

---

## 1.4 Core Features

### F1 — Translation & Question Structuring Agent

The agent continuously scans a curated set of non-English news feeds (RSS, APIs, scrapers). For each detected event:

- Extracts the core claim
- Structures it as a binary prediction question with clear resolution criteria
- Assigns a calibrated probability estimate P(yes) ∈ (0,1)
- Attaches a confidence score and source credibility weight

**Example input:** Arabic Reuters headline — "البنك المركزي النيجيري يرفع أسعار الفائدة بمقدار 100 نقطة أساس"
**Example output:**

```
Question: Will the Central Bank of Nigeria raise rates by ≥100bps at its May 2026 meeting?
Resolution: Resolves YES if CBN official press release confirms ≥100bps increase by June 1, 2026
P(yes): 0.74
Confidence: 0.81
Source: Reuters Arabic (credibility: 0.92)
```

### F2 — Market Factory (Smart Contracts on Arc)

Each question triggers deployment of a prediction market via `MarketFactory.sol`:

- Deploys a `PredictionMarket.sol` instance with YES/NO ERC-20 tokens
- LMSR (Logarithmic Market Scoring Rule) AMM with fixed liquidity parameter `b`
- Agent seeds initial liquidity from `AgentVault.sol`
- Resolution deadline and oracle source registered at creation

### F3 — Skin-in-the-Game Staking

The agent places a calibrated USDC stake into the market at its own estimated probability:

- Stake size = `f(confidence, market_liquidity_target)` — Kelly-derived
- Stake is publicly visible on-chain — verifiable confidence signal
- If agent's P(yes) = 0.74, it buys YES tokens worth proportional to Kelly fraction of vault
- Humans can trade against the agent or alongside it

### F4 — Dynamic AMM Quoting

Beyond its directional stake, the agent maintains two-sided quotes:

- Quotes YES at `P(yes) + spread` and NO at `(1 - P(yes)) + spread`
- Spread = `f(volatility, market_age, volume)` — tightens as market matures
- Adjusts quotes as new information arrives (new news events, price movement)
- Withdraws liquidity 48h before resolution to avoid oracle manipulation risk

### F5 — Resolution Oracle Layer

Three-tier resolution system:

| Tier               | Mechanism                                 | Used When                                   |
| ------------------ | ----------------------------------------- | ------------------------------------------- |
| Tier 1 (Auto)      | Chainlink Data Feeds / Pyth               | Economic data — CPI, rate decisions, FX     |
| Tier 2 (Semi-auto) | Verified API + agent confirmation         | Central bank press releases, official stats |
| Tier 3 (Dispute)   | Multi-sig panel (3-of-5 staked reporters) | Ambiguous geopolitical events               |

**Hackathon scope:** Tier 1 + Tier 2 only. Tier 3 stubbed.

### F6 — Builder Fee Distribution (Nanopayments)

Every fill on a Meridian market routes a builder fee back to the market creator:

- If agent created the market: fees → `AgentVault.sol` → reinvested
- If human created the market: fees → creator wallet via `Nanopayments`
- Fee rate: configurable, starting at 0.5% per fill

### F7 — Idle Capital Yield

`AgentVault.sol` allocates unused reserves to USYC:

- Capital not deployed in active AMMs earns ~5% APY
- Auto-redeems USYC → USDC when new market needs seeding
- Yield compounds into the agent's available liquidity over time

---

## 1.5 Launch Verticals (Hackathon Scope)

Deliberately narrow. Pick verticals with clean Tier 1/2 resolution:

**Vertical 1 — African Central Bank Decisions**

- Nigeria (CBN), Kenya (CBK), South Africa (SARB), Egypt (CBE)
- Resolution: Official press release + Reuters/Bloomberg confirmation
- Why: Zero Polymarket coverage, English confirmation sources exist, high-information regional traders underserved

**Vertical 2 — EM FX Direction Markets**

- USD/NGN, USD/KES, USD/BRL, USD/IDR 7-day direction
- Settlement in USDC; EURC for EUR/NGN, EUR/BRL pairs
- Resolution: Pyth FX feed at expiry timestamp
- Why: Arc explicitly asked for USDC ↔ EURC FX markets, clean oracle exists

**Vertical 3 — BRICS Trade Policy Events**

- Binary questions on trade agreement signings, tariff announcements
- Resolution: Official government gazette + Reuters Tier 2 confirmation
- Why: High regional search volume, zero prediction market coverage

---

## 1.6 User Flow

```
[Trader visits Meridian]
        ↓
[Browses open markets by vertical / language region]
        ↓
[Selects market — sees question, agent's stake position, current prices]
        ↓
[Connects Circle Wallet]
        ↓
[Buys YES or NO tokens with USDC]
        ↓
[Market resolves via oracle]
        ↓
[Winning tokens redeemable 1:1 for USDC]
        ↓
[Builder fee distributed via Nanopayments to market creator]
```

```
[Agent pipeline — background, continuous]
        ↓
[Ingest non-English feeds every 15min]
        ↓
[Detect tradeable event via Claude API]
        ↓
[Structure question + assign P(yes)]
        ↓
[Assess vault capacity — redeem USYC if needed]
        ↓
[Deploy MarketFactory → PredictionMarket]
        ↓
[Stake USDC at estimated probability]
        ↓
[Seed AMM with two-sided liquidity]
        ↓
[Monitor + requote every 15min until 48h before expiry]
        ↓
[Oracle resolves → vault receives payout]
        ↓
[Calibration data logged → agent improves estimates]
```

---

## 1.7 Success Metrics (Hackathon Window)

| Metric              | Target                                                      |
| ------------------- | ----------------------------------------------------------- |
| Markets created     | ≥ 10 live markets                                           |
| Unique traders      | ≥ 15 wallets                                                |
| Total volume        | ≥ $500 USDC                                                 |
| Agent calibration   | Brier score ≤ 0.22                                          |
| Resolution accuracy | 100% on closed markets                                      |
| Circle tools used   | Wallets, USDC, EURC, USYC, Nanopayments, Contracts, Gateway |

---

## 1.8 Out of Scope (Hackathon)

- Mobile app
- Tier 3 dispute resolution
- Human market creator UI (agent only creates for hackathon)
- Leverage or margin positions
- Cross-chain market creation (Arc only)
- DAO/institutional hedging interface

---

# 2. Technical Requirements Document (TRD) {#trd}

## 2.1 System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     MERIDIAN SYSTEM                          │
│                                                              │
│  ┌─────────────┐    ┌──────────────┐    ┌───────────────┐  │
│  │  News Layer │    │  Agent Layer │    │  Market Layer │  │
│  │             │    │              │    │               │  │
│  │ RSS Feeds   │───▶│ Translation  │───▶│ MarketFactory │  │
│  │ Arabic      │    │ Agent        │    │ PredictionMkt │  │
│  │ Mandarin    │    │ (Claude API) │    │ AgentVault    │  │
│  │ Portuguese  │    │              │    │ ResolutionOracle│ │
│  │ Korean      │    │ Decision     │    │               │  │
│  │ Swahili     │    │ Engine       │    └───────┬───────┘  │
│  └─────────────┘    │              │            │           │
│                     │ AMM Quoter   │            │ Arc L1    │
│  ┌─────────────┐    │              │            │           │
│  │ Oracle Layer│    └──────┬───────┘    ┌───────▼───────┐  │
│  │             │           │            │  Circle Stack │  │
│  │ Chainlink   │           │            │               │  │
│  │ Pyth        │───────────┘            │ Wallets       │  │
│  │ API Tier 2  │                        │ USDC / EURC   │  │
│  └─────────────┘                        │ USYC          │  │
│                                         │ Nanopayments  │  │
│  ┌──────────────────────────────────┐   │ Gateway       │  │
│  │         Backend (NestJS)         │   └───────────────┘  │
│  │  NewsIngestion │ AgentOrchestrator│                      │
│  │  MarketService │ OracleMonitor    │                      │
│  │  VaultService  │ CalibrationLog   │                      │
│  └──────────────────────────────────┘                      │
│                                                              │
│  ┌──────────────────────────────────┐                       │
│  │         Frontend (Next.js)       │                       │
│  │  Market Discovery │ Trade UI     │                       │
│  │  Agent Activity   │ Portfolio    │                       │
│  └──────────────────────────────────┘                       │
└─────────────────────────────────────────────────────────────┘
```

---

## 2.2 Smart Contracts (Solidity on Arc)

### `MarketFactory.sol`

```
Responsibilities:
- Deploy new PredictionMarket instances
- Register agent as default market creator
- Emit MarketCreated events for The Graph indexing
- Store metadata: question, resolution criteria, expiry, oracle address

Key Functions:
- createMarket(question, resolutionCriteria, expiry, oracleConfig, initialP) → marketAddress
- getMarkets(filter) → address[]
- setBuilderFeeRate(rate) → onlyOwner
```

### `PredictionMarket.sol`

```
Responsibilities:
- LMSR AMM with YES/NO ERC-20 tokens
- Accept USDC/EURC deposits, mint tokens
- Burn tokens, return USDC on resolution
- Collect builder fees on each fill, route via Nanopayments
- Emit Trade events for calibration logging

State:
- b: uint256 (LMSR liquidity parameter)
- qYes, qNo: uint256 (outstanding token quantities)
- resolved: bool
- outcome: bool
- builderFeeRate: uint16 (basis points)

Key Functions:
- buyYes(usdcAmount) → yesTokens
- buyNo(usdcAmount) → noTokens
- sell(tokens, side) → usdcAmount
- getPrice(side) → price (LMSR formula)
- resolve(outcome) → onlyOracle
- redeem(tokens) → usdcAmount (post-resolution)
```

LMSR pricing formula:

```
cost(q) = b * ln(e^(qYes/b) + e^(qNo/b))
price(YES) = e^(qYes/b) / (e^(qYes/b) + e^(qNo/b))
```

### `AgentVault.sol`

```
Responsibilities:
- Hold agent's USDC/EURC reserves
- Interface with Circle's USYC contract for yield
- Authorize agent EOA to deploy capital into markets
- Track calibration P&L per market

Key Functions:
- deployCapital(market, amount, side) → onlyAgent
- withdrawCapital(market) → onlyAgent
- depositToUSYC(amount) → internal
- redeemFromUSYC(amount) → internal
- getAvailableCapital() → uint256
- recordOutcome(market, won, payout) → internal (calibration log)
```

### `ResolutionOracle.sol`

```
Responsibilities:
- Chainlink/Pyth data feed integration (Tier 1)
- Admin-verified resolution (Tier 2)
- Trigger PredictionMarket.resolve() at expiry

Key Functions:
- resolveFromFeed(market, feedAddress, comparison, threshold) → Tier 1
- resolveAdmin(market, outcome) → onlyVerifier (Tier 2)
- scheduleResolution(market, expiry, oracleConfig) → internal
```

---

## 2.3 Backend (NestJS)

### Module Structure

```
src/
├── news/
│   ├── news-ingestion.service.ts     # RSS + API polling, 15min cron
│   ├── feed-registry.ts              # Curated non-English feed list
│   └── news.types.ts
├── agent/
│   ├── translation.service.ts        # Claude API — translate + structure
│   ├── decision-engine.service.ts    # Kelly sizing, deployment decisions
│   ├── amm-quoter.service.ts         # Dynamic spread management
│   └── calibration.service.ts        # Log outcomes, update priors
├── markets/
│   ├── market-factory.service.ts     # Interact with MarketFactory.sol
│   ├── market-monitor.service.ts     # Watch open positions
│   └── market.repository.ts          # Postgres persistence
├── oracle/
│   ├── oracle-monitor.service.ts     # Watch resolution deadlines
│   ├── chainlink.service.ts
│   └── pyth.service.ts
├── vault/
│   ├── vault.service.ts              # AgentVault.sol interactions
│   └── usyc.service.ts               # USYC deposit/redeem logic
├── circle/
│   ├── wallets.service.ts            # Circle Wallets API
│   ├── nanopayments.service.ts       # Builder fee distribution
│   └── gateway.service.ts            # Cross-chain unified balance
└── api/
    ├── markets.controller.ts          # REST endpoints for frontend
    ├── agent.controller.ts
    └── health.controller.ts
```

### Key Service: `TranslationService`

```typescript
interface StructuredMarket {
  question: string;
  resolutionCriteria: string;
  resolutionDeadline: Date;
  oracleTier: 1 | 2 | 3;
  oracleConfig: OracleConfig;
  pYes: number; // 0–1
  confidence: number; // 0–1
  sourceLanguage: string;
  sourceName: string;
  sourceCredibility: number;
  settlementToken: "USDC" | "EURC";
  vertical: "central-bank" | "fx-direction" | "trade-policy";
}

// Claude API prompt structure
const systemPrompt = `
You are a prediction market structuring agent.
Given a non-English news item, produce a JSON object with:
- question: binary prediction question in English
- resolutionCriteria: exact, unambiguous resolution conditions
- resolutionDeadline: ISO8601 date
- oracleTier: 1 (data feed) | 2 (API + admin) | 3 (dispute)
- pYes: calibrated probability 0–1 based on available evidence
- confidence: your confidence in this estimate 0–1
- settlementToken: USDC or EURC based on event currency context
Only output valid JSON. Never include preamble.
`;
```

### Key Service: `DecisionEngineService`

```typescript
interface DeploymentDecision {
  deploy: boolean;
  stakeAmount: number; // USDC
  stakeSide: "YES" | "NO";
  seedLiquidity: number; // USDC for AMM
  bParam: number; // LMSR b parameter
  redeemUSYC: boolean; // whether to pull from yield
}

// Kelly fraction for stake sizing
function kellyFraction(p: number, odds: number): number {
  // f = (p * odds - (1-p)) / odds
  return (p * odds - (1 - p)) / odds;
}

// Gate: only deploy if confidence > 0.65 and vault has capacity
function shouldDeploy(market: StructuredMarket, vault: VaultState): boolean {
  return (
    market.confidence > 0.65 &&
    vault.availableUSDC > MIN_LIQUIDITY_THRESHOLD &&
    !isDuplicateEvent(market)
  );
}
```

---

## 2.4 Frontend (Next.js)

### Pages

```
/                     → Market discovery (grid, filter by vertical/language)
/markets/[id]         → Individual market: question, agent stake, order book, chart
/agent                → Agent activity feed: recent translations, P&L, calibration score
/portfolio            → Connected wallet: positions, pending resolution, redeemable
```

### Key Components

```
<MarketCard />        → Question, current YES/NO prices, volume, expiry countdown
<TradePanel />        → Buy YES/NO with USDC, shows slippage estimate
<AgentStake />        → Visualizes agent's position as verifiable confidence signal
<CalibrationChart />  → Agent's historical Brier score over time
<PriceChart />        → YES token price over time (resolution anchor)
<ResolutionBadge />   → Tier 1/2/3, oracle source, time to resolution
```

### Circle Wallet Integration

```typescript
// Connect via Circle's embedded wallet SDK
import { CircleWallet } from "@circle-fin/wallet-sdk";

// User signs trades, agent signs via server-side Circle Wallets API
// Gasless UX via Paymaster — all fees in USDC
```

---

## 2.5 Agent Intelligence Layer

### Translation Quality Feedback Loop

```
Market created with P(yes) = 0.74
        ↓
Market resolves YES
        ↓
Outcome = 1, prediction = 0.74
Brier score contribution = (1 - 0.74)^2 = 0.068 ✓ (good calibration)
        ↓
If outcome = NO:
Brier score contribution = (0 - 0.74)^2 = 0.548 ✗ (poor calibration)
        ↓
Log source, language, vertical, confidence
        ↓
Fine-tune system prompt priors for that vertical over time
        ↓
Sources with persistent poor calibration → down-weighted in credibility score
```

### Adversarial Audit Signal

The agent's USDC stake creates a live adversarial signal visible to all traders:

- Large agent stake at 0.74 YES → market informed by agent's analysis
- Sophisticated traders who disagree can profitably trade against the agent
- If agent consistently loses stake → calibration is poor → agent adjusts
- If agent consistently profits → agent is adding genuine information → traders follow

This replaces editorial review with economic incentive.

---

## 2.6 Circle Integration Map

| Feature                   | Circle Product         | Implementation                                                   |
| ------------------------- | ---------------------- | ---------------------------------------------------------------- |
| Agent wallet + signing    | **Circle Wallets API** | Server-side programmatic wallet, agent EOA                       |
| User trading accounts     | **Circle Wallets API** | Embedded wallet SDK, user-custodied                              |
| USDC market settlement    | **USDC on Arc**        | Native token for all market deposits                             |
| EU event markets          | **EURC on Arc**        | EUR-denominated verticals (ECB decisions)                        |
| Idle vault yield          | **USYC**               | `AgentVault.sol` auto-deposits to USYC when capital not deployed |
| Builder fee distribution  | **Nanopayments**       | Per-fill micro-fee routed to market creator                      |
| Cross-chain liquidity     | **Gateway**            | Unified USDC balance if traders bridge from other chains         |
| Gasless UX                | **Paymaster**          | All tx fees paid in USDC, no ETH needed                          |
| Smart contract deployment | **Contracts**          | MarketFactory, PredictionMarket, AgentVault on Arc               |

---

## 2.7 Data Models

### Market

```typescript
interface Market {
  id: string;
  contractAddress: string; // Arc address
  question: string;
  resolutionCriteria: string;
  vertical: Vertical;
  sourceLanguage: string;
  sourceName: string;
  sourceUrl: string;
  agentPYes: number; // Agent's initial estimate
  agentStakeUSDC: number; // Agent's USDC at risk
  agentStakeSide: "YES" | "NO";
  settlementToken: "USDC" | "EURC";
  oracleTier: 1 | 2 | 3;
  oracleConfig: OracleConfig;
  resolutionDeadline: Date;
  createdAt: Date;
  status: "open" | "resolved" | "disputed";
  outcome?: boolean;
}
```

### CalibrationRecord

```typescript
interface CalibrationRecord {
  marketId: string;
  agentPYes: number;
  agentConfidence: number;
  outcome: boolean;
  brierScore: number;
  stakeReturned: number; // USDC (includes profit/loss)
  sourceLanguage: string;
  vertical: Vertical;
  createdAt: Date;
}
```

---

## 2.8 Resolution Oracle Design

### Tier 1 — Chainlink / Pyth (Automatic)

Used for: FX rates, central bank rate announcements via data feeds

```
At resolution deadline:
  Read Chainlink/Pyth feed value
  Compare against threshold defined at market creation
  Call ResolutionOracle.resolveFromFeed()
  → triggers PredictionMarket.resolve()
```

### Tier 2 — API + Admin Confirmation (Semi-automatic)

Used for: Press releases, official stats, central bank communiqués

```
Backend monitors official API sources (CBN, CBK, SARB websites)
On detected event:
  Agent parses result
  Agent submits resolution proposal with evidence link
  24h dispute window opens
  If no dispute → resolveAdmin() called
  If disputed → escalate (stubbed in hackathon)
```

### Resolution Source Registry (Hackathon Scope)

| Vertical          | Source                          | Tier |
| ----------------- | ------------------------------- | ---- |
| Nigeria CBN rate  | CBN press release + Reuters     | 2    |
| Kenya CBK rate    | CBK press release + Reuters     | 2    |
| South Africa SARB | SARB MPC statement              | 2    |
| USD/NGN direction | Pyth FX feed                    | 1    |
| USD/KES direction | Pyth FX feed                    | 1    |
| USD/BRL direction | Pyth FX feed                    | 1    |
| EUR/USD direction | Chainlink ETH/USD proxy or Pyth | 1    |

---

## 2.9 Non-English Feed Registry (Hackathon Scope)

```typescript
const FEED_REGISTRY = [
  // Arabic
  {
    url: "https://feeds.reuters.com/reuters/ArabicNews",
    lang: "ar",
    credibility: 0.92,
  },
  { url: "https://arabic.cnn.com/rss", lang: "ar", credibility: 0.88 },

  // Portuguese (Brazil / Africa)
  {
    url: "https://agenciabrasil.ebc.com.br/rss/economia",
    lang: "pt",
    credibility: 0.85,
  },

  // Swahili / East Africa
  {
    url: "https://www.bbc.co.uk/swahili/articles/rss.xml",
    lang: "sw",
    credibility: 0.9,
  },

  // Mandarin (macro/trade policy)
  {
    url: "https://www.xinhuanet.com/finance/rss.xml",
    lang: "zh",
    credibility: 0.75,
  },

  // French (West Africa, ECB)
  {
    url: "https://www.lemonde.fr/economie/rss_full.xml",
    lang: "fr",
    credibility: 0.88,
  },
];
```

---

## 2.10 Environment & Dependencies

### Smart Contracts

```
Runtime:    Arc EVM (Chain ID: TBD — from Arc docs)
Language:   Solidity ^0.8.24
Framework:  Foundry
Libraries:  OpenZeppelin, PRBMath (LMSR fixed-point math)
Oracles:    Chainlink on Arc, Pyth on Arc
```

### Backend

```
Runtime:    Node.js 20 LTS
Framework:  NestJS 10
Database:   PostgreSQL 16
Queue:      BullMQ (Redis)
AI:         gemini 3 pro
Chain:      ethers.js v6 / viem
Circle SDK: @circle-fin/developer-controlled-wallets
Cron:       @nestjs/schedule
```

### Frontend

```
Framework:  Next.js 14 (App Router)
Styling:    Tailwind CSS
Chain UI:   Wagmi v2 + ConnectKit
Charts:     Recharts
State:      Zustand
```

---

# 3. 11-Day Build Plan {#build-plan}

Hackathon window: May 14 → May 25, 2026

| Day              | Focus                 | Deliverable                                                                                 |
| ---------------- | --------------------- | ------------------------------------------------------------------------------------------- |
| **D1 (May 14)**  | Foundations           | Arc testnet setup, Foundry project init, Circle Wallets API key + test wallet               |
| **D2 (May 15)**  | Contracts I           | `PredictionMarket.sol` — LMSR AMM, YES/NO tokens, USDC deposit/redeem                       |
| **D3 (May 16)**  | Contracts II          | `MarketFactory.sol`, `AgentVault.sol` with USYC stub, `ResolutionOracle.sol` Tier 1         |
| **D4 (May 17)**  | Agent Core            | NestJS scaffold, `TranslationService` (Claude API), `DecisionEngineService`, feed ingestion |
| **D5 (May 18)**  | Agent Loop            | End-to-end: feed → translate → deploy market → stake → seed AMM (testnet)                   |
| **D6 (May 19)**  | Circle Integration    | USYC vault yield, Nanopayments builder fees, Gateway unified balance                        |
| **D7 (May 20)**  | Oracle + Resolution   | Pyth FX Tier 1, CBN/CBK Tier 2, resolution trigger, market settle flow                      |
| **D8 (May 21)**  | Frontend I            | Market discovery, individual market page, trade panel (buy YES/NO)                          |
| **D9 (May 22)**  | Frontend II           | Agent activity feed, calibration chart, portfolio/redeem page                               |
| **D10 (May 23)** | Integration + Bug Fix | Full end-to-end test: news → market → trade → resolve → redeem                              |
| **D11 (May 24)** | Demo Prep             | Seed 5+ live testnet markets, record demo video, write pitch, deploy to production          |

### Critical Path

The contract LMSR math (Day 2) and the agent translation loop (Day 5) are the two hardest pieces. Everything else is plumbing around them. If either slips, cut scope here:

- **Cut first:** EURC vertical (do USDC only)
- **Cut second:** USYC yield (stub vault, deploy full later)
- **Never cut:** Skin-in-the-game stake mechanic — it's the core thesis

---

## Appendix A — LMSR Math Reference

```
Cost function:    C(q) = b × ln(Σ exp(qi/b))
Price of YES:     p(YES) = exp(qYes/b) / (exp(qYes/b) + exp(qNo/b))
Cost to buy Δq:   ΔC = C(q + Δq) - C(q)

Liquidity param b controls market depth:
- Higher b → flatter price curve → more liquidity needed → less price impact
- Lower b → steeper curve → less capital needed → more price impact per trade

Recommended starting b for hackathon: 100 USDC
(Means ~$100 seed capital per market, reasonable price impact on $10-50 trades)
```

## Appendix B — Kelly Sizing Reference

```
For agent stake:
f* = (p × b - q) / b

Where:
p = agent's estimated P(yes)
b = net odds on bet (binary market: b = 1)
q = 1 - p

Simplified for binary: f* = p - (1-p) = 2p - 1

Apply fractional Kelly (0.25×) for conservatism:
stake = 0.25 × f* × vault_capital

Example: p=0.74, vault=$10,000
f* = 2(0.74) - 1 = 0.48
stake = 0.25 × 0.48 × 10,000 = $1,200 on YES
```
