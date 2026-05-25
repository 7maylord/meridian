"use client";

import { useEffect, useRef, useState } from "react";
import { useReadContract } from "wagmi";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { CONFIG } from "@/lib/config";
import { MERIDIAN_MARKET_ABI } from "@/lib/abis";
import type { Abi } from "viem";

interface PricePoint {
  time: string;
  price: number;
}

interface PriceChartProps {
  marketId: number | bigint;
}

const MAX_POINTS = 60; // 2-minute rolling window at 2s intervals

export function PriceChart({ marketId }: PriceChartProps) {
  const [history, setHistory] = useState<PricePoint[]>([]);
  const lastPriceRef = useRef<number | null>(null);

  const { data } = useReadContract({
    address: CONFIG.contracts.marketFactory as `0x${string}`,
    abi: MERIDIAN_MARKET_ABI as Abi,
    functionName: "getPrice",
    args: [BigInt(marketId)],
    query: { refetchInterval: 2000 },
  });

  useEffect(() => {
    if (!data) return;
    const [yesPrice] = data as [bigint, bigint];
    const price = Number(yesPrice) / 100; // bps → cents (0–100)

    const now = new Date();
    const label = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}:${now.getSeconds().toString().padStart(2, "0")}`;

    lastPriceRef.current = price;
    setHistory((prev) => {
      // Seed with two identical points so the chart renders immediately on first data
      const next = prev.length === 0
        ? [{ time: label, price }, { time: label, price }]
        : [...prev, { time: label, price }];
      return next.length > MAX_POINTS ? next.slice(-MAX_POINTS) : next;
    });
  }, [data]);

  return (
    <div className="glass-panel p-6 h-[400px]">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-foreground/90">YES Price (Live)</h3>
        {history.length > 0 && (
          <span className="font-mono text-primary text-sm font-bold">
            {history[history.length - 1].price.toFixed(1)}¢
          </span>
        )}
      </div>
      <div className="w-full h-[300px] min-w-0">
        {history.length < 2 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            Waiting for price data…
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%" debounce={5}>
            <LineChart data={history} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis
                dataKey="time"
                stroke="rgba(255,255,255,0.4)"
                fontSize={10}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                stroke="rgba(255,255,255,0.4)"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                domain={[0, 100]}
                tickFormatter={(val) => `${val}¢`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "rgba(9, 9, 11, 0.9)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: "8px",
                  backdropFilter: "blur(8px)",
                }}
                itemStyle={{ color: "#10b981" }}
                formatter={(value) => [`${Number(value).toFixed(1)}¢`, "YES Price"]}
              />
              <Line
                type="monotone"
                dataKey="price"
                stroke="#10b981"
                strokeWidth={3}
                dot={false}
                activeDot={{ r: 6, fill: "#10b981", stroke: "#022c22", strokeWidth: 2 }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
