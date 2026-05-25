"use client";

import { useMemo, useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { MarketCard, MarketCardProps } from "@/components/ui/MarketCard";
import { CONFIG } from "@/lib/config";
import { Search, Filter, Lock, Bot, TrendingUp, Globe2, Zap, ArrowRight, Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";

const VERTICALS = ["all", "central-bank", "fx-direction", "trade-policy"] as const;
type Vertical = (typeof VERTICALS)[number];

const X402_ENDPOINT = "https://meridian-hbnz.onrender.com/api/markets/:id/recommendation";

export default function MarketDiscoveryPage() {
  const [search, setSearch] = useState("");
  const [vertical, setVertical] = useState<Vertical>("all");
  const [copied, setCopied] = useState(false);

  const copyEndpoint = useCallback(() => {
    navigator.clipboard.writeText(X402_ENDPOINT);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, []);

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
        <div className="absolute bottom-0 left-0 -ml-10 -mb-10 w-64 h-64 bg-primary/5 rounded-full blur-2xl" />
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold mb-6 tracking-wider uppercase">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            Live on Arc Testnet · Agent ID 18359
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
            Trade on the truth, <br />
            <span className="text-primary">before it translates.</span>
          </h1>
          <p className="text-lg text-foreground/70 mb-8 leading-relaxed">
            An autonomous AI agent monitors financial news in 15+ languages, structures binary
            prediction questions in real-time, and stakes capital on its own probability estimates —
            bootstrapping LMSR liquidity before the story reaches English wire services.
          </p>
          <div className="flex flex-wrap gap-3 text-xs font-mono text-muted-foreground">
            {["Arabic", "Mandarin", "Portuguese", "Korean", "Japanese", "French", "Turkish", "Indonesian", "+more"].map((lang) => (
              <span key={lang} className="px-2 py-1 bg-white/5 rounded-md border border-white/10">{lang}</span>
            ))}
          </div>
        </div>
      </section>

      {/* Agent-First Feature Strip */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* x402 */}
        <div className="glass-panel p-5 rounded-2xl border border-white/5 hover:border-primary/30 transition-colors group">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
              <Lock className="w-4 h-4 text-amber-400" />
            </div>
            <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">x402 Gatepoint</span>
          </div>
          <p className="text-sm font-semibold text-foreground mb-2">Pay-per-signal API</p>
          <p className="text-xs text-muted-foreground leading-relaxed mb-3">
            Any agent that hits the endpoint below gets a machine-readable HTTP 402 back — recipient address, token, chain ID. Send $0.01 USDC on Arc, retry with the tx hash. No accounts, no rate limits by identity.
          </p>
          <div className="flex items-stretch rounded-lg overflow-hidden border border-white/10 mb-3">
            <a
              href="https://meridian-hbnz.onrender.com/api/markets/1/recommendation"
              target="_blank"
              rel="noreferrer"
              className="flex-1 bg-white/5 px-2 py-1.5 font-mono text-[10px] text-amber-400/80 hover:text-amber-300 hover:bg-white/10 transition-colors break-all"
            >
              GET meridian-hbnz.onrender.com<br />/api/markets/:id/recommendation
            </a>
            <button
              onClick={copyEndpoint}
              className="px-2 bg-white/5 hover:bg-white/10 border-l border-white/10 text-muted-foreground hover:text-foreground transition-colors shrink-0"
              title="Copy endpoint"
            >
              {copied ? <Check className="w-3 h-3 text-primary" /> : <Copy className="w-3 h-3" />}
            </button>
          </div>
          <div className="space-y-1 font-mono text-[10px]">
            <div className="flex items-center gap-2 text-muted-foreground">
              <ArrowRight className="w-3 h-3 text-amber-400 shrink-0" />
              <span>→ <span className="text-amber-400">402</span> + payment instructions</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <ArrowRight className="w-3 h-3 text-amber-400 shrink-0" />
              <span>send $0.01 USDC on Arc</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <ArrowRight className="w-3 h-3 text-primary shrink-0" />
              <span className="text-primary">pYes · stakeSide · confidence</span>
            </div>
          </div>
        </div>

        {/* ERC-8004 */}
        <div className="glass-panel p-5 rounded-2xl border border-white/5 hover:border-primary/30 transition-colors group">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Bot className="w-4 h-4 text-primary" />
            </div>
            <span className="text-xs font-bold text-primary uppercase tracking-wider">ERC-8004 Identity</span>
          </div>
          <p className="text-sm font-semibold text-foreground mb-2">On-chain agent reputation</p>
          <p className="text-xs text-muted-foreground leading-relaxed mb-3">
            Meridian holds a soulbound identity token on Arc&apos;s IdentityRegistry (ID <span className="text-primary font-mono">18359</span>). After every market resolves, a Brier-score accuracy event is written to the ReputationRegistry — a verifiable track record any buyer agent can check before paying for signal.
          </p>
          <div className="bg-white/5 rounded-lg p-2 font-mono text-[10px] text-muted-foreground space-y-0.5">
            <div><span className="text-primary">score</span> = round((1 − brierScore) × 100)</div>
            <div><span className="text-primary">brierScore</span> = (prediction − outcome)²</div>
            <div className="text-muted-foreground/50 pt-1">→ recorded on every resolution</div>
          </div>
        </div>

        {/* LMSR AMM */}
        <div className="glass-panel p-5 rounded-2xl border border-white/5 hover:border-primary/30 transition-colors group">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-blue-400" />
            </div>
            <span className="text-xs font-bold text-blue-400 uppercase tracking-wider">LMSR AMM</span>
          </div>
          <p className="text-sm font-semibold text-foreground mb-2">Always-on liquidity</p>
          <p className="text-xs text-muted-foreground leading-relaxed mb-3">
            Each market is bootstrapped with a Kelly-sized USDC or EURC stake from the agent vault. The LMSR cost function guarantees a quote at every price level — no order book, no market makers needed. 0.5% builder fee on every trade.
          </p>
          <div className="bg-white/5 rounded-lg p-2 font-mono text-[10px] text-muted-foreground">
            <div>C(q) = b · ln(Σ exp(qᵢ/b))</div>
            <div className="text-muted-foreground/50 pt-1">half-Kelly · max 20% vault</div>
          </div>
        </div>

        {/* Multi-language feed */}
        <div className="glass-panel p-5 rounded-2xl border border-white/5 hover:border-primary/30 transition-colors group">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
              <Globe2 className="w-4 h-4 text-purple-400" />
            </div>
            <span className="text-xs font-bold text-purple-400 uppercase tracking-wider">Information Edge</span>
          </div>
          <p className="text-sm font-semibold text-foreground mb-2">Ahead of the translation</p>
          <p className="text-xs text-muted-foreground leading-relaxed mb-3">
            Claude translates and structures each article into a binary question with a probability estimate. Confidence-gated at 65% — only high-conviction signals become markets. Duplicate detection prevents redundant questions.
          </p>
          <div className="flex items-center gap-2 mt-auto">
            <Zap className="w-3 h-3 text-purple-400 shrink-0" />
            <span className="text-[10px] text-muted-foreground font-mono">polls every 10 min · sub-second finality on Arc</span>
          </div>
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
