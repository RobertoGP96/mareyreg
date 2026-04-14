import {
  LayoutDashboard,
  Contact,
  Truck,
  Route,
  CircleDollarSign,
  Package,
  Settings2,
  Package2,
  Tags,
  BookmarkCheck,
  ShoppingBag,
  PackageCheck,
  Warehouse,
  PackageOpen,
  Building2,
  type LucideIcon,
} from "lucide-react";

export interface ModuleRoute {
  name: string;
  href: string;
  icon: LucideIcon;
}

export interface AppModule {
  id: string;
  label: string;
  icon: LucideIcon;
  routes: ModuleRoute[];
  enabled: boolean;
}

export const modules: AppModule[] = [
  {
    id: "logistics",
    label: "Logistica",
    icon: Route,
    enabled: true,
    routes: [
      { name: "Entidades", href: "/entities", icon: Building2 },
      { name: "Conductores", href: "/drivers", icon: Contact },
      { name: "Vehiculos", href: "/vehicles", icon: Truck },
      { name: "Viajes", href: "/trips", icon: Route },
    ],
  },
  {
    id: "pacas",
    label: "Pacas",
    icon: Package2,
    enabled: true,
    routes: [
      { name: "Inventario", href: "/pacas", icon: Package2 },
      { name: "Disponibilidad", href: "/pacas/disponibilidad", icon: PackageCheck },
      { name: "Reservaciones", href: "/pacas/reservaciones", icon: BookmarkCheck },
      { name: "Ventas", href: "/pacas/ventas", icon: ShoppingBag },
      { name: "Categorias", href: "/pacas/categorias", icon: Tags },
    ],
  },
  {
    id: "inventory",
    label: "Inventario",
    icon: Package,
    enabled: true,
    routes: [
      { name: "Productos", href: "/products", icon: Package },
      { name: "Almacenes", href: "/warehouses", icon: Warehouse },
      { name: "Stock", href: "/stock", icon: PackageOpen },
    ],
  },
  {
    id: "payments",
    label: "Pagos",
    icon: CircleDollarSign,
    enabled: false,
    routes: [{ name: "Pagos", href: "/payments", icon: CircleDollarSign }],
  },
];

export const fixedRoutes: ModuleRoute[] = [
  { name: "Inicio", href: "/", icon: LayoutDashboard },
];

export const settingsRoute: ModuleRoute = {
  name: "Configuracion",
  href: "/settings",
  icon: Settings2,
};

export function getEnabledModules(): AppModule[] {
  return modules.filter((m) => m.enabled);
}

export function getEnabledModuleIds(): string[] {
  return getEnabledModules().map((m) => m.id);
}

export function getAllNavigationRoutes(): ModuleRoute[] {
  const enabledRoutes = getEnabledModules().flatMap((m) => m.routes);
  return [...fixedRoutes, ...enabledRoutes, settingsRoute];
}
