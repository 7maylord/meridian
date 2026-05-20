"use client";

import { usePrivy } from "@privy-io/react-auth";
import { formatUSDC } from "@/lib/utils";
import { Wallet, History, AlertCircle, Loader2 } from "lucide-react";

export default function PortfolioPage() {
  const { ready, authenticated, login, user } = usePrivy();
  const address = user?.wallet?.address;
  const isConnected = ready && authenticated;

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] max-w-md mx-auto text-center space-y-6">
        <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
          <Wallet className="w-10 h-10" />
        </div>
        <h1 className="text-3xl font-bold">Connect Wallet</h1>
        <p className="text-muted-foreground leading-relaxed">
          Connect your wallet to view your active predictions, claim payouts, and track your historical performance against the agent.
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
          <div className="text-sm text-muted-foreground mb-1">Total Value</div>
          <div className="text-3xl font-bold text-primary font-mono">$0.00</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass-panel p-6 md:col-span-2">
          <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
            <History className="w-5 h-5 text-primary" /> Active Positions
          </h3>
          
          <div className="text-center py-12 text-muted-foreground border border-dashed border-white/10 rounded-xl bg-white/5">
            You don't have any active positions.
          </div>
        </div>

        <div className="glass-panel p-6">
          <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-orange-400" /> Pending Resolution
          </h3>
          
          <div className="text-center py-12 text-muted-foreground border border-dashed border-white/10 rounded-xl bg-white/5">
            No markets pending resolution.
          </div>
        </div>
      </div>
    </div>
  );
}
