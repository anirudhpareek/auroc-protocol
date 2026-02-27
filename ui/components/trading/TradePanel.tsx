"use client";

import { useState, useCallback } from "react";
import { useAccount } from "wagmi";
import { cn } from "@/lib/cn";
import {
  Button,
  NumericInput,
  LongShortTabs,
  LeverageSlider,
  Card,
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
}

export function TradePanel({
  marketSymbol,
  markPrice,
  maxLeverage = 10,
  onSubmitOrder,
}: TradePanelProps) {
  const { isConnected } = useAccount();

  const [side, setSide] = useState<"long" | "short">("long");
  const [orderType, setOrderType] = useState<"market" | "limit">("market");
  const [margin, setMargin] = useState("");
  const [leverage, setLeverage] = useState(1);
  const [limitPrice, setLimitPrice] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Calculate position size
  const positionSize = margin
    ? (parseFloat(margin) * leverage).toFixed(2)
    : "0.00";

  // Calculate estimated liquidation price
  const estimatedLiqPrice = useCallback(() => {
    if (!margin || !markPrice) return "-";
    const price = parseFloat(markPrice.replace(/,/g, ""));
    const m = parseFloat(margin);
    if (isNaN(price) || isNaN(m) || m === 0) return "-";

    // Simplified liquidation price calculation
    // liqPrice = entryPrice * (1 - 1/leverage * 0.9) for longs
    // liqPrice = entryPrice * (1 + 1/leverage * 0.9) for shorts
    const margin_ratio = 0.9 / leverage;
    const liqPrice =
      side === "long"
        ? price * (1 - margin_ratio)
        : price * (1 + margin_ratio);

    return liqPrice.toFixed(2);
  }, [margin, markPrice, leverage, side]);

  const handleSubmit = async () => {
    if (!margin || parseFloat(margin) <= 0) return;

    setIsSubmitting(true);
    try {
      await onSubmitOrder?.({
        side,
        size: positionSize,
        margin,
        leverage,
        orderType,
        limitPrice: orderType === "limit" ? limitPrice : undefined,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-[var(--border-subtle)]">
        <h2 className="text-[var(--text-lg)] font-semibold">
          Trade {marketSymbol}
        </h2>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Long/Short Toggle */}
        <LongShortTabs value={side} onChange={setSide} />

        {/* Order Type */}
        <div className="flex gap-2">
          <button
            onClick={() => setOrderType("market")}
            className={cn(
              "flex-1 py-2 rounded-[var(--radius-md)]",
              "text-[var(--text-sm)] font-medium",
              "transition-colors duration-[var(--transition-fast)]",
              orderType === "market"
                ? "bg-[var(--bg-hover)] text-[var(--text-primary)]"
                : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
            )}
          >
            Market
          </button>
          <button
            onClick={() => setOrderType("limit")}
            className={cn(
              "flex-1 py-2 rounded-[var(--radius-md)]",
              "text-[var(--text-sm)] font-medium",
              "transition-colors duration-[var(--transition-fast)]",
              orderType === "limit"
                ? "bg-[var(--bg-hover)] text-[var(--text-primary)]"
                : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
            )}
          >
            Limit
          </button>
        </div>

        {/* Limit Price (conditional) */}
        {orderType === "limit" && (
          <NumericInput
            label="Limit Price"
            value={limitPrice}
            onChange={setLimitPrice}
            placeholder={markPrice}
            rightAddon="USD"
            decimals={2}
          />
        )}

        {/* Margin Input */}
        <NumericInput
          label="Margin"
          value={margin}
          onChange={setMargin}
          placeholder="0.00"
          rightAddon="USDC"
          decimals={2}
        />

        {/* Quick margin buttons */}
        <div className="flex gap-2">
          {[25, 50, 75, 100].map((pct) => (
            <button
              key={pct}
              onClick={() => {
                // TODO: Get actual balance and set percentage
                setMargin((100 * pct / 100).toString());
              }}
              className={cn(
                "flex-1 py-1 rounded-[var(--radius-sm)]",
                "text-[var(--text-xs)] font-medium",
                "bg-[var(--bg-hover)] text-[var(--text-muted)]",
                "hover:text-[var(--text-secondary)]",
                "transition-colors duration-[var(--transition-fast)]"
              )}
            >
              {pct}%
            </button>
          ))}
        </div>

        {/* Leverage Slider */}
        <LeverageSlider
          value={leverage}
          onChange={setLeverage}
          maxLeverage={maxLeverage}
        />

        {/* Order Summary */}
        <Card padding="sm" className="space-y-2">
          <SummaryRow label="Position Size" value={`$${positionSize}`} />
          <SummaryRow label="Entry Price" value={`$${markPrice}`} />
          <SummaryRow
            label="Liquidation Price"
            value={`$${estimatedLiqPrice()}`}
            highlight={side === "short" ? "long" : "short"}
          />
          <SummaryRow label="Trading Fee" value="0.05%" />
        </Card>
      </div>

      {/* Submit Button */}
      <div className="p-4 border-t border-[var(--border-subtle)]">
        {isConnected ? (
          <Button
            variant={side}
            fullWidth
            size="lg"
            loading={isSubmitting}
            disabled={!margin || parseFloat(margin) <= 0}
            onClick={handleSubmit}
          >
            {side === "long" ? "Long" : "Short"} {marketSymbol}
          </Button>
        ) : (
          <Button variant="primary" fullWidth size="lg" disabled>
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
  highlight?: "long" | "short";
}

function SummaryRow({ label, value, highlight }: SummaryRowProps) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[var(--text-xs)] text-[var(--text-muted)]">
        {label}
      </span>
      <span
        className={cn(
          "text-[var(--text-sm)] tabular-nums font-medium",
          highlight === "long" && "text-[var(--color-long)]",
          highlight === "short" && "text-[var(--color-short)]"
        )}
      >
        {value}
      </span>
    </div>
  );
}
