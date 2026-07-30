"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Heart,
  Store,
  LayoutGrid,
  ShoppingCart,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { cartCount, useStore } from "@/lib/store";

const VISIBLE_PATHS = [
  "/",
  "/catalogo",
  "/favoritos",
  "/carrito",
  "/perfil",
  "/perfil/pedidos",
];

interface NavItem {
  href: string;
  icon: LucideIcon;
  label: string;
  isActive: (pathname: string) => boolean;
}

const ITEMS: NavItem[] = [
  { href: "/", icon: Store, label: "Inicio", isActive: (p) => p === "/" },
  {
    href: "/catalogo",
    icon: LayoutGrid,
    label: "Catálogo",
    isActive: (p) => p === "/catalogo",
  },
  {
    href: "/favoritos",
    icon: Heart,
    label: "Favoritos",
    isActive: (p) => p === "/favoritos",
  },
  {
    href: "/carrito",
    icon: ShoppingCart,
    label: "Bolsa",
    isActive: (p) => p === "/carrito",
  },
  {
    href: "/perfil",
    icon: UserRound,
    label: "Perfil",
    isActive: (p) => p === "/perfil" || p === "/perfil/pedidos",
  },
];

export function BottomNav() {
  const pathname = usePathname();
  const { state } = useStore();

  if (!VISIBLE_PATHS.includes(pathname)) return null;

  const count = cartCount(state);

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-line bg-canvas md:hidden">
      {ITEMS.map((item) => {
        const active = item.isActive(pathname);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`relative flex flex-col items-center gap-1.5 py-3 pb-[18px] text-[8.5px] tracking-[.16em] uppercase transition-colors duration-150 ${
              active ? "text-navy-900" : "text-slate-400"
            }`}
          >
            <Icon className="h-4 w-4" strokeWidth={1.6} />
            {item.label}
            {item.href === "/carrito" && count > 0 && (
              <span className="tabular absolute top-2 right-[22%] text-[9px] font-bold text-navy-900">
                {count}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
