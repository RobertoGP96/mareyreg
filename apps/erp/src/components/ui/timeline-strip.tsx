"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import type { OpsStatus } from "./status-pill";

const TONE_DOT: Record<string, string> = {
  scheduled:   "status-dot--idle",
  in_progress: "status-dot--active status-pulse--active",
  completed:   "status-dot--success",
  cancelled:   "status-dot--critical",
  delayed:     "status-dot--warning status-pulse--warning",
  paid:        "status-dot--success",
  pending:     "status-dot--warning",
  available:   "status-dot--success",
  maintenance: "status-dot--warning",
  active:      "status-dot--active",
  inactive:    "status-dot--idle",
};

export type TimelineEvent = {
  id: string | number;
  title: string;
  subtitle?: string;
  status: OpsStatus;
  time?: string;
  onClick?: () => void;
};

type TimelineStripProps = {
  events: TimelineEvent[];
  className?: string;
  emptyLabel?: string;
};

export function TimelineStrip({ events, className, emptyLabel = "Sin eventos." }: TimelineStripProps) {
  if (events.length === 0) {
    return (
      <div className={cn("rounded-lg border border-dashed border-border bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground", className)}>
        {emptyLabel}
      </div>
    );
  }

  return (
    <div className={cn("relative", className)}>
      <div className="overflow-x-auto pb-2">
        <ol className="relative flex min-w-full items-stretch gap-3 pt-1">
          {events.map((ev) => {
            const Comp = ev.onClick ? "button" : "div";
            return (
              <li key={ev.id} className="relative flex-shrink-0">
                <Comp
                  type={ev.onClick ? "button" : undefined}
                  onClick={ev.onClick}
                  className={cn(
                    "flex w-44 flex-col gap-1.5 rounded-lg border border-border bg-card px-3 py-2.5 text-left transition-colors",
                    ev.onClick && "cursor-pointer hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span className={cn("status-dot", TONE_DOT[ev.status])} aria-hidden />
                    {ev.time && (
                      <span className="text-[10.5px] font-mono tabular-nums text-muted-foreground">
                        {ev.time}
                      </span>
                    )}
                  </div>
                  <div className="text-sm font-semibold leading-tight text-foreground line-clamp-1">
                    {ev.title}
                  </div>
                  {ev.subtitle && (
                    <div className="text-xs text-muted-foreground line-clamp-1">{ev.subtitle}</div>
                  )}
                </Comp>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
