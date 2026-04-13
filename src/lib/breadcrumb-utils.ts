import { getAllNavigationRoutes } from "./module-registry";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

const ROUTE_LABELS: Record<string, string> = {
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
};

export function getBreadcrumbs(pathname: string): BreadcrumbItem[] {
  if (pathname === "/") return [{ label: "Inicio" }];

  const segments = pathname.split("/").filter(Boolean);
  const items: BreadcrumbItem[] = [{ label: "Inicio", href: "/" }];

  let currentPath = "";
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    currentPath += `/${segment}`;
    const isLast = i === segments.length - 1;

    // Try to find label from navigation routes
    const navRoutes = getAllNavigationRoutes();
    const matchedRoute = navRoutes.find((r) => r.href === currentPath);
    const label = matchedRoute?.name || ROUTE_LABELS[segment] || segment;

    items.push({
      label,
      href: isLast ? undefined : currentPath,
    });
  }

  return items;
}
