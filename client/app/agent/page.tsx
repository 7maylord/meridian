"use client";

import { useQuery } from "@tanstack/react-query";
import { CONFIG } from "@/lib/config";
import { Brain, Target, Trophy, Activity, ArrowUpRight, CheckCircle, XCircle } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface MarketEntry {
  id: string;
  question: string;
  pYes: number;
  confidence: number;
  sourceLanguage: string;
  sourceName: string;
  status: string;
  stakeSide: string;
  stakeAmount: number;
  createdAt: string;
}

export default function AgentActivityPage() {
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["agentStats"],
    queryFn: async () => {
      const res = await fetch(`${CONFIG.apiBaseUrl}/agent/stats`);
      if (!res.ok) throw new Error("Failed to fetch stats");
      return res.json();
    },
  });

  const { data: markets, isLoading: marketsLoading } = useQuery({
    queryKey: ["markets"],
    queryFn: async () => {
      const res = await fetch(`${CONFIG.apiBaseUrl}/markets`);
      if (!res.ok) throw new Error("Failed to fetch markets");
      return res.json() as Promise<MarketEntry[]>;
    },
  });

  const isLoading = statsLoading || marketsLoading;

  if (isLoading) {
    return <div className="animate-pulse h-[600px] w-full bg-white/5 rounded-3xl" />;
  }

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      <div className="flex items-center gap-4 mb-8">
        <div className="w-16 h-16 rounded-2xl bg-primary/20 flex items-center justify-center text-primary border border-primary/30 shadow-[0_0_30px_rgba(16,185,129,0.2)]">
          <Brain className="w-8 h-8" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Meridian Alpha Agent</h1>
          <p className="text-muted-foreground">Autonomous market maker & translator</p>
          {stats?.walletAddress && (
            <p className="text-xs font-mono text-primary/70 mt-1">
              {stats.walletAddress.slice(0, 6)}...{stats.walletAddress.slice(-4)}
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="glass-panel p-6">
          <div className="flex items-center gap-2 text-muted-foreground mb-3">
            <Target className="w-4 h-4" /> Markets Created
          </div>
          <div className="text-3xl font-bold text-primary">{stats?.totalMarketsCreated || 0}</div>
          <div className="text-xs text-primary/80 mt-1 flex items-center gap-1">
            <ArrowUpRight className="w-3 h-3" /> Active autonomous loop
          </div>
        </div>

        <div className="glass-panel p-6">
          <div className="flex items-center gap-2 text-muted-foreground mb-3">
            <Trophy className="w-4 h-4" /> Win Rate
          </div>
          <div className="text-3xl font-bold">{stats?.winRate || "N/A"}</div>
          <div className="text-xs text-muted-foreground mt-1">
            Across {stats?.totalMarketsResolved || 0} resolved markets
          </div>
        </div>

        <div className="glass-panel p-6">
          <div className="flex items-center gap-2 text-muted-foreground mb-3">
            <Activity className="w-4 h-4" /> Available Capital
          </div>
          <div className="text-3xl font-bold font-mono">${stats?.availableCapital || "0.00"}</div>
          <div className="text-xs text-muted-foreground mt-1">
            Active Vault Balance
          </div>
        </div>

        <div className="glass-panel p-6 border-blue-500/20">
          <div className="flex items-center gap-2 text-blue-400 mb-3">
            <Activity className="w-4 h-4" /> Idle Capital Yield
          </div>
          <div className="text-3xl font-bold font-mono text-blue-400">${stats?.usycBalance || "0.00"}</div>
          <div className="text-xs text-blue-400/80 mt-1">
            Deployed in Circle USYC
          </div>
        </div>
      </div>

      {/* Recent Translations & Decisions — from real market data */}
      <div className="glass-panel p-6">
        <h3 className="text-lg font-semibold mb-6">Recent Market Deployments</h3>
        <div className="space-y-3">
          {markets && markets.length > 0 ? (
            markets.slice(0, 10).map((m) => (
              <div key={m.id} className="p-4 rounded-xl bg-white/5 border border-white/5 hover:border-primary/20 transition-colors">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-1 rounded flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" /> DEPLOYED
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(m.createdAt).toLocaleString()}
                  </span>
                </div>
                <p className="text-sm font-medium mb-1">&ldquo;{m.question}&rdquo;</p>
                <div className="flex flex-wrap gap-3 text-xs text-muted-foreground mt-2">
                  <span>Source: {m.sourceName} ({m.sourceLanguage})</span>
                  <span>•</span>
                  <span>p(YES) = {(Number(m.pYes) * 100).toFixed(0)}%</span>
                  <span>•</span>
                  <span>Stake: ${(Number(m.stakeAmount) || 0).toFixed(2)} {m.stakeSide}</span>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-12 text-muted-foreground border border-dashed border-white/10 rounded-xl bg-white/5">
              No markets deployed yet. The agent loop runs every 10 minutes.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
