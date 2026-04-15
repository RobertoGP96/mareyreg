import {
  BookmarkCheck,
  Contact,
  LayoutDashboard,
  Package,
  Package2,
  PackageCheck,
  PackageOpen,
  Route,
  Settings2,
  ShoppingBag,
  Tags,
  Truck,
  Users,
  Warehouse,
  Building2,
  type LucideIcon,
} from "lucide-react";
import { getAllNavigationRoutes } from "./module-registry";

export interface BreadcrumbItem {
  label: string;
  href?: string;
  icon?: LucideIcon;
}

const ROUTE_LABELS: Record<string, string> = {
  entities: "Entidades",
  drivers: "Conductores",
  vehicles: "Vehiculos",
  trips: "Viajes",
  pacas: "Pacas",
  categorias: "Categorias",
  reservaciones: "Reservaciones",
  ventas: "Ventas",
  disponibilidad: "Disponibilidad",
  products: "Productos",
  warehouses: "Almacenes",
  stock: "Stock",
  settings: "Configuracion",
  users: "Usuarios",
  suppliers: "Proveedores",
  customers: "Clientes",
  "purchase-orders": "Ordenes de compra",
  receipts: "Recepciones",
  receipt: "Recepcion",
  "accounts-payable": "Cuentas por pagar",
  "accounts-receivable": "Cuentas por cobrar",
  invoices: "Facturas",
  quotes: "Cotizaciones",
  "sales-orders": "Ordenes de venta",
  pos: "Punto de venta",
  reports: "Reportes",
  dashboard: "Dashboard",
  kardex: "Kardex",
  abc: "Analisis ABC",
  sales: "Ventas",
};

const ROUTE_ICONS: Record<string, LucideIcon> = {
  entities: Building2,
  drivers: Contact,
  vehicles: Truck,
  trips: Route,
  pacas: Package2,
  categorias: Tags,
  reservaciones: BookmarkCheck,
  ventas: ShoppingBag,
  disponibilidad: PackageCheck,
  products: Package,
  warehouses: Warehouse,
  stock: PackageOpen,
  settings: Settings2,
  users: Users,
};

export function getBreadcrumbs(pathname: string): BreadcrumbItem[] {
  if (pathname === "/") return [{ label: "Inicio", icon: LayoutDashboard }];

  const segments = pathname.split("/").filter(Boolean);
  const items: BreadcrumbItem[] = [
    { label: "Inicio", href: "/", icon: LayoutDashboard },
  ];

  const navRoutes = getAllNavigationRoutes();

  let currentPath = "";
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    currentPath += `/${segment}`;
    const isLast = i === segments.length - 1;

    const matchedRoute = navRoutes.find((r) => r.href === currentPath);
    const label = matchedRoute?.name || ROUTE_LABELS[segment] || segment;
    const icon = matchedRoute?.icon ?? ROUTE_ICONS[segment];

    items.push({
      label,
      icon,
      href: isLast ? undefined : currentPath,
    });
  }

  return items;
}
