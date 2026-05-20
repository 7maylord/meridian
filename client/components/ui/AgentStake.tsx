import { formatUSDC } from "@/lib/utils";
import { Brain, TrendingUp, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

interface AgentStakeProps {
  confidence: number;
  stakeAmount: number;
  stakeSide: "YES" | "NO";
  brierScore?: number;
}

export function AgentStake({ confidence, stakeAmount, stakeSide, brierScore }: AgentStakeProps) {
  return (
    <div className="glass-panel p-6 border-primary/20 bg-primary/5">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary border border-primary/30">
          <Brain className="w-5 h-5" />
        </div>
        <div>
          <h3 className="font-semibold text-lg">Agent Intelligence Signal</h3>
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <ShieldCheck className="w-3 h-3 text-primary" />
            Cryptographically verified stake
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-black/20 rounded-xl p-4 border border-white/5">
          <div className="text-xs text-muted-foreground mb-1">Initial Confidence</div>
          <div className="text-2xl font-mono font-medium text-primary">
            {(confidence * 100).toFixed(1)}%
          </div>
        </div>
        <div className="bg-black/20 rounded-xl p-4 border border-white/5">
          <div className="text-xs text-muted-foreground mb-1">Capital at Risk</div>
          <div className="text-2xl font-mono font-medium flex items-center gap-2">
            {formatUSDC(stakeAmount * 1e6)}
            <span className={cn(
              "text-xs px-2 py-0.5 rounded uppercase font-bold tracking-wider",
              stakeSide === "YES" ? "bg-primary/20 text-primary" : "bg-red-500/20 text-red-400"
            )}>
              {stakeSide}
            </span>
          </div>
        </div>
      </div>

      <div className="text-sm text-foreground/80 leading-relaxed">
        The autonomous agent parsed foreign language news and placed this stake via the Kelly Criterion before market opening. 
        <strong className="text-foreground font-semibold"> If you believe the agent's translation or reasoning is flawed, you can profitably trade against it.</strong>
      </div>
    </div>
  );
}
