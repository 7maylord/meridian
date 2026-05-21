git "use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { usePrivy } from "@privy-io/react-auth";
import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { CONFIG } from "@/lib/config";
import { RESOLUTION_ORACLE_ABI } from "@/lib/abis";
import { ShieldAlert, ShieldCheck, Loader2, Check, X } from "lucide-react";

interface MarketEntry {
  id: string;
  marketId: number;
  question: string;
  status: string;
  oracleTier: number;
  resolutionDeadline: string;
}

export default function AdminResolutionPage() {
  const { ready, authenticated, login, user } = usePrivy();
  const address = user?.wallet?.address;
  const isConnected = ready && authenticated;

  // 1. Check if the connected user is a verifier
  const { data: isVerifier, isLoading: isVerifierLoading } = useReadContract({
    address: CONFIG.contracts.resolutionOracle as `0x${string}`,
    abi: RESOLUTION_ORACLE_ABI,
    functionName: "verifiers",
    args: address ? [address as `0x${string}`] : undefined,
    query: {
      enabled: !!address,
    },
  });

  // 2. Fetch markets
  const { data: markets, isLoading: marketsLoading, refetch } = useQuery({
    queryKey: ["markets"],
    queryFn: async () => {
      const res = await fetch(`${CONFIG.apiBaseUrl}/markets`);
      if (!res.ok) throw new Error("Failed to fetch markets");
      return res.json() as Promise<MarketEntry[]>;
    },
  });

  // Filter pending resolutions: Active markets that have passed deadline and are Tier 2 (Admin)
  const pendingResolutions = markets?.filter(
    (m) =>
      m.status === "active" &&
      m.oracleTier === 2 && // Admin tier
      new Date(m.resolutionDeadline) <= new Date()
  ) || [];

  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<boolean>(false);

  const { writeContractAsync } = useWriteContract();

  const handleResolve = async (market: MarketEntry, marketOutcome: boolean) => {
    try {
      setResolvingId(market.id);
      setOutcome(marketOutcome);

      // 1. On-chain resolution
      const hash = await writeContractAsync({
        address: CONFIG.contracts.resolutionOracle as `0x${string}`,
        abi: RESOLUTION_ORACLE_ABI,
        functionName: "resolveAdmin",
        args: [BigInt(market.marketId), marketOutcome],
      });

      // Simple wait (in a production app, use useWaitForTransactionReceipt effectively)
      console.log("Transaction submitted:", hash);

      // 2. Sync with backend API
      const res = await fetch(`${CONFIG.apiBaseUrl}/markets/${market.id}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outcome: marketOutcome }),
      });

      if (!res.ok) throw new Error("Failed to sync resolution with backend");

      // Refetch markets
      await refetch();
    } catch (err) {
      console.error("Resolution failed:", err);
      alert("Failed to resolve market. Check console for details.");
    } finally {
      setResolvingId(null);
    }
  };

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] max-w-md mx-auto text-center space-y-6">
        <div className="w-20 h-20 rounded-full bg-red-500/10 flex items-center justify-center text-red-500 border border-red-500/20">
          <ShieldAlert className="w-10 h-10" />
        </div>
        <h1 className="text-3xl font-bold">Admin Resolution</h1>
        <p className="text-muted-foreground leading-relaxed">
          Connect your authorized verifier wallet to resolve Tier 2 prediction markets.
        </p>
        <button
          onClick={() => login()}
          className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold px-8 py-3 rounded-xl transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)] flex items-center gap-2"
        >
          Connect Wallet
        </button>
      </div>
    );
  }

  if (isVerifierLoading || marketsLoading) {
    return <div className="flex justify-center items-center h-64"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  if (!isVerifier) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] max-w-md mx-auto text-center space-y-6">
        <div className="w-20 h-20 rounded-full bg-red-500/10 flex items-center justify-center text-red-500 border border-red-500/20">
          <ShieldAlert className="w-10 h-10" />
        </div>
        <h1 className="text-3xl font-bold text-red-500">Access Denied</h1>
        <p className="text-muted-foreground leading-relaxed">
          Your connected wallet <span className="font-mono text-xs block mt-2 text-white/70">{address}</span> is not an authorized verifier on the ResolutionOracle contract.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div className="flex items-center gap-4 mb-8">
        <div className="w-16 h-16 rounded-2xl bg-blue-500/20 flex items-center justify-center text-blue-400 border border-blue-500/30 shadow-[0_0_30px_rgba(59,130,246,0.2)]">
          <ShieldCheck className="w-8 h-8" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Admin Resolution</h1>
          <p className="text-muted-foreground">Resolve Tier 2 markets securely on-chain.</p>
        </div>
      </div>

      <div className="glass-panel p-6">
        <h3 className="text-lg font-semibold mb-6">Pending Resolutions ({pendingResolutions.length})</h3>
        
        {pendingResolutions.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground border border-dashed border-white/10 rounded-xl bg-white/5">
            No markets are currently awaiting admin resolution.
          </div>
        ) : (
          <div className="space-y-4">
            {pendingResolutions.map((market) => {
              const isResolvingThis = resolvingId === market.id;
              
              return (
                <div key={market.id} className="p-5 rounded-xl bg-white/5 border border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex-1">
                    <div className="text-xs text-primary font-medium mb-1">Market #{market.marketId}</div>
                    <p className="font-semibold text-lg leading-tight mb-2">{market.question}</p>
                    <p className="text-xs text-muted-foreground">
                      Deadline passed: {new Date(market.resolutionDeadline).toLocaleString()}
                    </p>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handleResolve(market, true)}
                      disabled={resolvingId !== null}
                      className="bg-primary/20 hover:bg-primary/40 text-primary border border-primary/50 font-bold px-4 py-2 rounded-lg transition-all flex items-center gap-2 disabled:opacity-50"
                    >
                      {isResolvingThis && outcome === true ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                      Resolve YES
                    </button>
                    
                    <button
                      onClick={() => handleResolve(market, false)}
                      disabled={resolvingId !== null}
                      className="bg-red-500/20 hover:bg-red-500/40 text-red-400 border border-red-500/50 font-bold px-4 py-2 rounded-lg transition-all flex items-center gap-2 disabled:opacity-50"
                    >
                      {isResolvingThis && outcome === false ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
                      Resolve NO
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
