"use client";

import { useState, useCallback } from "react";
import { useAccount } from "wagmi";
import { cn } from "@/lib/cn";
import {
  Button,
  NumericInput,
  LongShortTabs,
  OrderTypeTabs,
  LeverageSlider,
} from "@/components/ui";

interface TradePanelProps {
  marketSymbol: string;
  markPrice: string;
  maxLeverage?: number;
  onSubmitOrder?: (order: OrderParams) => Promise<void>;
}

interface OrderParams {
  side: "long" | "short";
  size: string;
  margin: string;
  leverage: number;
  orderType: "market" | "limit";
  limitPrice?: string;
  takeProfit?: string;
  stopLoss?: string;
}

export function TradePanel({
  marketSymbol,
  markPrice,
  maxLeverage = 100,
  onSubmitOrder,
}: TradePanelProps) {
  const { isConnected } = useAccount();

  const [side, setSide] = useState<"long" | "short">("long");
  const [orderType, setOrderType] = useState<"market" | "limit">("market");
  const [amount, setAmount] = useState("");
  const [leverage, setLeverage] = useState(20);
  const [limitPrice, setLimitPrice] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showTpSl, setShowTpSl] = useState(false);
  const [takeProfit, setTakeProfit] = useState("");
  const [stopLoss, setStopLoss] = useState("");

  const positionSize = amount
    ? (parseFloat(amount) * leverage).toFixed(2)
    : "0.00";

  const estimatedLiqPrice = useCallback(() => {
    if (!amount || !markPrice) return "-";
    const price = parseFloat(markPrice.replace(/,/g, ""));
    const m = parseFloat(amount);
    if (isNaN(price) || isNaN(m) || m === 0) return "-";

    const marginRatio = 0.9 / leverage;
    const liqPrice =
      side === "long"
        ? price * (1 - marginRatio)
        : price * (1 + marginRatio);

    return liqPrice.toFixed(2);
  }, [amount, markPrice, leverage, side]);

  const handleSubmit = async () => {
    if (!amount || parseFloat(amount) <= 0) return;

    setIsSubmitting(true);
    try {
      await onSubmitOrder?.({
        side,
        size: positionSize,
        margin: amount,
        leverage,
        orderType,
        limitPrice: orderType === "limit" ? limitPrice : undefined,
        takeProfit: showTpSl && takeProfit ? takeProfit : undefined,
        stopLoss: showTpSl && stopLoss ? stopLoss : undefined,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-[var(--bg-base)]">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[var(--border-subtle)]">
        <div className="flex items-center justify-between">
          <span className="text-[var(--text-lg)] font-semibold text-white">
            {marketSymbol}
          </span>
          <div className="flex items-center gap-2">
            <span className="text-[var(--text-sm)] text-[var(--text-muted)]">Mark</span>
            <span className="text-[var(--text-sm)] font-medium tabular-nums text-white">
              ${markPrice}
            </span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
        {/* Long/Short Toggle */}
        <LongShortTabs value={side} onChange={setSide} />

        {/* Order Type Tabs */}
        <OrderTypeTabs value={orderType} onChange={setOrderType} />

        {/* Limit Price (conditional) */}
        {orderType === "limit" && (
          <div className="space-y-2">
            <label className="text-[var(--text-sm)] text-[var(--text-secondary)]">
              Limit Price
            </label>
            <NumericInput
              value={limitPrice}
              onChange={setLimitPrice}
              placeholder={markPrice}
              rightAddon={<span className="text-[var(--text-sm)]">USD</span>}
              decimals={2}
            />
          </div>
        )}

        {/* Amount Input */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-[var(--text-sm)] text-[var(--text-secondary)]">
              Amount
            </label>
            <span className="text-[var(--text-xs)] text-[var(--text-muted)]">
              Balance: $0.00
            </span>
          </div>
          <NumericInput
            value={amount}
            onChange={setAmount}
            placeholder="0.00"
            rightAddon={<span className="text-[var(--text-sm)] text-[var(--accent-primary)]">USDC</span>}
            decimals={2}
          />

          {/* Quick Amount Buttons */}
          <div className="flex gap-2">
            {[10, 25, 50, 100].map((pct) => (
              <button
                key={pct}
                onClick={() => setAmount((100 * pct / 100).toString())}
                className={cn(
                  "flex-1 py-1.5 rounded-md",
                  "text-[var(--text-xs)] font-medium",
                  "bg-[var(--bg-surface)] text-[var(--text-muted)]",
                  "border border-[var(--border-default)]",
                  "hover:border-[var(--border-strong)] hover:text-white",
                  "transition-all duration-150"
                )}
              >
                {pct === 100 ? "Max" : `${pct}%`}
              </button>
            ))}
          </div>
        </div>

        {/* Leverage Slider */}
        <LeverageSlider
          value={leverage}
          onChange={setLeverage}
          maxLeverage={maxLeverage}
        />

        {/* TP/SL Toggle */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowTpSl(!showTpSl)}
            className={cn(
              "flex items-center gap-2",
              "text-[var(--text-sm)]",
              showTpSl ? "text-[var(--accent-primary)]" : "text-[var(--text-muted)]",
              "hover:text-white transition-colors"
            )}
          >
            <div className={cn(
              "w-4 h-4 rounded border flex items-center justify-center",
              showTpSl
                ? "bg-[var(--accent-primary)] border-[var(--accent-primary)]"
                : "border-[var(--border-default)]"
            )}>
              {showTpSl && (
                <svg className="w-3 h-3 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
            Take Profit / Stop Loss
          </button>
        </div>

        {/* TP/SL Inputs */}
        {showTpSl && (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <label className="text-[var(--text-xs)] text-[var(--color-long)]">
                Take Profit
              </label>
              <NumericInput
                value={takeProfit}
                onChange={setTakeProfit}
                placeholder="0.00"
                rightAddon={<span className="text-[var(--text-xs)]">USD</span>}
                decimals={2}
              />
            </div>
            <div className="space-y-2">
              <label className="text-[var(--text-xs)] text-[var(--color-short)]">
                Stop Loss
              </label>
              <NumericInput
                value={stopLoss}
                onChange={setStopLoss}
                placeholder="0.00"
                rightAddon={<span className="text-[var(--text-xs)]">USD</span>}
                decimals={2}
              />
            </div>
          </div>
        )}

        {/* Divider */}
        <div className="h-px bg-[var(--border-subtle)]" />

        {/* Order Summary */}
        <div className="space-y-3">
          <SummaryRow label="Position Size" value={`$${positionSize}`} />
          <SummaryRow
            label="Entry Price"
            value={orderType === "limit" && limitPrice ? `$${limitPrice}` : `$${markPrice}`}
          />
          <SummaryRow
            label="Liquidation Price"
            value={`$${estimatedLiqPrice()}`}
            warning
          />
          <SummaryRow label="Trading Fee" value="0.05%" muted />
        </div>
      </div>

      {/* Submit Button */}
      <div className="px-4 py-4 border-t border-[var(--border-subtle)]">
        {isConnected ? (
          <button
            onClick={handleSubmit}
            disabled={!amount || parseFloat(amount) <= 0 || isSubmitting}
            className={cn(
              "w-full py-4 rounded-xl",
              "text-[var(--text-md)] font-semibold",
              "transition-all duration-150",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              side === "long"
                ? "bg-[var(--color-long)] text-black hover:brightness-110"
                : "bg-[var(--color-short)] text-white hover:brightness-110"
            )}
          >
            {isSubmitting ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Processing...
              </span>
            ) : (
              `${side === "long" ? "Long" : "Short"} ${marketSymbol}`
            )}
          </button>
        ) : (
          <Button variant="primary" fullWidth size="lg" className="py-4 rounded-xl">
            Connect Wallet
          </Button>
        )}
      </div>
    </div>
  );
}

interface SummaryRowProps {
  label: string;
  value: string;
  warning?: boolean;
  muted?: boolean;
}

function SummaryRow({ label, value, warning, muted }: SummaryRowProps) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[var(--text-sm)] text-[var(--text-muted)]">
        {label}
      </span>
      <span
        className={cn(
          "text-[var(--text-sm)] font-medium tabular-nums",
          warning && "text-[var(--color-warning)]",
          muted && "text-[var(--text-muted)]",
          !warning && !muted && "text-white"
        )}
      >
        {value}
      </span>
    </div>
  );
}
