"use client";

import { useState } from "react";
import { ArrowRight, Wallet, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useReadContract, useWriteContract, useAccount, useConfig } from "wagmi";
import { waitForTransactionReceipt } from "@wagmi/core";
import { MERIDIAN_MARKET_ABI, ERC20_ABI } from "@/lib/abis";
import { CONFIG } from "@/lib/config";
import { parseUnits, maxUint256 } from "viem";
import type { Abi } from "viem";
import { toast } from "sonner";

/**
 * Algebraic inverse of the LMSR cost function.
 * Returns the exact number of shares (18-decimal bigint) whose LMSR cost
 * equals `budgetUsdc` dollars, given current pool state.
 *
 * For NO:  s = (qYes − qNo) + b·ln(e^(C/b)·(1 + e^((qNo−qYes)/b)) − 1)
 * For YES: s = (qNo − qYes) + b·ln(e^(C/b)·(1 + e^((qYes−qNo)/b)) − 1)
 */
function inverseLMSR(
  b: bigint,
  qYes: bigint,
  qNo: bigint,
  budgetUsdc: number,
  isYes: boolean,
): bigint {
  if (budgetUsdc <= 0) return BigInt(0);
  const b_f = Number(b) / 1e18;
  const qYes_f = Number(qYes) / 1e18;
  const qNo_f = Number(qNo) / 1e18;

  const budgetOverB = budgetUsdc / b_f;

  // For YES: delta = (qYes − qNo)/b — large when agent has staked heavily on YES
  // For NO:  delta = (qNo − qYes)/b — negative (small) in that same scenario
  if (isYes) {
    const delta = (qYes_f - qNo_f) / b_f;
    if (delta > 700) {
      // p_yes ≈ 1, each YES share ≈ $1 → shares ≈ budget
      return BigInt(Math.floor(budgetUsdc * 1e18));
    }
    const inner = Math.exp(budgetOverB) * (1 + Math.exp(delta)) - 1;
    if (inner <= 0) return BigInt(0);
    const shares = (qNo_f - qYes_f) + b_f * Math.log(inner);
    if (shares <= 0) return BigInt(0);
    return BigInt(Math.floor(shares * 1e18));
  } else {
    const delta = (qNo_f - qYes_f) / b_f; // negative when qYes > qNo, safe from overflow
    const inner = Math.exp(budgetOverB) * (1 + Math.exp(delta)) - 1;
    if (inner <= 0) return BigInt(0);
    const shares = (qYes_f - qNo_f) + b_f * Math.log(inner);
    if (shares <= 0) return BigInt(0);
    return BigInt(Math.floor(shares * 1e18));
  }
}

interface TradePanelProps {
  marketId: number | string;
  pYes: number;
}

type Action = "buy-yes" | "buy-no" | "sell-yes" | "sell-no";

