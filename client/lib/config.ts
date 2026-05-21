export const CONFIG = {
  apiBaseUrl: process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api",
  contracts: {
    marketFactory: "0x90b9f05f1BD2f71463b2BbF2d433C8bA001bEB50",
    agentVault: "0x08bA64Ee4C58884B9cDd2917997Fd0B60D616519",
    resolutionOracle: "0x27ff14E3E3580De92538427190A02da105B438A5",
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
