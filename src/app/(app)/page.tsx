export const dynamic = "force-dynamic";

import { Users, Truck, RouteIcon, Shirt, Package, Warehouse, Building2 } from "lucide-react";
import { auth } from "@/lib/auth";
import { getDrivers } from "@/modules/fleet/queries/driver-queries";
import { getVehicles } from "@/modules/fleet/queries/vehicle-queries";
import { getEntities } from "@/modules/fleet/queries/entity-queries";
import { getTrips } from "@/modules/logistics/queries/trip-queries";
import { getPacaInventoryStats } from "@/modules/pacas/queries/paca-queries";
import { getProducts } from "@/modules/inventory/queries/product-queries";
import { getWarehouses } from "@/modules/inventory/queries/warehouse-queries";
import { DashboardHero } from "@/modules/core/components/dashboard-hero";
import { DashboardStats, type DashboardStat } from "@/modules/core/components/dashboard-stats";

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
    { label: "Entidades",   count: entities.length,   href: "/entities",   icon: Building2, accent: "indigo" },
    { label: "Conductores", count: drivers.length,    href: "/drivers",    icon: Users,     accent: "info" },
    { label: "Vehículos",   count: vehicles.length,   href: "/vehicles",   icon: Truck,     accent: "brand" },
    { label: "Viajes",      count: trips.length,      href: "/trips",      icon: RouteIcon, accent: "teal" },
    { label: "Pacas",       count: pacasStats.total,  href: "/pacas",      icon: Shirt,     accent: "amber",  extra: `${pacasStats.available} disp.` },
    { label: "Productos",   count: products.length,   href: "/products",   icon: Package,   accent: "brand" },
    { label: "Almacenes",   count: warehouses.length, href: "/warehouses", icon: Warehouse, accent: "teal" },
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

      <div>
        <div className="flex items-end justify-between mb-3 px-1">
          <div>
            <h2 className="text-base md:text-lg font-semibold font-headline text-foreground">
              Resumen operacional
            </h2>
            <p className="text-xs md:text-sm text-muted-foreground">
              Accesos rápidos a los módulos con los que tienes permiso.
            </p>
          </div>
          <span className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground hidden sm:block">
            {stats.length} módulos
          </span>
        </div>
        <DashboardStats stats={stats} />
      </div>
    </div>
  );
}
