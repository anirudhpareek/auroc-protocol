"use client";

import { cn } from "@/lib/cn";
import { type ButtonHTMLAttributes, type ReactNode } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "long" | "short" | "ghost";
  size?: "sm" | "md" | "lg";
  children: ReactNode;
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "font-medium rounded-lg transition-all",
        size === "sm" && "px-3 py-1.5 text-xs",
        size === "md" && "px-4 py-2 text-sm",
        size === "lg" && "px-6 py-3 text-sm",
        variant === "primary" && "bg-[var(--gray-800)] text-white hover:bg-[var(--gray-700)]",
        variant === "secondary" && "bg-transparent border border-[var(--gray-700)] text-[var(--gray-400)] hover:text-white hover:border-[var(--gray-600)]",
        variant === "long" && "bg-[var(--green)] text-black hover:bg-[var(--green-dark)]",
        variant === "short" && "bg-[var(--red)] text-white hover:bg-[var(--red-dark)]",
        variant === "ghost" && "bg-transparent text-[var(--gray-400)] hover:text-white hover:bg-[var(--gray-800)]",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
