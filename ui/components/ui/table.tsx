"use client";

import { type ReactNode, type ThHTMLAttributes, type TdHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

interface TableProps {
  children: ReactNode;
  className?: string;
}

export function Table({ children, className }: TableProps) {
  return (
    <div className="overflow-x-auto">
      <table className={cn("w-full", className)}>{children}</table>
    </div>
  );
}

export function TableHeader({ children, className }: TableProps) {
  return <thead className={cn("bg-[var(--bg-void)]/50", className)}>{children}</thead>;
}

export function TableBody({ children, className }: TableProps) {
  return <tbody className={cn(className)}>{children}</tbody>;
}

export function TableRow({ children, className }: TableProps) {
  return (
    <tr
      className={cn(
        "border-b border-[var(--border-subtle)]",
        "transition-colors duration-[var(--transition-fast)]",
        "hover:bg-[var(--bg-hover)]",
        "last:border-b-0",
        className
      )}
    >
      {children}
    </tr>
  );
}

interface TableHeadProps extends ThHTMLAttributes<HTMLTableCellElement> {
  children?: ReactNode;
  align?: "left" | "center" | "right";
}

export function TableHead({
  children,
  align = "left",
  className,
  ...props
}: TableHeadProps) {
  return (
    <th
      className={cn(
        "px-3 py-2",
        "text-[var(--text-2xs)] font-medium text-[var(--text-muted)]",
        "uppercase tracking-wider",
        "border-b border-[var(--border-subtle)]",
        {
          "text-left": align === "left",
          "text-center": align === "center",
          "text-right": align === "right",
        },
        className
      )}
      {...props}
    >
      {children}
    </th>
  );
}

interface TableCellProps extends TdHTMLAttributes<HTMLTableCellElement> {
  children?: ReactNode;
  align?: "left" | "center" | "right";
  mono?: boolean;
}

export function TableCell({
  children,
  align = "left",
  mono = false,
  className,
  ...props
}: TableCellProps) {
  return (
    <td
      className={cn(
        "px-3 py-2",
        "text-[var(--text-sm)]",
        mono && "font-mono tabular-nums",
        {
          "text-left": align === "left",
          "text-center": align === "center",
          "text-right": align === "right",
        },
        className
      )}
      {...props}
    >
      {children}
    </td>
  );
}

interface TableEmptyProps {
  message?: string;
  colSpan: number;
}

export function TableEmpty({
  message = "No data available",
  colSpan,
}: TableEmptyProps) {
  return (
    <tr>
      <td
        colSpan={colSpan}
        className="px-3 py-10 text-center text-[var(--text-sm)] text-[var(--text-muted)]"
      >
        {message}
      </td>
    </tr>
  );
}
