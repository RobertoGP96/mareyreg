"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowUpRight,
  Building2,
  Users,
  Truck,
  Route as RouteIcon,
  Shirt,
  Package,
  Warehouse,
  type LucideIcon,
} from "lucide-react";

export type DashboardIconKey =
  | "building"
  | "users"
  | "truck"
  | "route"
  | "shirt"
  | "package"
  | "warehouse";

// Icon registry is resolved on the client side so that the dashboard page
// (server component) can pass plain string keys through the RSC boundary
// without trying to serialize the forwardRef component.
const ICON_MAP: Record<DashboardIconKey, LucideIcon> = {
  building: Building2,
  users: Users,
  truck: Truck,
  route: RouteIcon,
  shirt: Shirt,
  package: Package,
  warehouse: Warehouse,
};

export type DashboardStat = {
  label: string;
  count: number;
  href: string;
  icon: DashboardIconKey;
  extra?: string;
  accent: "brand" | "info" | "teal" | "amber" | "indigo";
};

const accentStyles: Record<
  DashboardStat["accent"],
  { iconBg: string; iconColor: string; glow: string; ring: string }
> = {
  brand:  { iconBg: "from-[var(--brand)]/20 to-[var(--brand)]/5",      iconColor: "text-[var(--brand)]",   glow: "from-[var(--brand)]/10",    ring: "group-hover:ring-[var(--brand)]/30" },
  info:   { iconBg: "from-[var(--info)]/20 to-[var(--info)]/5",        iconColor: "text-[var(--info)]",    glow: "from-[var(--info)]/10",     ring: "group-hover:ring-[var(--info)]/30" },
  teal:   { iconBg: "from-[var(--chart-2)]/25 to-[var(--chart-2)]/5",  iconColor: "text-[var(--chart-2)]", glow: "from-[var(--chart-2)]/10",  ring: "group-hover:ring-[var(--chart-2)]/30" },
  amber:  { iconBg: "from-[var(--warning)]/25 to-[var(--warning)]/5",  iconColor: "text-[var(--warning)]", glow: "from-[var(--warning)]/10",  ring: "group-hover:ring-[var(--warning)]/30" },
  indigo: { iconBg: "from-[var(--chart-5)]/25 to-[var(--chart-5)]/5",  iconColor: "text-[var(--chart-5)]", glow: "from-[var(--chart-5)]/10",  ring: "group-hover:ring-[var(--chart-5)]/30" },
};

export function DashboardStats({ stats }: { stats: DashboardStat[] }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {stats.map((s, i) => {
        const style = accentStyles[s.accent];
        const Icon = ICON_MAP[s.icon];
        return (
          <motion.div
            key={s.href}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: i * 0.05, ease: [0.16, 1, 0.3, 1] }}
          >
            <Link
              href={s.href}
              className={`group relative block overflow-hidden rounded-xl border border-border bg-card p-5 shadow-panel transition-all hover:shadow-elevated hover:-translate-y-0.5 ring-1 ring-transparent ${style.ring}`}
            >
              <div className={`pointer-events-none absolute -top-10 -right-10 h-32 w-32 rounded-full bg-gradient-to-br ${style.glow} to-transparent blur-2xl opacity-80`} />

              <div className="relative flex items-start justify-between mb-5">
                <div className={`flex size-11 items-center justify-center rounded-lg bg-gradient-to-br ${style.iconBg} ring-1 ring-inset ring-border/60`}>
                  {Icon && <Icon className={`h-5 w-5 ${style.iconColor}`} strokeWidth={2} />}
                </div>
                <ArrowUpRight className="h-4 w-4 text-muted-foreground/50 transition-all group-hover:text-foreground group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              </div>

              <div className="relative space-y-1">
                <p className="text-[0.72rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  {s.label}
                </p>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold text-foreground font-headline tabular-nums">
                    {s.count.toLocaleString()}
                  </span>
                  {s.extra && (
                    <span className={`text-xs font-medium ${style.iconColor}`}>
                      {s.extra}
                    </span>
                  )}
                </div>
              </div>

              <div className="mt-4 h-0.5 w-full overflow-hidden rounded-full bg-border/60">
                <div
                  className={`h-full bg-gradient-to-r ${style.iconBg.replace('/5', '/80').replace('/20', '')} transition-transform duration-500 origin-left group-hover:scale-x-100 scale-x-[0.35]`}
                />
              </div>
            </Link>
          </motion.div>
        );
      })}
    </div>
  );
}
