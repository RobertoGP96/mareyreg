import {
  Home,
  Users,
  Truck,
  RouteIcon,
  DollarSign,
  Package,
  Settings,
  Shirt,
  Tags,
  CalendarCheck,
  Receipt,
  BarChart3,
  Warehouse,
  ArrowLeftRight,
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
    id: "fleet",
    label: "Flota",
    icon: Truck,
    enabled: true,
    routes: [
      { name: "Conductores", href: "/drivers", icon: Users },
      { name: "Vehiculos", href: "/vehicles", icon: Truck },
    ],
  },
  {
    id: "logistics",
    label: "Logistica",
    icon: RouteIcon,
    enabled: true,
    routes: [{ name: "Viajes", href: "/trips", icon: RouteIcon }],
  },
  {
    id: "pacas",
    label: "Pacas",
    icon: Shirt,
    enabled: true,
    routes: [
      { name: "Inventario", href: "/pacas", icon: Shirt },
      { name: "Disponibilidad", href: "/pacas/disponibilidad", icon: BarChart3 },
      { name: "Reservaciones", href: "/pacas/reservaciones", icon: CalendarCheck },
      { name: "Ventas", href: "/pacas/ventas", icon: Receipt },
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
      { name: "Stock", href: "/stock", icon: ArrowLeftRight },
    ],
  },
  {
    id: "payments",
    label: "Pagos",
    icon: DollarSign,
    enabled: false,
    routes: [{ name: "Pagos", href: "/payments", icon: DollarSign }],
  },
];

export const fixedRoutes: ModuleRoute[] = [
  { name: "Inicio", href: "/", icon: Home },
];

export const settingsRoute: ModuleRoute = {
  name: "Configuracion",
  href: "/settings",
  icon: Settings,
};

export function getEnabledModules(): AppModule[] {
  return modules.filter((m) => m.enabled);
}

export function getAllNavigationRoutes(): ModuleRoute[] {
  const enabledRoutes = getEnabledModules().flatMap((m) => m.routes);
  return [...fixedRoutes, ...enabledRoutes, settingsRoute];
}
