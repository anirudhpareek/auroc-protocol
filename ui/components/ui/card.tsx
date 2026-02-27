"use client";

import { type ReactNode } from "react";
import { cn } from "@/lib/cn";

interface CardProps {
  children: ReactNode;
  className?: string;
  padding?: "none" | "sm" | "md" | "lg";
  elevated?: boolean;
  glow?: boolean;
}

const paddingStyles = {
  none: "",
  sm: "p-3",
  md: "p-4",
  lg: "p-6",
};

export function Card({
  children,
  className,
  padding = "md",
  elevated = false,
  glow = false,
}: CardProps) {
  return (
    <div
      className={cn(
        "rounded-[var(--radius-lg)]",
        "border",
        "backdrop-blur-sm",
        elevated
          ? "bg-[var(--bg-elevated)]/90 border-[var(--border-default)]"
          : "bg-[var(--bg-surface)]/80 border-[var(--border-subtle)]",
        glow && "panel-glow",
        paddingStyles[padding],
        className
      )}
    >
      {children}
    </div>
  );
}

interface CardHeaderProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  className?: string;
}

export function CardHeader({ title, subtitle, action, className }: CardHeaderProps) {
  return (
    <div className={cn("flex items-center justify-between mb-4", className)}>
      <div>
        <h3 className="text-[var(--text-lg)] font-semibold text-[var(--text-primary)]">
          {title}
        </h3>
        {subtitle && (
          <p className="text-[var(--text-sm)] text-[var(--text-muted)] mt-0.5">
            {subtitle}
          </p>
        )}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}

interface CardContentProps {
  children: ReactNode;
  className?: string;
}

export function CardContent({ children, className }: CardContentProps) {
  return <div className={cn(className)}>{children}</div>;
}

// Stats card for displaying key metrics
interface StatCardProps {
  label: string;
  value: string | number;
  change?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
  glow?: boolean;
}

export function StatCard({
  label,
  value,
  change,
  prefix,
  suffix,
  className,
  glow = false,
}: StatCardProps) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <span className="text-[var(--text-2xs)] text-[var(--text-muted)] uppercase tracking-widest font-medium">
        {label}
      </span>
      <div className="flex items-baseline gap-1.5">
        {prefix && (
          <span className="text-[var(--text-muted)] text-[var(--text-sm)]">
            {prefix}
          </span>
        )}
        <span className={cn(
          "text-[var(--text-2xl)] font-semibold tabular-nums tracking-tight",
          glow && "glow-text text-[var(--accent-primary)]"
        )}>
          {value}
        </span>
        {suffix && (
          <span className="text-[var(--text-muted)] text-[var(--text-sm)]">
            {suffix}
          </span>
        )}
      </div>
      {change !== undefined && (
        <span
          className={cn(
            "text-[var(--text-xs)] tabular-nums font-medium",
            change >= 0 ? "text-[var(--color-long)]" : "text-[var(--color-short)]"
          )}
        >
          {change >= 0 ? "+" : ""}
          {change.toFixed(2)}%
        </span>
      )}
    </div>
  );
}
