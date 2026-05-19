# Meridian

**Skin-in-the-Game Translation Markets on Arc**

Meridian is a self-sustaining prediction market factory for non-English financial and geopolitical events. An autonomous AI agent monitors foreign-language news, structures prediction market questions, stakes USDC on its own probability estimates, bootstraps liquidity as an AMM, and earns builder fees per fill.

> **Hackathon:** Agora Agents Hackathon — Canteen × Circle | May 11–25, 2026

## How It Works

1. **News Ingestion** — RSS feeds in Arabic, Mandarin, Portuguese, Korean, Swahili, and more
2. **AI Translation** — Claude API translates and structures binary prediction questions
3. **Market Creation** — Agent deploys LMSR prediction markets on Arc via `MarketFactory`
4. **Skin-in-the-Game** — Agent stakes its own capital (Kelly-sized) as a verifiable confidence signal
5. **Resolution** — Markets resolve via Chainlink/Pyth price feeds (Tier 1) or admin verification (Tier 2)
6. **Yield** — Idle capital earns yield in USYC (Circle's tokenized money market fund)

## Tech Stack

| Layer | Technology |
| :--- | :--- |
| **Blockchain** | Arc L1 (Circle) |
| **Smart Contracts** | Solidity, Foundry, OpenZeppelin, PRBMath |
| **Collateral** | USDC + EURC (6 decimals) |
| **Yield** | USYC via Teller |
| **Agent Backend** | NestJS |
| **AI** | Claude API (translation + structuring) |
| **Oracles** | Chainlink, Pyth |
| **Frontend** | Next.js, Tailwind, Wagmi |
| **Wallets** | Circle Programmable Wallets |

## Project Structure

```
meridian/
├── contracts/          # Solidity smart contracts (Foundry)
│   ├── src/            # PredictionMarket, MarketFactory, AgentVault, ResolutionOracle
│   ├── test/           # Foundry test suite (79 tests)
│   └── script/         # Deployment scripts
├── server/             # NestJS agent backend (Phase 3)
├── client/             # Next.js frontend (Phase 4)
└── meridian-prd-trd.md # Product & Technical Requirements
```

## Deployed Contracts (Arc Testnet)

| Contract | Address |
| :--- | :--- |
| **ResolutionOracle** | `0x3379CdE825960C49b456c62f6bb485902B7dA830` |
| **MarketFactory** | `0xF3DeE532B0d0d29c4E4B64b004b7f286E1Cf9814` |
| **AgentVault** | `0x18453c5914ce22F9a9c2022b24eF3Bf16eb21a71` |

See [`contracts/README.md`](./contracts/README.md) for full deployment details and external dependency addresses.

## Getting Started

### Smart Contracts

```bash
cd contracts
forge build
forge test
```

### Deployment

```bash
cd contracts
source .env
forge script script/DeployMeridian.s.sol:DeployMeridian --rpc-url $ARC_RPC_URL --broadcast -vvvv
```

## License

MIT
