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
  Users,
  ShoppingCart,
  FileText,
  Receipt,
  ClipboardList,
  BarChart3,
  LineChart,
  HandCoins,
  CreditCard,
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
      { name: "Clientes", href: "/pacas-clientes", icon: Users },
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
    id: "partners",
    label: "Directorio",
    icon: Users,
    enabled: true,
    routes: [
      { name: "Proveedores", href: "/suppliers", icon: Building2 },
      { name: "Clientes", href: "/customers", icon: Users },
    ],
  },
  {
    id: "purchasing",
    label: "Compras",
    icon: ShoppingCart,
    enabled: true,
    routes: [
      { name: "Ordenes de compra", href: "/purchase-orders", icon: FileText },
      { name: "Cuentas por pagar", href: "/accounts-payable", icon: HandCoins },
    ],
  },
  {
    id: "sales",
    label: "Ventas",
    icon: ShoppingBag,
    enabled: true,
    routes: [
      { name: "POS", href: "/pos", icon: CreditCard },
      { name: "Facturas", href: "/invoices", icon: Receipt },
      { name: "Cuentas por cobrar", href: "/accounts-receivable", icon: ClipboardList },
    ],
  },
  {
    id: "reporting",
    label: "Reportes",
    icon: BarChart3,
    enabled: true,
    routes: [
      { name: "Dashboard", href: "/reports/dashboard", icon: LayoutDashboard },
      { name: "Kardex", href: "/reports/kardex", icon: LineChart },
      { name: "Analisis ABC", href: "/reports/abc", icon: BarChart3 },
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
