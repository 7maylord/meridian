export default () => ({
  // Arc Testnet
  arc: {
    rpcUrl: process.env.ARC_RPC_URL,
    chainId: 5042002,
  },

  // Deployed Contracts
  contracts: {
    resolutionOracle: '0x27ff14E3E3580De92538427190A02da105B438A5',
    marketFactory: '0x90b9f05f1BD2f71463b2BbF2d433C8bA001bEB50',
    agentVault: '0x08bA64Ee4C58884B9cDd2917997Fd0B60D616519',
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

  // ERC-8004 Agent Identity (Arc Testnet)
  erc8004: {
    identityRegistry: '0x8004A818BFB912233c491871b3d84c89A494BD9e',
    reputationRegistry: '0x8004B663056A597Dffe9eCcC1965A193B7388713',
    validationRegistry: '0x8004Cb1BF31DAf7788923b405b754f57acEB4272',
    agentId: process.env.ERC8004_AGENT_ID, // Set after first registration
    metadataUri:
      process.env.ERC8004_METADATA_URI ||
      'ipfs://bafkreibdi6623n3xpf7ymk62ckb4bo75o3qemwkpfvp5i25j66itxvsoei',
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
