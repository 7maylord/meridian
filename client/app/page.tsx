"use client";

import { useQuery } from "@tanstack/react-query";
import { MarketCard, MarketCardProps } from "@/components/ui/MarketCard";
import { CONFIG } from "@/lib/config";
import { Search, Filter } from "lucide-react";

export default function MarketDiscoveryPage() {
  const { data: markets, isLoading } = useQuery({
    queryKey: ["markets"],
    queryFn: async () => {
      const res = await fetch(`${CONFIG.apiBaseUrl}/markets`);
      if (!res.ok) throw new Error("Failed to fetch markets");
      const data = await res.json();
      
      // Transform backend entity to frontend props
      return data.map((m: any) => ({
        id: m.id,
        question: m.question,
        pYes: Number(m.pYes),
        poolSize: Number(m.stakeAmount || 0) * 1e6 * 2, // Mock pool size for display
        oracleTier: m.oracleTier,
        resolutionDeadline: m.resolutionDeadline,
        sourceLanguage: m.sourceLanguage,
        vertical: m.vertical,
      })) as MarketCardProps[];
    },
  });

  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <section className="relative overflow-hidden rounded-3xl glass-panel p-8 md:p-12 border-primary/20">
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
        <div className="relative z-10 max-w-2xl">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
            Trade on the truth, <br />
            <span className="text-primary">before it translates.</span>
          </h1>
          <p className="text-lg text-foreground/80 mb-8 leading-relaxed">
            Meridian uses autonomous AI agents to parse foreign financial news in real-time,
            creating predictive markets before the information hits English-speaking wire services.
          </p>
        </div>
      </section>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-center">
        <div className="relative w-full sm:max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input 
            type="text" 
            placeholder="Search markets..." 
            className="w-full bg-glass border border-glass-border rounded-xl pl-10 pr-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all text-sm"
          />
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <button className="flex-1 sm:flex-none glass-panel px-4 py-2.5 text-sm font-medium hover:bg-white/5 transition-colors flex items-center justify-center gap-2">
            <Filter className="w-4 h-4" /> Filters
          </button>
        </div>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="glass-panel h-[300px]" />
          ))}
        </div>
      ) : markets?.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground glass-panel">
          No active markets found. The agent is currently polling feeds.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {markets?.map((market) => (
            <MarketCard key={market.id} {...market} />
          ))}
        </div>
      )}
    </div>
  );
}
