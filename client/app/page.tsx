"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MarketCard, MarketCardProps } from "@/components/ui/MarketCard";
import { CONFIG } from "@/lib/config";
import { Search, Filter } from "lucide-react";
import { cn } from "@/lib/utils";

const VERTICALS = ["all", "central-bank", "fx-direction", "trade-policy"] as const;
type Vertical = (typeof VERTICALS)[number];

export default function MarketDiscoveryPage() {
  const [search, setSearch] = useState("");
  const [vertical, setVertical] = useState<Vertical>("all");

  const { data: markets, isLoading } = useQuery({
    queryKey: ["markets"],
    queryFn: async () => {
      const res = await fetch(`${CONFIG.apiBaseUrl}/markets`);
      if (!res.ok) throw new Error("Failed to fetch markets");
      const data = await res.json();

      return data.map((m: Record<string, unknown>) => ({
        id: m.id,
        question: m.question,
        pYes: Number(m.pYes),
        poolSize: Number(m.stakeAmount || 0) * 1e6 * 2,
        oracleTier: m.oracleTier,
        resolutionDeadline: m.resolutionDeadline,
        sourceLanguage: m.sourceLanguage,
        vertical: m.vertical,
      })) as MarketCardProps[];
    },
  });

  const filtered = useMemo(() => {
    if (!markets) return [];
    const q = search.toLowerCase();
    return markets.filter((m) => {
      const matchesSearch = !q || m.question.toLowerCase().includes(q);
      const matchesVertical = vertical === "all" || m.vertical === vertical;
      return matchesSearch && matchesVertical;
    });
  }, [markets, search, vertical]);

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
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-glass border border-glass-border rounded-xl pl-10 pr-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all text-sm"
          />
        </div>

        <div className="flex gap-2 w-full sm:w-auto overflow-x-auto pb-1">
          <Filter className="w-4 h-4 text-muted-foreground shrink-0 self-center" />
          {VERTICALS.map((v) => (
            <button
              key={v}
              onClick={() => setVertical(v)}
              className={cn(
                "shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap",
                vertical === v
                  ? "bg-primary text-primary-foreground"
                  : "glass-panel text-muted-foreground hover:text-foreground",
              )}
            >
              {v === "all" ? "All" : v.replace(/-/g, " ")}
            </button>
          ))}
        </div>
      </div>

      {/* Result count */}
      {!isLoading && markets && (
        <p className="text-sm text-muted-foreground">
          {filtered.length} of {markets.length} market{markets.length !== 1 ? "s" : ""}
        </p>
      )}

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="glass-panel h-[300px]" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground glass-panel">
          {markets?.length === 0
            ? "No active markets found. The agent is currently polling feeds."
            : "No markets match your search."}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((market) => (
            <MarketCard key={market.id} {...market} />
          ))}
        </div>
      )}
    </div>
  );
}
