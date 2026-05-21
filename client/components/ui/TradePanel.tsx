"use client";

import { useState } from "react";
import { ArrowRight, Wallet, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useReadContract, useWriteContract, useAccount, useWaitForTransactionReceipt } from "wagmi";
import { MERIDIAN_MARKET_ABI, ERC20_ABI } from "@/lib/abis";
import { CONFIG } from "@/lib/config";
import { parseUnits } from "viem";
import type { Abi } from "viem";

interface TradePanelProps {
  marketId: number | string;
  pYes: number;
}

type Action = "buy-yes" | "buy-no" | "sell-yes" | "sell-no";

export function TradePanel({ marketId, pYes }: TradePanelProps) {
  const [action, setAction] = useState<Action>("buy-yes");
  const [amount, setAmount] = useState<string>("");
  const { isConnected, address } = useAccount();

  const marketIdBig = BigInt(marketId);
  const numAmount = Number(amount) || 0;
  const isBuy = action === "buy-yes" || action === "buy-no";
  const isYes = action === "buy-yes" || action === "sell-yes";

  // Buy: estimate shares from amount / price
  const price = isYes ? pYes : 1 - pYes;
  const expectedShares = isBuy ? numAmount / price : 0;
  const expectedSharesScaled = parseUnits(
    isBuy ? expectedShares.toFixed(18) : "0",
    18,
  );
  const amountToApprove = parseUnits(amount || "0", 6);

  const registryAddress = CONFIG.contracts.marketFactory as `0x${string}`;

  // Buy: real on-chain cost for the estimated share amount
  const { data: buyCostRaw } = useReadContract({
    address: registryAddress,
    abi: MERIDIAN_MARKET_ABI as Abi,
    functionName: "getCost",
    args: [marketIdBig, isYes, expectedSharesScaled],
    query: { enabled: isBuy && numAmount > 0 },
  });
  const buyCostUsdc = buyCostRaw ? Number(buyCostRaw as bigint) / 1e6 : 0;
  const slippage =
    buyCostUsdc > 0 && numAmount > 0
      ? Math.abs((buyCostUsdc - numAmount) / numAmount) * 100
      : 0;

  // USDC allowance check (buy only)
  const { data: allowance } = useReadContract({
    address: CONFIG.contracts.usdc as `0x${string}`,
    abi: ERC20_ABI as Abi,
    functionName: "allowance",
    args: address ? [address, registryAddress] : undefined,
    query: { enabled: !!address && isBuy },
  });

  // Sell: read on-chain refund estimate for the share amount the user inputs
  const sellSharesScaled = parseUnits(amount || "0", 18);
  const { data: sellRefundRaw } = useReadContract({
    address: registryAddress,
    abi: MERIDIAN_MARKET_ABI as Abi,
    functionName: "getSellRefund",
    args: [marketIdBig, isYes, sellSharesScaled],
    query: {
      enabled: !isBuy && numAmount > 0,
    },
  });
  const sellRefund = sellRefundRaw ? Number(sellRefundRaw as bigint) / 1e6 : 0;

  const needsApproval =
    isBuy && allowance !== undefined && (allowance as bigint) < amountToApprove;

  const { writeContract, data: hash, isPending: isTxPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } =
    useWaitForTransactionReceipt({ hash });

  const handleTrade = () => {
    if (!amount || numAmount <= 0) return;

    if (isBuy) {
      if (needsApproval) {
        writeContract({
          address: CONFIG.contracts.usdc as `0x${string}`,
          abi: ERC20_ABI as Abi,
          functionName: "approve",
          args: [registryAddress, amountToApprove],
        });
        return;
      }
      writeContract({
        address: registryAddress,
        abi: MERIDIAN_MARKET_ABI as Abi,
        functionName: "buy",
        args: [marketIdBig, isYes, expectedSharesScaled],
      });
    } else {
      writeContract({
        address: registryAddress,
        abi: MERIDIAN_MARKET_ABI as Abi,
        functionName: "sell",
        args: [marketIdBig, isYes, sellSharesScaled],
      });
    }
  };

  const tabs: { id: Action; label: string; activeClass: string }[] = [
    { id: "buy-yes", label: "Buy YES", activeClass: "bg-primary text-primary-foreground" },
    { id: "buy-no", label: "Buy NO", activeClass: "bg-red-500 text-white" },
    { id: "sell-yes", label: "Sell YES", activeClass: "bg-orange-500 text-white" },
    { id: "sell-no", label: "Sell NO", activeClass: "bg-orange-500 text-white" },
  ];

  return (
    <div className="glass-panel p-6">
      <h3 className="text-lg font-semibold mb-6">Trade Shares</h3>

      {/* Action tabs */}
      <div className="grid grid-cols-4 bg-black/20 rounded-lg p-1 mb-6 gap-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => { setAction(t.id); setAmount(""); }}
            className={cn(
              "py-2 rounded-md text-xs font-bold transition-all",
              action === t.id
                ? t.activeClass + " shadow-lg"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="space-y-4 mb-6">
        <div>
          <label className="text-xs text-muted-foreground font-medium mb-1.5 block">
            {isBuy ? "Amount (USDC)" : "Shares to sell"}
          </label>
          <div className="relative">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">
              {isBuy ? "$" : "#"}
            </div>
            <input
              type="number"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full bg-glass border border-glass-border rounded-xl pl-8 pr-16 py-3 focus:outline-none focus:ring-2 focus:ring-primary/50 text-lg font-medium"
            />
          </div>
        </div>

        <div className="bg-white/5 rounded-xl p-4 space-y-3">
          {isBuy ? (
            <>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Expected Shares</span>
                <span className="font-mono font-medium">{expectedShares.toFixed(4)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Actual Cost</span>
                <span className="font-mono font-medium">
                  {numAmount > 0 ? (buyCostUsdc > 0 ? `$${buyCostUsdc.toFixed(4)}` : "…") : "$0.00"}
                </span>
              </div>
              <div className="flex justify-between text-sm pt-3 border-t border-white/10">
                <span className="text-muted-foreground">Price Impact</span>
                <span className={slippage > 1 ? "text-orange-400 font-medium" : "text-primary font-medium"}>
                  {numAmount > 0 && buyCostUsdc > 0 ? `${slippage.toFixed(2)}%` : "—"}
                </span>
              </div>
            </>
          ) : (
            <>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">USDC Refund</span>
                <span className="font-mono font-medium text-primary">
                  {numAmount > 0
                    ? sellRefund > 0
                      ? `$${sellRefund.toFixed(4)}`
                      : "…"
                    : "$0.00"}
                </span>
              </div>
              <div className="flex justify-between text-sm pt-3 border-t border-white/10">
                <span className="text-muted-foreground">Sell fee</span>
                <span className="text-primary font-medium">None</span>
              </div>
            </>
          )}
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
            {isBuy ? "Place Trade" : "Sell Shares"}
            <ArrowRight className="w-4 h-4" />
          </>
        )}
      </button>

      {isConfirmed && (
        <p className="text-center text-xs text-primary mt-2 font-medium">
          Transaction confirmed!
        </p>
      )}

      <p className="text-center text-xs text-muted-foreground mt-4">
        Trades settle on Arc Testnet via Circle Embedded Wallets.
      </p>
    </div>
  );
}
