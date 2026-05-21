"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useAccount, useReadContracts, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { useQuery } from "@tanstack/react-query";
import type { Abi } from "viem";
import { CONFIG } from "@/lib/config";
import { MERIDIAN_MARKET_ABI } from "@/lib/abis";
import { Wallet, History, AlertCircle, Loader2, TrendingUp, TrendingDown } from "lucide-react";
import { useState } from "react";

interface ApiMarket {
  id: string;
  marketId: number;
  question: string;
  pYes: number;
  status: string;
  outcome: boolean | null;
  resolutionDeadline: string;
}

interface Position {
  market: ApiMarket;
  yesShares: bigint;
  noShares: bigint;
}

export default function PortfolioPage() {
  const { ready, authenticated, login } = usePrivy();
  const { address } = useAccount();
  const isConnected = ready && authenticated && !!address;

  const [claimingId, setClaimingId] = useState<number | null>(null);

  const { writeContract, data: claimHash } = useWriteContract();
  const { isLoading: isClaimConfirming, isSuccess: isClaimConfirmed } =
    useWaitForTransactionReceipt({ hash: claimHash });

  // 1. Fetch all markets from backend
  const { data: markets = [] } = useQuery<ApiMarket[]>({
    queryKey: ["markets-portfolio"],
    queryFn: async () => {
      const res = await fetch(`${CONFIG.apiBaseUrl}/markets`);
      if (!res.ok) throw new Error("Failed to fetch markets");
      return res.json();
    },
    enabled: isConnected,
  });

  const activeMarkets = markets.filter(
    (m) => m.marketId != null && m.marketId >= 0,
  );

  // 2. Batch read getUserPosition for all markets
  const positionCalls = activeMarkets.map((m) => ({
    address: CONFIG.contracts.marketFactory as `0x${string}`,
    abi: MERIDIAN_MARKET_ABI as Abi,
    functionName: "getUserPosition" as const,
    args: [BigInt(m.marketId), address!] as [bigint, `0x${string}`],
  }));

  const { data: positionResults, isLoading: positionsLoading } = useReadContracts({
    contracts: positionCalls,
    query: { enabled: isConnected && activeMarkets.length > 0 },
  });

  // 3. Combine into positions array — filter out zero balances
  const positions: Position[] = activeMarkets
    .map((market, i) => {
      const result = positionResults?.[i];
      if (result?.status !== "success") return null;
      const [yesShares, noShares] = result.result as [bigint, bigint];
      if (yesShares === BigInt(0) && noShares === BigInt(0)) return null;
      return { market, yesShares, noShares };
    })
    .filter((p): p is Position => p !== null);

  const activePositions = positions.filter((p) => p.market.status !== "resolved");
  const resolvedPositions = positions.filter((p) => p.market.status === "resolved");

  const handleClaim = (marketId: number) => {
    setClaimingId(marketId);
    writeContract({
      address: CONFIG.contracts.marketFactory as `0x${string}`,
      abi: MERIDIAN_MARKET_ABI,
      functionName: "claim",
      args: [BigInt(marketId)],
    });
  };

  const userWon = (p: Position): boolean => {
    if (p.market.outcome === null) return false;
    return p.market.outcome ? p.yesShares > BigInt(0) : p.noShares > BigInt(0);
  };

  const formatShares = (shares: bigint) =>
    (Number(shares) / 1e18).toFixed(4);

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] max-w-md mx-auto text-center space-y-6">
        <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
          <Wallet className="w-10 h-10" />
        </div>
        <h1 className="text-3xl font-bold">Connect Wallet</h1>
        <p className="text-muted-foreground leading-relaxed">
          Connect your wallet to view your active predictions, claim payouts, and track your performance.
        </p>
        <button
          onClick={() => login()}
          className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold px-8 py-3 rounded-xl transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)] flex items-center gap-2"
        >
          <Wallet className="w-4 h-4" />
          Connect Wallet
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      <div className="flex justify-between items-end mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-2">Portfolio</h1>
          <p className="text-muted-foreground font-mono text-sm">
            {address?.slice(0, 6)}...{address?.slice(-4)}
          </p>
        </div>
        <div className="text-right">
          <div className="text-sm text-muted-foreground mb-1">Positions</div>
          <div className="text-3xl font-bold text-primary font-mono">
            {positionsLoading ? <Loader2 className="w-6 h-6 animate-spin inline" /> : positions.length}
          </div>
        </div>
      </div>

      {isClaimConfirmed && (
        <div className="bg-primary/10 border border-primary/30 rounded-xl px-4 py-3 text-primary text-sm font-medium">
          Winnings claimed successfully!
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Active Positions */}
        <div className="glass-panel p-6 md:col-span-2">
          <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
            <History className="w-5 h-5 text-primary" /> Active Positions
          </h3>

          {positionsLoading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading positions...
            </div>
          ) : activePositions.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground border border-dashed border-white/10 rounded-xl bg-white/5">
              You don&apos;t have any active positions.
            </div>
          ) : (
            <div className="space-y-4">
              {activePositions.map((p) => (
                <div
                  key={p.market.id}
                  className="bg-white/5 rounded-xl p-4 border border-white/10"
                >
                  <p className="text-sm font-medium mb-3 leading-snug">
                    {p.market.question}
                  </p>
                  <div className="flex items-center gap-4 text-sm">
                    {p.yesShares > BigInt(0) && (
                      <span className="flex items-center gap-1 text-primary font-mono">
                        <TrendingUp className="w-3.5 h-3.5" />
                        {formatShares(p.yesShares)} YES
                      </span>
                    )}
                    {p.noShares > BigInt(0) && (
                      <span className="flex items-center gap-1 text-red-400 font-mono">
                        <TrendingDown className="w-3.5 h-3.5" />
                        {formatShares(p.noShares)} NO
                      </span>
                    )}
                    <span className="text-muted-foreground ml-auto text-xs">
                      Resolves {new Date(p.market.resolutionDeadline).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pending Resolution / Claim */}
        <div className="glass-panel p-6">
          <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-orange-400" /> Claimable
          </h3>

          {resolvedPositions.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground border border-dashed border-white/10 rounded-xl bg-white/5">
              No markets pending claim.
            </div>
          ) : (
            <div className="space-y-4">
              {resolvedPositions.map((p) => {
                const won = userWon(p);
                const isClaiming =
                  claimingId === p.market.marketId && isClaimConfirming;
                return (
                  <div
                    key={p.market.id}
                    className="bg-white/5 rounded-xl p-4 border border-white/10"
                  >
                    <p className="text-xs font-medium mb-2 leading-snug text-foreground/80">
                      {p.market.question}
                    </p>
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-xs font-bold px-2 py-0.5 rounded-full ${won ? "bg-primary/20 text-primary" : "bg-red-500/20 text-red-400"}`}
                      >
                        {won ? "WON" : "LOST"}
                      </span>
                      {won && (
                        <button
                          onClick={() => handleClaim(p.market.marketId)}
                          disabled={isClaiming}
                          className="text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-bold px-3 py-1.5 rounded-lg transition-all disabled:opacity-50 flex items-center gap-1"
                        >
                          {isClaiming ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : null}
                          Claim
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
