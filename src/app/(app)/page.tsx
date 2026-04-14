export const dynamic = "force-dynamic";

import Link from "next/link";
import { Users, Truck, RouteIcon, Shirt, Package, Warehouse, ClipboardList, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { auth } from "@/lib/auth";
import { getDrivers } from "@/modules/fleet/queries/driver-queries";
import { getVehicles } from "@/modules/fleet/queries/vehicle-queries";
import { getEntities } from "@/modules/fleet/queries/entity-queries";
import { getTrips } from "@/modules/logistics/queries/trip-queries";
import { getPacaInventoryStats } from "@/modules/pacas/queries/paca-queries";
import { getProducts } from "@/modules/inventory/queries/product-queries";
import { getWarehouses } from "@/modules/inventory/queries/warehouse-queries";

const MODULE_STATS: Record<string, string[]> = {
  logistics: ["Entidades", "Conductores", "Vehiculos", "Viajes"],
  pacas: ["Pacas"],
  inventory: ["Productos", "Almacenes"],
};

export default async function Home() {
  const session = await auth();
  const userModules = session?.user?.modules ?? [];
  const isAdmin = session?.user?.role === "admin";

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

  const allStats = [
    { label: "Entidades", count: entities.length, href: "/entities", icon: Building2 },
    { label: "Conductores", count: drivers.length, href: "/drivers", icon: Users },
    { label: "Vehiculos", count: vehicles.length, href: "/vehicles", icon: Truck },
    { label: "Viajes", count: trips.length, href: "/trips", icon: RouteIcon },
    { label: "Pacas", count: pacasStats.total, href: "/pacas", icon: Shirt, extra: `${pacasStats.available} disponibles` },
    { label: "Productos", count: products.length, href: "/products", icon: Package },
    { label: "Almacenes", count: warehouses.length, href: "/warehouses", icon: Warehouse },
  ];

  const stats = allStats.filter((s) => {
    if (isAdmin) return true;
    return Object.entries(MODULE_STATS).some(
      ([moduleId, labels]) => labels.includes(s.label) && userModules.includes(moduleId)
    );
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold font-headline tracking-tight text-foreground">Inicio</h1>
        <p className="text-muted-foreground mt-1">
          Bienvenido al Sistema de Gestion MAREYreg
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {stats.map((s) => (
          <div key={s.href} className="bg-card p-4 rounded-lg border">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-lg bg-muted">
                <s.icon className="h-6 w-6 text-muted-foreground" />
              </div>
              <div className="flex-1">
                <h2 className="text-base font-semibold">{s.label}</h2>
                {s.extra && (
                  <p className="text-xs text-muted-foreground">{s.extra}</p>
                )}
              </div>
              <p className="text-xl font-bold text-muted-foreground">{s.count}</p>
            </div>
            <Link href={s.href}>
              <Button variant="outline" className="w-full" size="sm">
                <ClipboardList className="h-4 w-4 mr-2" />
                Gestionar
              </Button>
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
