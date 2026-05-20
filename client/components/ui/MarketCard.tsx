import Link from "next/link";
import { ResolutionBadge } from "./ResolutionBadge";
import { formatUSDC } from "@/lib/utils";
import { Globe2 } from "lucide-react";

export interface MarketCardProps {
  id: string;
  question: string;
  pYes: number;
  poolSize: number; // in USDC
  oracleTier: number;
  resolutionDeadline: string;
  sourceLanguage: string;
  vertical: string;
}

export function MarketCard({
  id,
  question,
  pYes,
  poolSize,
  oracleTier,
  resolutionDeadline,
  sourceLanguage,
  vertical
}: MarketCardProps) {
  const pNo = 1 - pYes;
  
  return (
    <Link href={`/markets/${id}`} className="block">
      <div className="glass-panel p-6 hover:bg-glass hover:border-primary/30 transition-all duration-300 group">
        <div className="flex justify-between items-start mb-4">
          <div className="flex gap-2">
            <span className="px-2.5 py-1 rounded-full bg-primary/10 text-primary text-[10px] uppercase font-bold tracking-wider border border-primary/20">
              {vertical.replace('-', ' ')}
            </span>
            <span className="px-2.5 py-1 rounded-full bg-white/5 text-foreground/70 text-[10px] uppercase font-bold tracking-wider flex items-center gap-1 border border-white/10">
              <Globe2 className="w-3 h-3" />
              {sourceLanguage.toUpperCase()}
            </span>
          </div>
          <div className="text-right">
            <div className="text-xs text-muted-foreground font-medium mb-1">Pool Size</div>
            <div className="text-sm font-semibold">{formatUSDC(poolSize)}</div>
          </div>
        </div>

        <h3 className="text-xl font-semibold mb-6 leading-snug group-hover:text-primary transition-colors line-clamp-2">
          {question}
        </h3>

        <div className="space-y-4 mb-6">
          <div className="flex justify-between items-center text-sm font-medium">
            <div className="flex items-center gap-2">
              <span className="w-8">YES</span>
              <span className="text-primary text-lg">{(pYes * 100).toFixed(1)}%</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-red-400 text-lg">{(pNo * 100).toFixed(1)}%</span>
              <span className="w-8 text-right">NO</span>
            </div>
          </div>
          
          {/* Probability Bar */}
          <div className="h-2 w-full bg-red-400/20 rounded-full overflow-hidden flex">
            <div 
              className="h-full bg-primary transition-all duration-1000 ease-out" 
              style={{ width: `${pYes * 100}%` }}
            />
          </div>
        </div>

        <div className="pt-4 border-t border-glass-border">
          <ResolutionBadge tier={oracleTier} deadline={resolutionDeadline} />
        </div>
      </div>
    </Link>
  );
}
