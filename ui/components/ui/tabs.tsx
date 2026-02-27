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
      className={cn(
        "flex items-center gap-1",
        "p-1 rounded-[var(--radius-md)]",
        "bg-[var(--bg-elevated)]",
        "border border-[var(--border-subtle)]",
        className
      )}
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
        "flex-1 px-3 py-1.5",
        "text-[var(--text-sm)] font-medium",
        "rounded-[var(--radius-sm)]",
        "transition-colors duration-[var(--transition-fast)]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]",
        isActive
          ? "bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-sm"
          : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]",
        disabled && "opacity-50 cursor-not-allowed",
        className
      )}
    >
      {children}
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
    <div
      role="tabpanel"
      className={cn("mt-4 animate-fade-in", className)}
    >
      {children}
    </div>
  );
}

// Toggle tabs specifically for Long/Short selection
interface ToggleTabsProps {
  value: "long" | "short";
  onChange: (value: "long" | "short") => void;
  className?: string;
}

export function LongShortTabs({ value, onChange, className }: ToggleTabsProps) {
  return (
    <div
      className={cn(
        "flex gap-1 p-1",
        "rounded-[var(--radius-md)]",
        "bg-[var(--bg-elevated)]",
        className
      )}
    >
      <button
        onClick={() => onChange("long")}
        className={cn(
          "flex-1 py-2 px-4",
          "text-[var(--text-sm)] font-semibold",
          "rounded-[var(--radius-sm)]",
          "transition-all duration-[var(--transition-fast)]",
          value === "long"
            ? "bg-[var(--color-long)] text-white shadow-[var(--shadow-glow-long)]"
            : "text-[var(--text-muted)] hover:text-[var(--color-long)]"
        )}
      >
        Long
      </button>
      <button
        onClick={() => onChange("short")}
        className={cn(
          "flex-1 py-2 px-4",
          "text-[var(--text-sm)] font-semibold",
          "rounded-[var(--radius-sm)]",
          "transition-all duration-[var(--transition-fast)]",
          value === "short"
            ? "bg-[var(--color-short)] text-white shadow-[var(--shadow-glow-short)]"
            : "text-[var(--text-muted)] hover:text-[var(--color-short)]"
        )}
      >
        Short
      </button>
    </div>
  );
}
