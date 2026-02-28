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
  default: "bg-[var(--bg-hover)] text-[var(--text-secondary)] border border-[var(--border-subtle)]",
  long: "bg-[var(--color-long-subtle)] text-[var(--color-long)] border border-[var(--color-long-glow)]",
  short: "bg-[var(--color-short-subtle)] text-[var(--color-short)] border border-[var(--color-short-glow)]",
  warning: "bg-[var(--color-warning-subtle)] text-[var(--color-warning)] border border-[var(--color-warning-glow)]",
  regime: "", // handled by regime prop
};

const regimeStyles: Record<RegimeType, string> = {
  open: "regime-open",
  "off-hours": "regime-off-hours",
  transition: "regime-transition",
  stress: "regime-stress",
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
        "px-2.5 py-1",
        "text-[var(--text-2xs)] font-semibold",
        "rounded-[var(--radius-sm)]",
        "uppercase tracking-widest",
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
