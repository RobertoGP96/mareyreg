"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Heart,
  LayoutGrid,
  Search,
  ShoppingCart,
  Store,
  Tag,
  X,
  type LucideIcon,
} from "lucide-react";
import { cartCount, useStore } from "@/lib/store";
import { BrandLogo } from "@/components/brand-logo";
import { NavSearchInline, NavSearchOverlay } from "@/components/nav-search";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserMenu } from "@/components/user-menu";
import { cn } from "@/lib/utils";

interface NavLink {
  href: string;
  label: string;
  icon: LucideIcon;
  isActive: (pathname: string, section: string) => boolean;
}

// Mismos glifos que la BottomNav: Inicio y Catálogo aparecen en las dos barras
// y con iconos distintos se leerían como destinos distintos.
const LINKS: NavLink[] = [
  {
    href: "/",
    label: "Inicio",
    icon: Store,
    isActive: (p, s) => p === "/" && !s,
  },
  {
    href: "/catalogo",
    label: "Catálogo",
    icon: LayoutGrid,
    isActive: (p, s) => p === "/catalogo" && s !== "ofertas",
  },
  {
    href: "/catalogo?ofertas=1",
    label: "Ofertas",
    icon: Tag,
    isActive: (p, s) => p === "/catalogo" && s === "ofertas",
  },
];

/** Acción de icono del header: círculo de 36px que se tiñe al hover. */
export const ICON_ACTION =
  "relative inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-500 transition-colors duration-150 hover:bg-hover hover:text-navy-700";

/** El contador se ancla al icono, no al flujo: en píldora sólida con un anillo
 *  del color del fondo se lee como marca sobre el icono y no desplaza la fila. */
function CountBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="tabular absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-navy-700 px-1 text-[9.5px] leading-none font-bold text-on-brand ring-2 ring-canvas">
      {count > 99 ? "99+" : count}
    </span>
  );
}

export function TopNav() {
  const pathname = usePathname();
  const { state } = useStore();
  const [searchOpen, setSearchOpen] = useState(false);
  const count = cartCount(state);
  const favCount = state.favs.length;

  // `usePathname` ignora el query string, pero "Ofertas" y "Catálogo" son la
  // misma ruta y solo se distinguen por él.
  const [section, setSection] = useState("");
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setSection(params.get("ofertas") === "1" ? "ofertas" : "");
    setSearchOpen(false);
  }, [pathname]);

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-canvas/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-[1200px] items-center gap-5 px-5 md:h-[68px] md:gap-7 md:px-6">
        <BrandLogo />

        <nav className="hidden items-center gap-6 md:flex">
          {LINKS.map((link) => {
            const active = link.isActive(pathname, section);
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "nav-label inline-flex items-center gap-1.5 border-b-2 pt-1 pb-1 transition-colors duration-150",
                  active
                    ? "border-navy-700 font-bold text-navy-700"
                    : "border-transparent font-medium text-slate-500 hover:text-navy-700"
                )}
              >
                <Icon className="h-[15px] w-[15px] flex-none" strokeWidth={1.9} />
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-1 md:gap-2">
          <NavSearchInline className="hidden md:block" />

          <button
            type="button"
            onClick={() => setSearchOpen((v) => !v)}
            aria-expanded={searchOpen}
            aria-label={searchOpen ? "Cerrar búsqueda" : "Buscar productos"}
            className={cn(
              ICON_ACTION,
              "md:hidden",
              searchOpen && "bg-tint text-navy-700"
            )}
          >
            {searchOpen ? (
              <X className="h-[18px] w-[18px]" strokeWidth={1.9} />
            ) : (
              <Search className="h-[18px] w-[18px]" strokeWidth={1.9} />
            )}
          </button>

          <ThemeToggle className={ICON_ACTION} />

          <Link
            href="/favoritos"
            aria-label={`Favoritos${favCount > 0 ? ` (${favCount})` : ""}`}
            className={cn(ICON_ACTION, "hidden md:inline-flex")}
          >
            <Heart className="h-[18px] w-[18px]" strokeWidth={1.9} />
            <CountBadge count={favCount} />
          </Link>

          <Link
            href="/carrito"
            aria-label={`Bolsa${count > 0 ? ` (${count} artículos)` : " vacía"}`}
            className={cn(ICON_ACTION, "text-navy-700 hover:bg-tint")}
          >
            <ShoppingCart className="h-[18px] w-[18px]" strokeWidth={1.9} />
            <CountBadge count={count} />
          </Link>

          <UserMenu />
        </div>
      </div>

      <NavSearchOverlay
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
      />
    </header>
  );
}
