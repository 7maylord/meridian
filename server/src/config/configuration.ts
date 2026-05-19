export default () => ({
  // Arc Testnet
  arc: {
    rpcUrl: process.env.ARC_RPC_URL,
    chainId: 5042002,
  },

  // Deployed Contracts
  contracts: {
    resolutionOracle: '0x3379CdE825960C49b456c62f6bb485902B7dA830',
    marketFactory: '0xF3DeE532B0d0d29c4E4B64b004b7f286E1Cf9814',
    agentVault: '0x18453c5914ce22F9a9c2022b24eF3Bf16eb21a71',
    usdc: '0x3600000000000000000000000000000000000000',
    eurc: '0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a',
    usyc: '0xe9185F0c5F296Ed1797AaE4238D26CCaBEadb86C',
    teller: '0x9fdF14c5B14173D74C08Af27AebFf39240dC105A',
  },

  // Circle Wallets
  circle: {
    apiKey: process.env.CIRCLE_API_KEY,
    entitySecret: process.env.CIRCLE_ENTITY_SECRET,
    walletId: process.env.CIRCLE_WALLET_ID, // Set after first run
  },

  // Claude AI
  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY,
  },

  // Database (Supabase)
  database: {
    url: process.env.DATABASE_URL,
  },

  // Agent Parameters
  agent: {
    minConfidence: 0.65,
    minLiquidity: 100, // minimum USDC in vault to deploy
    pollIntervalMs: 15 * 60 * 1000, // 15 minutes
    defaultBParam: '100000000000000000000', // 100e18
  },
});
