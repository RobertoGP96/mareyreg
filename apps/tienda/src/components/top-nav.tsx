"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Heart, ShoppingCart, Store, UserRound } from "lucide-react";
import { STORE_NAME } from "@/lib/config";
import { cartCount, useStore } from "@/lib/store";
import { NavSearch } from "@/components/nav-search";

const LINKS = [
  { href: "/", label: "Inicio", isActive: (p: string) => p === "/" },
  {
    href: "/catalogo",
    label: "Catálogo",
    isActive: (p: string) => p === "/catalogo",
  },
  {
    href: "/catalogo?ofertas=1",
    label: "Ofertas",
    isActive: () => false,
  },
];

export function TopNav() {
  const pathname = usePathname();
  const { state } = useStore();
  const count = cartCount(state);

  return (
    <header className="grad-header sticky top-0 z-40 hidden text-white shadow-[0_4px_18px_rgba(10,31,63,.25)] md:block">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-6 px-6">
        <Link
          href="/"
          className="flex items-center gap-2.5 text-[17px] font-bold tracking-[-0.3px] transition-opacity hover:opacity-85"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/15 bg-white/10">
            <Store className="h-[18px] w-[18px]" />
          </span>
          {STORE_NAME}
        </Link>

        <nav className="flex items-center gap-1">
          {LINKS.map((link) => {
            const active = link.isActive(pathname);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-lg px-3.5 py-2 text-[13.5px] font-medium transition-colors ${
                  active
                    ? "bg-white/15 text-white"
                    : "text-white/70 hover:bg-white/10 hover:text-white"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <NavSearch />

        <div className="flex items-center gap-2">
          <Link
            href="/favoritos"
            aria-label="Favoritos"
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/15 bg-white/10 transition-colors hover:bg-white/20"
          >
            <Heart className="h-[18px] w-[18px]" />
          </Link>
          <Link
            href="/carrito"
            aria-label="Carrito"
            className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-white/15 bg-white/10 transition-colors hover:bg-white/20"
          >
            <ShoppingCart className="h-[18px] w-[18px]" />
            {count > 0 && (
              <span className="absolute -top-[5px] -right-[5px] flex h-[19px] min-w-[19px] items-center justify-center rounded-[10px] bg-brand-light px-[5px] text-[11px] font-bold text-white">
                {count}
              </span>
            )}
          </Link>
          <Link
            href="/perfil"
            aria-label="Perfil"
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/15 bg-white/10 transition-colors hover:bg-white/20"
          >
            <UserRound className="h-[18px] w-[18px]" />
          </Link>
        </div>
      </div>
    </header>
  );
}
