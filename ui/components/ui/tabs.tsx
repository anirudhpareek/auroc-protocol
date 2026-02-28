"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";

interface TabsContextValue {
  activeTab: string;
  setActiveTab: (value: string) => void;
}

const TabsContext = createContext<TabsContextValue | null>(null);

function useTabsContext() {
  const context = useContext(TabsContext);
  if (!context) {
    throw new Error("Tabs components must be used within a Tabs provider");
  }
  return context;
}

interface TabsProps {
  defaultValue: string;
  value?: string;
  onValueChange?: (value: string) => void;
  children: ReactNode;
  className?: string;
}

export function Tabs({
  defaultValue,
  value,
  onValueChange,
  children,
  className,
}: TabsProps) {
  const [internalValue, setInternalValue] = useState(defaultValue);
  const activeTab = value ?? internalValue;

  const setActiveTab = (newValue: string) => {
    if (!value) {
      setInternalValue(newValue);
    }
    onValueChange?.(newValue);
  };

  return (
    <TabsContext.Provider value={{ activeTab, setActiveTab }}>
      <div className={cn("flex flex-col", className)}>{children}</div>
    </TabsContext.Provider>
  );
}

interface TabsListProps {
  children: ReactNode;
  className?: string;
}

export function TabsList({ children, className }: TabsListProps) {
  return (
    <div
      role="tablist"
      className={cn("flex items-center gap-0", className)}
    >
      {children}
    </div>
  );
}

interface TabsTriggerProps {
  value: string;
  children: ReactNode;
  className?: string;
  disabled?: boolean;
}

export function TabsTrigger({
  value,
  children,
  className,
  disabled = false,
}: TabsTriggerProps) {
  const { activeTab, setActiveTab } = useTabsContext();
  const isActive = activeTab === value;

  return (
    <button
      role="tab"
      aria-selected={isActive}
      disabled={disabled}
      onClick={() => setActiveTab(value)}
      className={cn(
        "relative px-4 py-2",
        "text-[var(--text-sm)] font-medium",
        "transition-all duration-[var(--transition-fast)]",
        "focus-visible:outline-none",
        isActive
          ? "text-white"
          : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]",
        disabled && "opacity-50 cursor-not-allowed",
        className
      )}
    >
      {children}
      {isActive && (
        <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--accent-primary)]" />
      )}
    </button>
  );
}

interface TabsContentProps {
  value: string;
  children: ReactNode;
  className?: string;
}

export function TabsContent({ value, children, className }: TabsContentProps) {
  const { activeTab } = useTabsContext();

  if (activeTab !== value) {
    return null;
  }

  return (
    <div role="tabpanel" className={cn("animate-fade-in", className)}>
      {children}
    </div>
  );
}

// Long/Short Toggle - Trojan style pill toggle
interface ToggleTabsProps {
  value: "long" | "short";
  onChange: (value: "long" | "short") => void;
  className?: string;
}

export function LongShortTabs({ value, onChange, className }: ToggleTabsProps) {
  return (
    <div
      className={cn(
        "relative flex p-1",
        "rounded-full",
        "bg-[var(--bg-surface)]",
        "border border-[var(--border-default)]",
        className
      )}
    >
      {/* Sliding Background */}
      <div
        className={cn(
          "absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-full transition-all duration-200",
          value === "long"
            ? "left-1 bg-[var(--color-long)]"
            : "left-[calc(50%+2px)] bg-[var(--color-short)]"
        )}
      />

      <button
        onClick={() => onChange("long")}
        className={cn(
          "relative flex-1 py-2.5 px-6",
          "text-[var(--text-sm)] font-semibold",
          "rounded-full",
          "transition-colors duration-200",
          "z-10",
          value === "long" ? "text-black" : "text-[var(--text-muted)]"
        )}
      >
        Long
      </button>
      <button
        onClick={() => onChange("short")}
        className={cn(
          "relative flex-1 py-2.5 px-6",
          "text-[var(--text-sm)] font-semibold",
          "rounded-full",
          "transition-colors duration-200",
          "z-10",
          value === "short" ? "text-white" : "text-[var(--text-muted)]"
        )}
      >
        Short
      </button>
    </div>
  );
}

// Order Type Tabs - Market/Limit/DCA
interface OrderTypeTabsProps {
  value: "market" | "limit";
  onChange: (value: "market" | "limit") => void;
  className?: string;
}

export function OrderTypeTabs({ value, onChange, className }: OrderTypeTabsProps) {
  return (
    <div
      className={cn(
        "flex gap-1 p-1",
        "rounded-lg",
        "bg-[var(--bg-surface)]",
        "border border-[var(--border-default)]",
        className
      )}
    >
      <button
        onClick={() => onChange("market")}
        className={cn(
          "flex-1 py-2 px-4",
          "text-[var(--text-sm)] font-medium",
          "rounded-md",
          "transition-all duration-[var(--transition-fast)]",
          value === "market"
            ? "bg-[var(--bg-elevated)] text-white"
            : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
        )}
      >
        Market
      </button>
      <button
        onClick={() => onChange("limit")}
        className={cn(
          "flex-1 py-2 px-4",
          "text-[var(--text-sm)] font-medium",
          "rounded-md",
          "transition-all duration-[var(--transition-fast)]",
          value === "limit"
            ? "bg-[var(--bg-elevated)] text-white"
            : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
        )}
      >
        Limit
      </button>
    </div>
  );
}
