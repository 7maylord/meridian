export const CONFIG = {
  apiBaseUrl: process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api",
  contracts: {
    marketFactory: "0x2276EcD90c1E8A8939C70c8F70dcE69C3c2704f6",
    agentVault: "0x31f85C18172BAA5d796Ff140D8dB4799bcF1a8BF",
    resolutionOracle: "0x0bdE05DBFf1706586F5a499b4aA68A07E301ba0f",
    usdc: "0x3600000000000000000000000000000000000000",
    eurc: "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a",
  },
  chain: {
    id: 5042002,
    name: "Arc Testnet",
    rpcUrl: process.env.NEXT_PUBLIC_ARC_RPC_URL || "https://rpc.testnet.arc-node.thecanteenapp.com/v1",
    explorerUrl: "https://testnet.arcscan.app",
  },
};
