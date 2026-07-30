"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Search, X } from "lucide-react";
import { STORE_NAME } from "@/lib/config";
import { cartCount, useStore } from "@/lib/store";
import { NavSearch } from "@/components/nav-search";
import { ThemeToggle } from "@/components/theme-toggle";

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

export function TopNav() {
  const pathname = usePathname();
  const { state } = useStore();
  const [searchOpen, setSearchOpen] = useState(false);
  const count = cartCount(state);

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
      <div className="flex h-[78px] items-center gap-8 px-5 md:px-10">
        <Link
          href="/"
          className="font-display text-2xl leading-none tracking-[.22em] text-navy-900 transition-colors hover:text-navy-700"
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

        <div className="ml-auto flex items-center gap-5 md:gap-7">
          <button
            type="button"
            onClick={() => setSearchOpen((v) => !v)}
            aria-expanded={searchOpen}
            aria-label={searchOpen ? "Cerrar búsqueda" : "Buscar productos"}
            className="nav-label inline-flex items-center gap-1.5 text-slate-400 transition-colors duration-150 hover:text-navy-900"
          >
            {searchOpen ? (
              <X className="h-4 w-4" strokeWidth={1.6} />
            ) : (
              <Search className="h-4 w-4" strokeWidth={1.6} />
            )}
            <span className="hidden md:inline">
              {searchOpen ? "Cerrar" : "Buscar"}
            </span>
          </button>

          <ThemeToggle showLabel className="hidden md:inline-flex" />
          <ThemeToggle className="md:hidden" />

          <Link
            href="/favoritos"
            className="nav-label hidden text-slate-400 transition-colors duration-150 hover:text-navy-900 md:inline"
          >
            Favoritos
          </Link>

          <Link
            href="/carrito"
            className="nav-label font-bold text-navy-900 transition-colors duration-150 hover:text-navy-700"
          >
            Bolsa ({count})
          </Link>
        </div>
      </div>

      <NavSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
    </header>
  );
}
