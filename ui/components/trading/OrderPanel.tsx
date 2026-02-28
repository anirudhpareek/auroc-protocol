"use client";

import { useState } from "react";
import { Toggle, Tabs, Input, Slider, Button } from "../ui";

export function OrderPanel() {
  const [direction, setDirection] = useState<"long" | "short">("long");
  const [orderType, setOrderType] = useState("Market");
  const [amount, setAmount] = useState("");
  const [leverage, setLeverage] = useState(25);
  const [tpslEnabled, setTpslEnabled] = useState(false);
  const [takeProfit, setTakeProfit] = useState("");
  const [stopLoss, setStopLoss] = useState("");

  const availableBalance = "10,000.00";

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 space-y-4">
        {/* Direction Toggle */}
        <Toggle value={direction} onChange={setDirection} />

        {/* Order Type Tabs */}
        <Tabs
          tabs={["Market", "Limit"]}
          value={orderType}
          onChange={setOrderType}
        />

        {/* Amount Input */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs">
            <span className="text-[var(--gray-400)]">Amount</span>
            <span className="text-[var(--gray-500)]">
              Available: <span className="text-white">{availableBalance}</span> USDC
            </span>
          </div>
          <div className="relative">
            <input
              type="text"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="w-full bg-[var(--gray-900)] border border-[var(--gray-800)] rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[var(--gray-600)] placeholder:text-[var(--gray-600)] pr-20"
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
              <button
                onClick={() => setAmount(availableBalance.replace(/,/g, ""))}
                className="text-xs text-[var(--yellow)] hover:brightness-110"
              >
                Max
              </button>
              <span className="text-sm text-[var(--gray-400)]">USDC</span>
            </div>
          </div>
        </div>

        {/* Leverage Slider */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs">
            <span className="text-[var(--gray-400)]">Leverage</span>
            <span className="text-white">{leverage}x</span>
          </div>
          <Slider
            value={leverage}
            onChange={setLeverage}
            min={1}
            max={100}
            marks={[1, 25, 50, 75, 100]}
          />
        </div>

        {/* TP/SL Toggle */}
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={tpslEnabled}
            onChange={(e) => setTpslEnabled(e.target.checked)}
            className="w-4 h-4 rounded border-[var(--gray-700)] bg-[var(--gray-900)] accent-[var(--yellow)]"
          />
          <span className="text-sm text-[var(--gray-400)]">
            Take Profit / Stop Loss
          </span>
        </label>

        {/* TP/SL Inputs */}
        {tpslEnabled && (
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Take Profit"
              value={takeProfit}
              onChange={setTakeProfit}
              placeholder="0.00"
              suffix="USDC"
            />
            <Input
              label="Stop Loss"
              value={stopLoss}
              onChange={setStopLoss}
              placeholder="0.00"
              suffix="USDC"
            />
          </div>
        )}

        {/* Submit Button */}
        <Button
          variant={direction === "long" ? "long" : "short"}
          className="w-full py-3"
        >
          {direction === "long" ? "Long" : "Short"} BTC
        </Button>

        {/* Order Summary */}
        <div className="border-t border-[var(--gray-900)] pt-4 space-y-2">
          <SummaryRow label="Liquidation Price" value="--" />
          <SummaryRow label="Order Value" value="--" />
          <SummaryRow label="Margin Required" value="--" />
          <SummaryRow label="Fees" value="--" />
        </div>
      </div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-xs">
      <span className="text-[var(--gray-500)]">{label}</span>
      <span className="text-[var(--gray-300)] tabular">{value}</span>
    </div>
  );
}
