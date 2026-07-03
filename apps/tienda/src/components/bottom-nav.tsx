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
    label: "Carrito",
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
    <nav className="sticky bottom-0 mt-auto flex justify-around rounded-t-[20px] border-t border-[#E2E8F1] bg-white px-2 pt-[11px] pb-[17px] shadow-[0_-4px_16px_rgba(10,31,63,.06)] md:hidden">
      {ITEMS.map((item) => {
        const active = item.isActive(pathname);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`relative flex flex-col items-center gap-[3px] text-[10.5px] font-semibold transition-colors ${active ? "text-brand" : "text-muted-2"}`}
          >
            <Icon
              className={`h-[19px] w-[19px] transition-transform ${active ? "scale-110" : ""}`}
              strokeWidth={active ? 2.4 : 2}
            />
            {item.label}
            {item.href === "/carrito" && count > 0 && (
              <span className="absolute -top-1 -right-0.5 flex h-[17px] min-w-[17px] items-center justify-center rounded-[9px] bg-brand-mid px-1 text-[10px] font-bold text-white">
                {count}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
