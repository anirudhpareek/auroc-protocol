"use client";

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/cn";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "long" | "short" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  fullWidth?: boolean;
  children: ReactNode;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary: `
    bg-[var(--accent-primary)] text-[var(--bg-void)]
    font-semibold
    hover:shadow-[var(--glow-accent)]
    active:scale-[0.98]
  `,
  secondary: `
    bg-[var(--bg-elevated)] text-[var(--text-primary)]
    border border-[var(--border-default)]
    hover:bg-[var(--bg-hover)] hover:border-[var(--accent-primary)]
    active:bg-[var(--bg-active)]
  `,
  ghost: `
    bg-transparent text-[var(--text-secondary)]
    hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]
    active:bg-[var(--bg-active)]
  `,
  long: `
    bg-[var(--color-long)] text-[var(--bg-void)]
    font-semibold
    hover:shadow-[var(--glow-long)]
    active:scale-[0.98]
  `,
  short: `
    bg-[var(--color-short)] text-white
    font-semibold
    hover:shadow-[var(--glow-short)]
    active:scale-[0.98]
  `,
  danger: `
    bg-[var(--color-short)] text-white
    font-semibold
    hover:shadow-[var(--glow-short)]
    active:scale-[0.98]
  `,
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-[var(--text-sm)] gap-1.5",
  md: "h-10 px-5 text-[var(--text-sm)] gap-2",
  lg: "h-12 px-6 text-[var(--text-base)] gap-2",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      loading = false,
      fullWidth = false,
      disabled,
      className,
      children,
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          // Base styles
          "inline-flex items-center justify-center",
          "font-medium rounded-[var(--radius-md)]",
          "transition-all duration-[var(--transition-fast)]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-base)]",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          // Variant
          variantStyles[variant],
          // Size
          sizeStyles[size],
          // Full width
          fullWidth && "w-full",
          className
        )}
        {...props}
      >
        {loading ? (
          <>
            <Spinner />
            <span>Loading...</span>
          </>
        ) : (
          children
        )}
      </button>
    );
  }
);

Button.displayName = "Button";

function Spinner() {
  return (
    <svg
      className="animate-spin h-4 w-4"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}
