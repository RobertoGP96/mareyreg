"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Heart, Search, ShoppingCart, X } from "lucide-react";
import { STORE_NAME } from "@/lib/config";
import { cartCount, useStore } from "@/lib/store";
import { NavSearchInline, NavSearchOverlay } from "@/components/nav-search";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserMenu } from "@/components/user-menu";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/", label: "Inicio", isActive: (p: string, s: string) => p === "/" && !s },
  {
    href: "/catalogo",
    label: "Catálogo",
    isActive: (p: string, s: string) => p === "/catalogo" && s !== "ofertas",
  },
  {
    href: "/catalogo?ofertas=1",
    label: "Ofertas",
    isActive: (p: string, s: string) => p === "/catalogo" && s === "ofertas",
  },
];

const ICON_ACTION =
  "relative inline-flex h-9 w-9 items-center justify-center text-slate-400 transition-colors duration-150 hover:text-navy-900";

/** El contador se ancla al icono, no al flujo: a 9px y en caja sólida se lee
 *  como marca sobre el icono y no desplaza el resto de la fila al cambiar. */
function CountBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="tabular absolute top-0.5 right-0 flex h-[15px] min-w-[15px] items-center justify-center bg-navy-900 px-[3px] text-[9px] leading-none font-bold text-canvas">
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
    <header className="sticky top-0 z-40 border-b border-line bg-canvas">
      <div className="flex h-[78px] items-center gap-6 px-5 md:gap-8 md:px-10">
        <Link
          href="/"
          className="font-display flex-none text-2xl leading-none tracking-[.16em] text-navy-900 transition-colors hover:text-navy-700"
        >
          {STORE_NAME}
        </Link>

        <nav className="hidden items-center gap-7 md:flex">
          {LINKS.map((link) => {
            const active = link.isActive(pathname, section);
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={`nav-label pb-1 transition-colors duration-150 ${
                  active
                    ? "border-b border-navy-900 text-navy-900"
                    : "border-b border-transparent text-slate-400 hover:text-navy-700"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2 md:gap-4">
          <NavSearchInline className="hidden md:block" />

          <button
            type="button"
            onClick={() => setSearchOpen((v) => !v)}
            aria-expanded={searchOpen}
            aria-label={searchOpen ? "Cerrar búsqueda" : "Buscar productos"}
            className={cn(ICON_ACTION, "md:hidden")}
          >
            {searchOpen ? (
              <X className="h-4 w-4" strokeWidth={1.6} />
            ) : (
              <Search className="h-4 w-4" strokeWidth={1.6} />
            )}
          </button>

          <ThemeToggle className={ICON_ACTION} />

          <Link
            href="/favoritos"
            aria-label={`Favoritos${favCount > 0 ? ` (${favCount})` : ""}`}
            className={cn(ICON_ACTION, "hidden md:inline-flex")}
          >
            <Heart className="h-4 w-4" strokeWidth={1.6} />
            <CountBadge count={favCount} />
          </Link>

          <Link
            href="/carrito"
            aria-label={`Bolsa${count > 0 ? ` (${count} artículos)` : " vacía"}`}
            className={cn(ICON_ACTION, "text-navy-900 hover:text-navy-700")}
          >
            <ShoppingCart className="h-[18px] w-[18px]" strokeWidth={1.6} />
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
