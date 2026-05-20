export const CONFIG = {
  apiBaseUrl: process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api",
  contracts: {
    marketFactory: "0xF3DeE532B0d0d29c4E4B64b004b7f286E1Cf9814",
    agentVault: "0x18453c5914ce22F9a9c2022b24eF3Bf16eb21a71",
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
