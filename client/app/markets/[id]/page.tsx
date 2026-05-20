"use client";

import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { CONFIG } from "@/lib/config";
import { TradePanel } from "@/components/ui/TradePanel";
import { AgentStake } from "@/components/ui/AgentStake";
import { ResolutionBadge } from "@/components/ui/ResolutionBadge";
import { PriceChart } from "@/components/ui/PriceChart";
import { Globe2, ArrowLeft } from "lucide-react";
import Link from "next/link";

// Mock chart data
const mockChartData = Array.from({ length: 24 }).map((_, i) => ({
  time: `${i}:00`,
  price: 40 + Math.random() * 20 + (i * 0.5),
}));

export default function MarketDetailsPage() {
  const params = useParams();
  const id = params.id as string;

  const { data: market, isLoading } = useQuery({
    queryKey: ["market", id],
    queryFn: async () => {
      const res = await fetch(`${CONFIG.apiBaseUrl}/markets/${id}`);
      if (!res.ok) throw new Error("Failed to fetch market");
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-8">
        <div className="h-8 w-24 bg-white/10 rounded" />
        <div className="h-32 w-full bg-white/10 rounded-2xl" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            <div className="h-[400px] bg-white/10 rounded-2xl" />
            <div className="h-48 bg-white/10 rounded-2xl" />
          </div>
          <div className="h-[500px] bg-white/10 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!market) return <div className="text-center py-20">Market not found</div>;

  const pYes = Number(market.pYes);

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-20">
      <Link href="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors font-medium">
        <ArrowLeft className="w-4 h-4" /> Back to Markets
      </Link>

      {/* Header */}
      <div className="glass-panel p-8 md:p-10 border-primary/20 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -mr-10 -mt-10" />
        
        <div className="relative z-10">
          <div className="flex flex-wrap gap-3 mb-6">
            <span className="px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs uppercase font-bold tracking-wider border border-primary/20">
              {market.vertical.replace('-', ' ')}
            </span>
            <span className="px-3 py-1.5 rounded-full bg-white/5 text-foreground/70 text-xs uppercase font-bold tracking-wider flex items-center gap-1.5 border border-white/10">
              <Globe2 className="w-3.5 h-3.5" />
              Source: {market.sourceName} ({market.sourceLanguage.toUpperCase()})
            </span>
          </div>

          <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-8 leading-tight">
            {market.question}
          </h1>

          <div className="flex flex-wrap items-center justify-between gap-6 pt-6 border-t border-glass-border">
            <ResolutionBadge tier={market.oracleTier} deadline={market.resolutionDeadline} />
            <div className="text-sm">
              <span className="text-muted-foreground">Contract: </span>
              <a 
                href={`${CONFIG.chain.explorerUrl}/address/${market.contractAddress}`}
                target="_blank"
                rel="noreferrer"
                className="font-mono text-primary hover:underline"
              >
                {market.contractAddress ? `${market.contractAddress.slice(0, 6)}...${market.contractAddress.slice(-4)}` : 'Deploying...'}
              </a>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Chart & Info */}
        <div className="lg:col-span-2 space-y-8">
          <PriceChart data={mockChartData} />
          
          <AgentStake 
            confidence={Number(market.confidence)} 
            stakeAmount={Number(market.stakeAmount)} 
            stakeSide={market.stakeSide as "YES" | "NO"} 
          />

          <div className="glass-panel p-6">
            <h3 className="text-lg font-semibold mb-4">Resolution Criteria</h3>
            <p className="text-muted-foreground leading-relaxed">
              {market.resolutionCriteria}
            </p>
          </div>
        </div>

        {/* Right Column: Trade Panel */}
        <div className="lg:col-span-1">
          <div className="sticky top-24">
            <TradePanel 
              marketId={market.marketId} 
              pYes={pYes} 
            />
          </div>
        </div>
      </div>
    </div>
  );
}
