export const CONFIG = {
  apiBaseUrl: process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api",
  contracts: {
    marketFactory: "0xc626eba3f91d97e9c94ca20cf1449e5857d4f082",
    agentVault: "0xd37670aca0a61df9123713d7b21b3af9e15f7466",
    usdc: "0x3600000000000000000000000000000000000000",
    eurc: "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a",
  },
  chain: {
    id: 5042002,
    name: "Arc Testnet",
    rpcUrl: process.env.NEXT_PUBLIC_ARC_RPC_URL || "https://rpc.testnet.arc-node.thecanteenapp.com/v1",
    explorerUrl: "https://explorer.testnet.arc-node.thecanteenapp.com",
  },
};
