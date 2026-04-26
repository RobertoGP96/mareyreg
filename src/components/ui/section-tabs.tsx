"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export type SectionTab = {
  id: string;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  badge?: string | number;
  content: React.ReactNode;
};

type SectionTabsProps = {
  tabs: SectionTab[];
  defaultTab?: string;
  className?: string;
  sticky?: boolean;
  /** Top offset (px) when sticky. Useful when there is a layout topbar. */
  stickyOffset?: number;
};

export function SectionTabs({
  tabs,
  defaultTab,
  className,
  sticky = true,
  stickyOffset = 0,
}: SectionTabsProps) {
  const [active, setActive] = React.useState(defaultTab ?? tabs[0]?.id);
  const current = tabs.find((t) => t.id === active) ?? tabs[0];

  return (
    <div className={cn("flex flex-col", className)}>
      <div
        className={cn(
          "z-10 flex items-center gap-1 overflow-x-auto border-b border-border bg-background/80 backdrop-blur",
          sticky && "sticky"
        )}
        style={sticky ? { top: stickyOffset } : undefined}
        role="tablist"
      >
        {tabs.map((t) => {
          const Icon = t.icon;
          const isActive = t.id === current?.id;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setActive(t.id)}
              className={cn(
                "relative inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors whitespace-nowrap cursor-pointer",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-1",
                isActive
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {Icon && <Icon className="size-4" />}
              {t.label}
              {t.badge != null && (
                <span
                  className={cn(
                    "inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10.5px] font-semibold",
                    isActive
                      ? "bg-[var(--ops-active)]/15 text-[var(--ops-active)]"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {t.badge}
                </span>
              )}
              {isActive && (
                <span
                  className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-[var(--ops-active)]"
                  aria-hidden
                />
              )}
            </button>
          );
        })}
      </div>
      <div className="pt-4" role="tabpanel">
        {current?.content}
      </div>
    </div>
  );
}
