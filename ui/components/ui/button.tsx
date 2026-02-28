"use client";

import { cn } from "@/lib/cn";
import { type ButtonHTMLAttributes, type ReactNode } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "long" | "short" | "ghost" | "accent";
  size?: "sm" | "md" | "lg";
  children: ReactNode;
}

const VARIANT_STYLES: Record<string, { className: string; style?: React.CSSProperties }> = {
  primary:   { className: "bg-[var(--bg-elevated)] text-[var(--text-primary)] border border-[var(--border-default)] hover:bg-[var(--bg-overlay)] hover:border-[var(--border-strong)]" },
  secondary: { className: "bg-transparent text-[var(--text-secondary)] border border-[var(--border-default)] hover:text-[var(--text-primary)] hover:border-[var(--border-strong)]" },
  ghost:     { className: "bg-transparent text-[var(--text-tertiary)] border border-transparent hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]" },
  accent:    {
    className: "text-black border border-transparent hover:brightness-110",
    style: { background: "linear-gradient(135deg, var(--accent) 0%, #fbbf24 100%)", boxShadow: "0 0 12px var(--accent-glow)" },
  },
  long: {
    className: "text-black border border-transparent",
    style: { background: "linear-gradient(135deg, #009f5e 0%, var(--long) 100%)", boxShadow: "0 0 14px var(--long-glow), inset 0 1px 0 rgba(255,255,255,0.15)" },
  },
  short: {
    className: "text-black border border-transparent",
    style: { background: "linear-gradient(135deg, #a01f36 0%, var(--short) 100%)", boxShadow: "0 0 14px var(--short-glow), inset 0 1px 0 rgba(255,255,255,0.10)" },
  },
};

export function Button({
  variant = "primary",
  size = "md",
  className,
  children,
  style,
  ...props
}: ButtonProps) {
  const v = VARIANT_STYLES[variant] ?? VARIANT_STYLES.primary;
  return (
    <button
      className={cn(
        "font-semibold rounded-xl transition-all duration-150 active:scale-[0.97] relative overflow-hidden",
        size === "sm" && "px-3 py-1.5 text-xs",
        size === "md" && "px-4 py-2.5 text-xs",
        size === "lg" && "px-6 py-3 text-sm",
        v.className,
        className
      )}
      style={{ ...v.style, ...style }}
      {...props}
    >
      {(variant === "long" || variant === "short" || variant === "accent") && (
        <span className="absolute inset-0 pointer-events-none"
          style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.12) 0%, transparent 55%)" }} />
      )}
      <span className="relative">{children}</span>
    </button>
  );
}
