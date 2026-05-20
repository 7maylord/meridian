import { useState } from "react";
import { formatUSDC } from "@/lib/utils";
import { ArrowRight, Wallet, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useReadContract, useWriteContract, useAccount, useWaitForTransactionReceipt } from "wagmi";
import { MERIDIAN_MARKET_ABI, ERC20_ABI } from "@/lib/abis";
import { CONFIG } from "@/lib/config";
import { parseUnits } from "viem";

interface TradePanelProps {
  marketId: number | string;
  pYes: number;
}

export function TradePanel({ marketId, pYes }: TradePanelProps) {
  const [side, setSide] = useState<"YES" | "NO">("YES");
  const [amount, setAmount] = useState<string>("");
  const { isConnected, address } = useAccount();

  const numAmount = Number(amount) || 0;
  // Convert standard USDC (6 decimals) to blockchain units
  const amountToApprove = parseUnits(amount || "0", 6);
  // Estimate shares requested (simplified math; 18 decimals)
  const expectedShares = numAmount / (side === "YES" ? pYes : 1 - pYes);
  const expectedSharesScaled = parseUnits(expectedShares.toFixed(18), 18);
  const potentialReturn = expectedShares - numAmount;

  const registryAddress = CONFIG.contracts.marketFactory;

  // Wagmi Hooks for real-time contract interactions
  const { writeContract, data: hash, isPending: isTxPending } = useWriteContract();
  
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ 
    hash 
  });

  // Example: Check allowance
  const { data: allowance } = useReadContract({
    address: CONFIG.contracts.usdc as `0x${string}`,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: address ? [address, registryAddress as `0x${string}`] : undefined,
    query: {
      enabled: !!address,
    }
  });

  const needsApproval = allowance !== undefined && (allowance as bigint) < amountToApprove;

  const handleTrade = async () => {
    if (!amount || Number(amount) <= 0) return;

    if (needsApproval) {
      writeContract({
        address: CONFIG.contracts.usdc as `0x${string}`,
        abi: ERC20_ABI,
        functionName: "approve",
        args: [registryAddress as `0x${string}`, amountToApprove],
      });
      return;
    }

    writeContract({
      address: registryAddress as `0x${string}`,
      abi: MERIDIAN_MARKET_ABI,
      functionName: "buy",
      args: [BigInt(marketId), side === "YES", expectedSharesScaled],
    });
  };

  return (
    <div className="glass-panel p-6">
      <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
        Trade Shares
      </h3>

      <div className="flex bg-black/20 rounded-lg p-1 mb-6">
        <button
          onClick={() => setSide("YES")}
          className={cn(
            "flex-1 py-2 rounded-md text-sm font-bold transition-all",
            side === "YES" ? "bg-primary text-primary-foreground shadow-lg" : "text-muted-foreground hover:text-foreground"
          )}
        >
          Buy YES
        </button>
        <button
          onClick={() => setSide("NO")}
          className={cn(
            "flex-1 py-2 rounded-md text-sm font-bold transition-all",
            side === "NO" ? "bg-red-500 text-white shadow-lg" : "text-muted-foreground hover:text-foreground"
          )}
        >
          Buy NO
        </button>
      </div>

      <div className="space-y-4 mb-6">
        <div>
          <label className="text-xs text-muted-foreground font-medium mb-1.5 block">Amount (USDC)</label>
          <div className="relative">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">$</div>
            <input
              type="number"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full bg-glass border border-glass-border rounded-xl pl-8 pr-16 py-3 focus:outline-none focus:ring-2 focus:ring-primary/50 text-lg font-medium"
            />
            <button 
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-primary bg-primary/10 px-2 py-1 rounded"
              onClick={() => setAmount("100")}
            >
              MAX
            </button>
          </div>
        </div>

        <div className="bg-white/5 rounded-xl p-4 space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Expected Shares</span>
            <span className="font-mono font-medium">{expectedShares.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Potential Return</span>
            <span className="font-mono font-medium text-primary">+{formatUSDC(potentialReturn * 1e6)}</span>
          </div>
          <div className="flex justify-between text-sm pt-3 border-t border-white/10">
            <span className="text-muted-foreground">Price Impact</span>
            <span className="font-medium text-orange-400">{'< 0.1%'}</span>
          </div>
        </div>
      </div>

      <button 
        onClick={handleTrade}
        disabled={isTxPending || isConfirming || !isConnected}
        className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(16,185,129,0.3)] disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {!isConnected ? (
          <>Connect Wallet to Trade</>
        ) : isTxPending || isConfirming ? (
          <><Loader2 className="w-4 h-4 animate-spin" /> Processing...</>
        ) : needsApproval ? (
          <>Approve USDC <ArrowRight className="w-4 h-4" /></>
        ) : (
          <>
            <Wallet className="w-4 h-4" />
            Place Trade
            <ArrowRight className="w-4 h-4" />
          </>
        )}
      </button>

      {isConfirmed && (
        <p className="text-center text-xs text-primary mt-2 font-medium">Transaction successful!</p>
      )}

      <p className="text-center text-xs text-muted-foreground mt-4">
        Trades are executed via Circle Embedded Wallets on the Arc Testnet.
      </p>
    </div>
  );
}
