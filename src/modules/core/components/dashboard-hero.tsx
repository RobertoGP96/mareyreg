"use client";

import { motion } from "framer-motion";
import { Activity, Clock } from "lucide-react";

export function DashboardHero({ userName, totalCount }: { userName: string; totalCount: number }) {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Buenos días" : hour < 19 ? "Buenas tardes" : "Buenas noches";
  const today = new Date().toLocaleDateString("es-MX", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      className="relative overflow-hidden rounded-2xl border border-border bg-card shadow-panel"
    >
      {/* Decorative mesh layer */}
      <div className="pointer-events-none absolute inset-0 mesh-bg opacity-70" />
      <div className="pointer-events-none absolute inset-0 grid-pattern opacity-[0.35]" />

      {/* Right-side accent block */}
      <div className="pointer-events-none absolute right-0 top-0 h-full w-1/3">
        <div className="absolute inset-0 bg-gradient-to-l from-[var(--brand)]/10 via-transparent to-transparent" />
      </div>

      <div className="relative p-6 md:p-8 flex flex-col md:flex-row md:items-center gap-6">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-3">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--brand)]/10 px-2.5 py-0.5 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-[var(--brand)] ring-1 ring-inset ring-[var(--brand)]/20">
              <span className="relative flex size-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--brand)] opacity-75" />
                <span className="relative inline-flex size-1.5 rounded-full bg-[var(--brand)]" />
              </span>
              En línea
            </span>
            <span className="inline-flex items-center gap-1.5 text-[0.72rem] text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span className="capitalize">{today}</span>
            </span>
          </div>

          <h1 className="text-2xl md:text-[1.75rem] font-bold font-headline tracking-tight text-foreground">
            {greeting}, <span className="text-gradient-brand">{userName}</span>
          </h1>
          <p className="mt-1.5 text-sm md:text-base text-muted-foreground max-w-xl">
            Panorama actual del sistema MAREYreg — todas tus operaciones de flota, inventario y logística en un solo lugar.
          </p>
        </div>

        <div className="flex items-center gap-3 md:flex-col md:items-end md:text-right">
          <div className="flex size-12 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--brand)] to-[color-mix(in_oklch,var(--brand)_60%,#b45309)] shadow-[0_8px_24px_-6px_color-mix(in_oklch,var(--brand)_50%,transparent)]">
            <Activity className="h-6 w-6 text-white" />
          </div>
          <div>
            <div className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Registros activos
            </div>
            <div className="text-2xl font-bold font-headline tabular-nums text-foreground">
              {totalCount.toLocaleString()}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
