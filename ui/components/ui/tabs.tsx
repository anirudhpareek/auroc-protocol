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
        "flex items-center gap-0",
        "border-b border-[var(--border-subtle)]",
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
        "relative px-3 py-2",
        "text-[var(--text-xs)] font-medium",
        "transition-colors duration-[var(--transition-fast)]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]",
        isActive
          ? "text-[var(--text-primary)]"
          : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]",
        disabled && "opacity-50 cursor-not-allowed",
        className
      )}
    >
      {children}
      {isActive && (
        <span className="absolute bottom-0 left-0 right-0 h-px bg-[var(--accent-primary)]" />
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
    <div
      role="tabpanel"
      className={cn("mt-0 animate-fade-in", className)}
    >
      {children}
    </div>
  );
}

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
        "bg-[var(--bg-void)]",
        "border border-[var(--border-subtle)]",
        className
      )}
    >
      <button
        onClick={() => onChange("long")}
        className={cn(
          "flex-1 py-2 px-4",
          "text-[var(--text-xs)] font-bold uppercase tracking-wider",
          "rounded-[var(--radius-sm)]",
          "transition-all duration-[var(--transition-fast)]",
          value === "long"
            ? "bg-[var(--color-long)] text-[var(--bg-void)]"
            : "text-[var(--text-muted)] hover:text-[var(--color-long)] hover:bg-[var(--color-long-subtle)]"
        )}
      >
        Long
      </button>
      <button
        onClick={() => onChange("short")}
        className={cn(
          "flex-1 py-2 px-4",
          "text-[var(--text-xs)] font-bold uppercase tracking-wider",
          "rounded-[var(--radius-sm)]",
          "transition-all duration-[var(--transition-fast)]",
          value === "short"
            ? "bg-[var(--color-short)] text-white"
            : "text-[var(--text-muted)] hover:text-[var(--color-short)] hover:bg-[var(--color-short-subtle)]"
        )}
      >
        Short
      </button>
    </div>
  );
}
