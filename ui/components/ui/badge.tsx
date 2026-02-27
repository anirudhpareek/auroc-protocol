"use client";

import { type ReactNode } from "react";
import { cn } from "@/lib/cn";

export type BadgeVariant = "default" | "long" | "short" | "warning" | "regime";
export type RegimeType = "open" | "off-hours" | "transition" | "stress";

interface BadgeProps {
  variant?: BadgeVariant;
  regime?: RegimeType;
  children?: ReactNode;
  className?: string;
}

const variantStyles: Record<BadgeVariant, string> = {
  default: "bg-[var(--bg-hover)] text-[var(--text-secondary)]",
  long: "bg-[var(--color-long-muted)] text-[var(--color-long)]",
  short: "bg-[var(--color-short-muted)] text-[var(--color-short)]",
  warning: "bg-[var(--color-warning-muted)] text-[var(--color-warning)]",
  regime: "", // handled by regime prop
};

const regimeStyles: Record<RegimeType, string> = {
  open: "bg-[rgba(34,197,94,0.15)] text-[var(--regime-open)]",
  "off-hours": "bg-[rgba(245,158,11,0.15)] text-[var(--regime-off-hours)]",
  transition: "bg-[rgba(59,130,246,0.15)] text-[var(--regime-transition)]",
  stress: "bg-[rgba(239,68,68,0.15)] text-[var(--regime-stress)]",
};

const regimeLabels: Record<RegimeType, string> = {
  open: "OPEN",
  "off-hours": "OFF HOURS",
  transition: "TRANSITION",
  stress: "STRESS",
};

export function Badge({
  variant = "default",
  regime,
  children,
  className,
}: BadgeProps) {
  const styles =
    variant === "regime" && regime ? regimeStyles[regime] : variantStyles[variant];

  return (
    <span
      className={cn(
        "inline-flex items-center",
        "px-2 py-0.5",
        "text-[var(--text-xs)] font-medium",
        "rounded-[var(--radius-sm)]",
        "uppercase tracking-wide",
        styles,
        className
      )}
    >
      {variant === "regime" && regime ? regimeLabels[regime] : children}
    </span>
  );
}

// Convenience component for regime badges
export function RegimeBadge({ regime }: { regime: RegimeType }) {
  return <Badge variant="regime" regime={regime} />;
}

// PnL badge that auto-colors based on value
export function PnLBadge({ value, className }: { value: number; className?: string }) {
  const isPositive = value >= 0;
  return (
    <span
      className={cn(
        "tabular-nums font-medium",
        isPositive ? "text-[var(--color-long)]" : "text-[var(--color-short)]",
        className
      )}
    >
      {isPositive ? "+" : ""}
      {value.toFixed(2)}
    </span>
  );
}
