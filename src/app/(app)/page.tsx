export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth";
import { getDrivers } from "@/modules/fleet/queries/driver-queries";
import { getVehicles } from "@/modules/fleet/queries/vehicle-queries";
import { getEntities } from "@/modules/fleet/queries/entity-queries";
import { getTrips } from "@/modules/logistics/queries/trip-queries";
import { getPacaInventoryStats } from "@/modules/pacas/queries/paca-queries";
import { getProducts } from "@/modules/inventory/queries/product-queries";
import { getWarehouses } from "@/modules/inventory/queries/warehouse-queries";
import { DashboardHero } from "@/modules/core/components/dashboard-hero";
import {
  DashboardStats,
  type DashboardStat,
} from "@/modules/core/components/dashboard-stats";
import { ExchangeRatesCard } from "@/modules/core/components/exchange-rates-card";
import { SectionHeading } from "@/components/ui/section-heading";
import { LayoutGrid } from "lucide-react";

const MODULE_STATS: Record<string, string[]> = {
  logistics: ["Entidades", "Conductores", "Vehículos", "Viajes"],
  pacas: ["Pacas"],
  inventory: ["Productos", "Almacenes"],
};

export default async function Home() {
  const session = await auth();
  const userModules = session?.user?.modules ?? [];
  const isAdmin = session?.user?.role === "admin";
  const userName =
    session?.user?.fullName?.split(" ")[0] ??
    session?.user?.name?.split(" ")[0] ??
    "Operador";

  const [drivers, vehicles, entities, trips, pacasStats, products, warehouses] =
    await Promise.all([
      getDrivers(),
      getVehicles(),
      getEntities(),
      getTrips(),
      getPacaInventoryStats(),
      getProducts(),
      getWarehouses(),
    ]);

  const allStats: DashboardStat[] = [
    { label: "Entidades",   count: entities.length,   href: "/entities",   icon: "building",  accent: "indigo" },
    { label: "Conductores", count: drivers.length,    href: "/drivers",    icon: "users",     accent: "info" },
    { label: "Vehículos",   count: vehicles.length,   href: "/vehicles",   icon: "truck",     accent: "brand" },
    { label: "Viajes",      count: trips.length,      href: "/trips",      icon: "route",     accent: "teal" },
    { label: "Pacas",       count: pacasStats.total,  href: "/pacas",      icon: "shirt",     accent: "amber",  extra: `${pacasStats.available} disp.` },
    { label: "Productos",   count: products.length,   href: "/products",   icon: "package",   accent: "brand" },
    { label: "Almacenes",   count: warehouses.length, href: "/warehouses", icon: "warehouse", accent: "teal" },
  ];

  const stats = allStats.filter((s) => {
    if (isAdmin) return true;
    return Object.entries(MODULE_STATS).some(
      ([moduleId, labels]) => labels.includes(s.label) && userModules.includes(moduleId)
    );
  });

  const totalCount = stats.reduce((acc, s) => acc + s.count, 0);

  return (
    <div className="space-y-5 md:space-y-6 max-w-[1600px] mx-auto">
      <DashboardHero userName={userName} totalCount={totalCount} />

      <div className="space-y-3.5">
        <SectionHeading
          eyebrow="Panorama"
          icon={LayoutGrid}
          title="Resumen operacional"
          description="Accesos rápidos a los módulos con los que tienes permiso."
          actions={
            <span className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground hidden sm:block">
              {stats.length} módulos
            </span>
          }
        />
        <DashboardStats stats={stats} />
      </div>

      <ExchangeRatesCard />
    </div>
  );
}
