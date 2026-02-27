"use client";

import { type ReactNode } from "react";
import { cn } from "@/lib/cn";

interface CardProps {
  children: ReactNode;
  className?: string;
  padding?: "none" | "sm" | "md" | "lg";
  elevated?: boolean;
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
}: CardProps) {
  return (
    <div
      className={cn(
        "rounded-[var(--radius-lg)]",
        "border",
        elevated
          ? "bg-[var(--bg-elevated)] border-[var(--border-default)]"
          : "bg-[var(--bg-surface)] border-[var(--border-subtle)]",
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
}

export function StatCard({
  label,
  value,
  change,
  prefix,
  suffix,
  className,
}: StatCardProps) {
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <span className="text-[var(--text-xs)] text-[var(--text-muted)] uppercase tracking-wide">
        {label}
      </span>
      <div className="flex items-baseline gap-1">
        {prefix && (
          <span className="text-[var(--text-muted)] text-[var(--text-sm)]">
            {prefix}
          </span>
        )}
        <span className="text-[var(--text-xl)] font-semibold tabular-nums">
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
            "text-[var(--text-xs)] tabular-nums",
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
