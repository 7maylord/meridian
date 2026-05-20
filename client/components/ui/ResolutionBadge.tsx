import { formatUSDC } from "@/lib/utils";
import { Shield, Clock, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";

interface ResolutionBadgeProps {
  tier: number;
  deadline: string | Date;
}

export function ResolutionBadge({ tier, deadline }: ResolutionBadgeProps) {
  const date = new Date(deadline);
  const now = new Date();
  const isExpired = date < now;
  const daysLeft = Math.ceil((date.getTime() - now.getTime()) / (1000 * 3600 * 24));

  const tierColors = {
    1: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    2: "bg-purple-500/10 text-purple-400 border-purple-500/20",
    3: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  };

  const tierLabels = {
    1: "Data Feed (Pyth/Chainlink)",
    2: "Admin Verification",
    3: "UMA Optimistic",
  };

  return (
    <div className="flex items-center gap-3 text-xs font-medium">
      <div className={cn("px-2 py-1 rounded-md border flex items-center gap-1.5", tierColors[tier as keyof typeof tierColors])}>
        {tier === 1 ? <Shield className="w-3 h-3" /> : <ShieldAlert className="w-3 h-3" />}
        Tier {tier} Oracle
      </div>
      
      <div className={cn("flex items-center gap-1.5", isExpired ? "text-red-400" : "text-muted-foreground")}>
        <Clock className="w-3 h-3" />
        {isExpired ? "Resolution Pending" : `${daysLeft} days left`}
      </div>
    </div>
  );
}