export function TradePanel({ marketId, pYes }: TradePanelProps) {
  const [action, setAction] = useState<Action>("buy-yes");
  const [amount, setAmount] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState(false);

  const { isConnected, address } = useAccount();
  const config = useConfig();
  const { writeContractAsync } = useWriteContract();

  const marketIdBig = BigInt(marketId);
  const numAmount = Number(amount) || 0;
  const isBuy = action === "buy-yes" || action === "buy-no";
  const isYes = action === "buy-yes" || action === "sell-yes";

  const price = isYes ? pYes : 1 - pYes;

  const registryAddress = CONFIG.contracts.marketFactory as `0x${string}`;

  // markets() returns full struct including b, qYes, qNo needed for inverse LMSR
  const { data: marketData } = useReadContract({
    address: registryAddress,
    abi: MERIDIAN_MARKET_ABI as Abi,
    functionName: "markets",
    args: [marketIdBig],
  });
  type MarketTuple = readonly [string, string, `0x${string}`, number, bigint, bigint, bigint, ...unknown[]];
  const md = marketData as MarketTuple | undefined;
  const collateralAddress = md?.[2] ?? (CONFIG.contracts.usdc as `0x${string}`);
  const lmsrB = md?.[4];
  const lmsrQYes = md?.[5];
  const lmsrQNo = md?.[6];

  // Use algebraic inverse when pool state is loaded; fall back to spot-price estimate
  const expectedSharesScaled: bigint = (() => {
    if (!isBuy || numAmount <= 0) return BigInt(0);
    if (lmsrB && lmsrQYes !== undefined && lmsrQNo !== undefined) {
      return inverseLMSR(lmsrB, lmsrQYes, lmsrQNo, numAmount, isYes);
    }
    return parseUnits((numAmount / price).toFixed(18), 18);
  })();
  const expectedShares = Number(expectedSharesScaled) / 1e18;

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

  // Minimum to spend: on-chain cost + 1% buffer covers 0.5% fee + slippage
  const exactCost: bigint = buyCostRaw
    ? (buyCostRaw as bigint)
    : parseUnits(amount || "0", 6);
  const minAllowanceNeeded = exactCost * BigInt(10100) / BigInt(10000);

  const { data: userCollateralBalance } = useReadContract({
    address: collateralAddress,
    abi: ERC20_ABI as Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address && isBuy },
  });
  const userBalanceUsdc = userCollateralBalance ? Number(userCollateralBalance as bigint) / 1e6 : null;
  const hasEnoughBalance = userCollateralBalance !== undefined
    ? (userCollateralBalance as bigint) >= minAllowanceNeeded
    : true; // optimistic until loaded

  const { data: allowance, isLoading: allowanceLoading } = useReadContract({
    address: collateralAddress,
    abi: ERC20_ABI as Abi,
    functionName: "allowance",
    args: address ? [address, registryAddress] : undefined,
    query: {
      enabled: !!address && isBuy,
      select: (data) => {
        console.log("[TradePanel] allowance read →", data?.toString());
        return data;
      },
    },
  });

  const sellSharesScaled = parseUnits(amount || "0", 18);
  const { data: sellRefundRaw } = useReadContract({
    address: registryAddress,
    abi: MERIDIAN_MARKET_ABI as Abi,
    functionName: "getSellRefund",
    args: [marketIdBig, isYes, sellSharesScaled],
    query: {
      enabled: !isBuy && numAmount > 0,
      select: (data) => {
        console.log("[TradePanel] sellRefund read →", data?.toString(), `(${Number(data ?? 0) / 1e6} USDC)`);
        return data;
      },
    },
  });
  const sellRefund = sellRefundRaw ? Number(sellRefundRaw as bigint) / 1e6 : 0;

  const { data: userPosition } = useReadContract({
    address: registryAddress,
    abi: MERIDIAN_MARKET_ABI as Abi,
    functionName: "getUserPosition",
    args: address ? [marketIdBig, address] : undefined,
    query: {
      enabled: !isBuy && !!address,
      select: (data) => {
        const [yes, no] = data as [bigint, bigint];
        console.log("[TradePanel] userPosition read →", {
          yesShares: (Number(yes) / 1e18).toFixed(6),
          noShares: (Number(no) / 1e18).toFixed(6),
        });
        return data;
      },
    },
  });

  const handleTrade = async () => {
    if (!amount || numAmount <= 0 || isProcessing) return;

    console.log("[TradePanel] handleTrade start", {
      action,
      marketId: marketId.toString(),
      amount,
      numAmount,
      isBuy,
      isYes,
    });

    setIsProcessing(true);
    let activeToastId: string | number | undefined;
    try {
      if (isBuy) {
        const currentAllowance = allowance !== undefined ? (allowance as bigint) : BigInt(0);

        console.log("[TradePanel] BUY path", {
          collateral: collateralAddress,
          marketContract: registryAddress,
          expectedShares: expectedSharesScaled.toString(),
          buyCostRaw: buyCostRaw?.toString() ?? "not loaded",
          buyCostUsdc,
          exactCost: exactCost.toString(),
          minAllowanceNeeded: minAllowanceNeeded.toString(),
          currentAllowance: currentAllowance.toString(),
          needsApproval: currentAllowance < minAllowanceNeeded,
        });

        if (currentAllowance < minAllowanceNeeded) {
          console.log("[TradePanel] Allowance insufficient — approving maxUint256");
          activeToastId = toast.loading("Approving token...");
          const approvalHash = await writeContractAsync({
            address: collateralAddress,
            abi: ERC20_ABI as Abi,
            functionName: "approve",
            args: [registryAddress, maxUint256],
          });
          console.log("[TradePanel] Approval tx submitted", approvalHash);
          toast.loading("Waiting for approval...", { id: activeToastId });
          await waitForTransactionReceipt(config, { hash: approvalHash });
          console.log("[TradePanel] Approval confirmed");
          toast.success("Token approved!", { id: activeToastId });
          activeToastId = undefined;
        } else {
          console.log("[TradePanel] Allowance sufficient — skipping approval");
        }

        console.log("[TradePanel] Submitting buy()", {
          contract: registryAddress,
          marketId: marketIdBig.toString(),
          isYes,
          shares: expectedSharesScaled.toString(),
        });
        activeToastId = toast.loading("Submitting trade...");
        const buyHash = await writeContractAsync({
          address: registryAddress,
          abi: MERIDIAN_MARKET_ABI as Abi,
          functionName: "buy",
          args: [marketIdBig, isYes, expectedSharesScaled],
        });
        console.log("[TradePanel] Buy tx submitted", buyHash);
        toast.loading("Waiting for confirmation...", { id: activeToastId });
        await waitForTransactionReceipt(config, { hash: buyHash });
        console.log("[TradePanel] Buy confirmed ✓");
        toast.success("Trade confirmed!", { id: activeToastId });
        setAmount("");
      } else {
        const [posYes, posNo] = (userPosition as [bigint, bigint] | undefined) ?? [BigInt(0), BigInt(0)];
        console.log("[TradePanel] SELL path", {
          contract: registryAddress,
          marketId: marketIdBig.toString(),
          isYes,
          sharesToSell: sellSharesScaled.toString(),
          userYesShares: (Number(posYes) / 1e18).toFixed(6),
          userNoShares: (Number(posNo) / 1e18).toFixed(6),
          expectedRefund: sellRefund,
        });
        activeToastId = toast.loading("Submitting sell...");
        const sellHash = await writeContractAsync({
          address: registryAddress,
          abi: MERIDIAN_MARKET_ABI as Abi,
          functionName: "sell",
          args: [marketIdBig, isYes, sellSharesScaled],
        });
        console.log("[TradePanel] Sell tx submitted", sellHash);
        toast.loading("Waiting for confirmation...", { id: activeToastId });
        await waitForTransactionReceipt(config, { hash: sellHash });
        console.log("[TradePanel] Sell confirmed ✓");
        toast.success("Shares sold!", { id: activeToastId });
        setAmount("");
      }
    } catch (err) {
      if (activeToastId !== undefined) toast.dismiss(activeToastId);
      console.error("[TradePanel] Transaction failed", err);
      const message = err instanceof Error ? err.message.split("\n")[0] : "Transaction failed";
      toast.error(message);
    } finally {
      setIsProcessing(false);
    }
  };

  const tabs: { id: Action; label: string; activeClass: string }[] = [
    { id: "buy-yes", label: "Buy YES", activeClass: "bg-primary text-primary-foreground" },
    { id: "buy-no", label: "Buy NO", activeClass: "bg-red-500 text-white" },
    { id: "sell-yes", label: "Sell YES", activeClass: "bg-orange-500 text-white" },
    { id: "sell-no", label: "Sell NO", activeClass: "bg-orange-500 text-white" },
  ];

  const isReadingAllowance = isBuy && allowanceLoading && !isProcessing;
  const isLoading = isProcessing || isReadingAllowance;

  return (
    <div className="glass-panel p-6">
      <h3 className="text-lg font-semibold mb-6">Trade Shares</h3>

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
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Your Balance</span>
                <span className={!hasEnoughBalance ? "text-red-400 font-medium" : "text-muted-foreground font-mono"}>
                  {userBalanceUsdc !== null ? `$${userBalanceUsdc.toFixed(2)}` : "—"}
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
        disabled={isLoading || !isConnected || (isBuy && !hasEnoughBalance)}
        className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(16,185,129,0.3)] disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {!isConnected ? (
          <>Connect Wallet to Trade</>
        ) : isBuy && !hasEnoughBalance ? (
          <>Insufficient Balance</>
        ) : isReadingAllowance ? (
          <><Loader2 className="w-4 h-4 animate-spin" /> Loading...</>
        ) : isProcessing ? (
          <><Loader2 className="w-4 h-4 animate-spin" /> Processing...</>
        ) : (
          <>
            <Wallet className="w-4 h-4" />
            {isBuy ? "Place Trade" : "Sell Shares"}
            <ArrowRight className="w-4 h-4" />
          </>
        )}
      </button>

      <p className="text-center text-xs text-muted-foreground mt-4">
        Trades settle on Arc Testnet via Circle Embedded Wallets.
      </p>
    </div>
  );
}
