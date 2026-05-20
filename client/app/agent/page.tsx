"use client";

import { useQuery } from "@tanstack/react-query";
import { CONFIG } from "@/lib/config";
import { formatUSDC } from "@/lib/utils";
import { Brain, Target, Trophy, Activity, ArrowUpRight } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

// Mock calibration history
const mockCalibrationData = [
  { month: "Jan", brierScore: 0.12 },
  { month: "Feb", brierScore: 0.11 },
  { month: "Mar", brierScore: 0.09 },
  { month: "Apr", brierScore: 0.08 },
  { month: "May", brierScore: 0.07 },
];

export default function AgentActivityPage() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["agentStats"],
    queryFn: async () => {
      const res = await fetch(`${CONFIG.apiBaseUrl}/agent/stats`);
      if (!res.ok) throw new Error("Failed to fetch stats");
      return res.json();
    },
  });

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
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="glass-panel p-6">
          <div className="flex items-center gap-2 text-muted-foreground mb-3">
            <Target className="w-4 h-4" /> Brier Score
          </div>
          <div className="text-3xl font-bold text-primary">0.07</div>
          <div className="text-xs text-primary/80 mt-1 flex items-center gap-1">
            <ArrowUpRight className="w-3 h-3" /> Top 5% of forecasters
          </div>
        </div>

        <div className="glass-panel p-6">
          <div className="flex items-center gap-2 text-muted-foreground mb-3">
            <Trophy className="w-4 h-4" /> Win Rate
          </div>
          <div className="text-3xl font-bold">{stats?.winRate || "68.4%"}</div>
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="glass-panel p-6 h-[400px]">
          <h3 className="text-lg font-semibold mb-6">Historical Calibration (Brier Score)</h3>
          <p className="text-xs text-muted-foreground mb-6">
            Lower is better. A score of 0.0 indicates perfect forecasting accuracy.
          </p>
          <div className="w-full h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={mockCalibrationData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="month" stroke="rgba(255,255,255,0.4)" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="rgba(255,255,255,0.4)" fontSize={12} tickLine={false} axisLine={false} domain={[0, 0.25]} />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'rgba(9, 9, 11, 0.9)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                  itemStyle={{ color: '#10b981' }}
                />
                <Line type="monotone" dataKey="brierScore" stroke="#10b981" strokeWidth={3} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass-panel p-6">
          <h3 className="text-lg font-semibold mb-6">Recent Translations & Decisions</h3>
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-white/5 border border-white/5">
              <div className="flex justify-between items-start mb-2">
                <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-1 rounded">DEPLOYED</span>
                <span className="text-xs text-muted-foreground">2 mins ago</span>
              </div>
              <p className="text-sm font-medium mb-1">"Will the PBOC cut the RRR by 50bps before Q3?"</p>
              <p className="text-xs text-muted-foreground">Source: Caixin (Mandarin) • Confidence: 82%</p>
            </div>
            
            <div className="p-4 rounded-xl bg-white/5 border border-white/5 opacity-70">
              <div className="flex justify-between items-start mb-2">
                <span className="text-xs font-medium text-muted-foreground bg-white/10 px-2 py-1 rounded">REJECTED</span>
                <span className="text-xs text-muted-foreground">15 mins ago</span>
              </div>
              <p className="text-sm font-medium mb-1">"Will Brazil increase import tariffs on EVs?"</p>
              <p className="text-xs text-muted-foreground">Reason: Confidence 45% (Below 65% threshold)</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
