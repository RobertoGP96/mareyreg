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
  HandCoins,
  ClipboardList,
  FileSignature,
  CircleDollarSign,
  Receipt,
  FileText,
  BarChart3,
  KeyRound,
  CreditCard,
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
  "pacas-clientes": "Clientes de pacas",
  contracts: "Contratos",
  discounts: "Descuentos",
  envios: "Envios",
  inventory: "Inventario",
  payments: "Pagos",
  webstore: "Tienda web",
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
  "accounts-payable": HandCoins,
  "accounts-receivable": ClipboardList,
  contracts: FileSignature,
  customers: Users,
  discounts: Tags,
  envios: CircleDollarSign,
  inventory: LayoutDashboard,
  invoices: Receipt,
  "pacas-clientes": Users,
  payments: CircleDollarSign,
  pos: CreditCard,
  "purchase-orders": FileText,
  reports: BarChart3,
  suppliers: Building2,
  webstore: KeyRound,
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
    const parentPath = currentPath;
    currentPath += `/${segment}`;
    const isLast = i === segments.length - 1;

    const matchedRoute = navRoutes.find((r) => r.href === currentPath);
    const label = matchedRoute?.name || ROUTE_LABELS[segment] || segment;
    const icon = matchedRoute?.icon ?? ROUTE_ICONS[segment];

    // Segmentos como /envios o /reports agrupan rutas pero no tienen page.tsx;
    // solo se enlaza lo registrado en module-registry o detalles [id] cuyo listado existe.
    const isDetailPage =
      /^\d+$/.test(segment) && navRoutes.some((r) => r.href === parentPath);
    const isNavigable = Boolean(matchedRoute) || isDetailPage;

    items.push({
      label,
      icon,
      href: isLast || !isNavigable ? undefined : currentPath,
    });
  }

  return items;
}
