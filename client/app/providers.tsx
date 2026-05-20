"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createConfig, http, WagmiProvider } from "wagmi";
import { defineChain } from "viem";
import { CONFIG } from "../lib/config";
import { useState } from "react";

const arcTestnet = defineChain({
  id: CONFIG.chain.id,
  name: CONFIG.chain.name,
  network: "arc-testnet",
  nativeCurrency: {
    decimals: 18,
    name: "Ethereum",
    symbol: "ETH",
  },
  rpcUrls: {
    default: { http: [CONFIG.chain.rpcUrl] },
    public: { http: [CONFIG.chain.rpcUrl] },
  },
  blockExplorers: {
    default: { name: "ArcExplorer", url: CONFIG.chain.explorerUrl },
  },
});

const config = createConfig({
  chains: [arcTestnet],
  transports: {
    [arcTestnet.id]: http(),
  },
});

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  );
}
