"use client";

import { PrivyProvider } from "@privy-io/react-auth";
import { WagmiProvider, createConfig } from "@privy-io/wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http } from "wagmi";
import { defineChain } from "viem";
import { CONFIG } from "@/lib/config";
import { useState } from "react";

// Define Arc Testnet
const arcTestnet = defineChain({
  id: CONFIG.chain.id,
  name: CONFIG.chain.name,
  network: "arc-testnet",
  nativeCurrency: {
    decimals: 6,
    name: "USD Coin",
    symbol: "USDC",
  },
  rpcUrls: {
    default: { http: [CONFIG.chain.rpcUrl] },
  },
  blockExplorers: {
    default: { name: "ArcExplorer", url: CONFIG.chain.explorerUrl },
  },
});

const wagmiConfig = createConfig({
  chains: [arcTestnet],
  transports: {
    [arcTestnet.id]: http(CONFIG.chain.rpcUrl),
  },
});

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <PrivyProvider
      appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID || ""}
      config={{
        appearance: {
          theme: "dark",
          accentColor: "#10b981",
        },
        defaultChain: arcTestnet,
        supportedChains: [arcTestnet],
        embeddedWallets: {
          ethereum: {
            createOnLogin: "users-without-wallets",
          },
        },
      }}
    >
      <QueryClientProvider client={queryClient}>
        <WagmiProvider config={wagmiConfig}>
          {children}
        </WagmiProvider>
      </QueryClientProvider>
    </PrivyProvider>
  );
}
