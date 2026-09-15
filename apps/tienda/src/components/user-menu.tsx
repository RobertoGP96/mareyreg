"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ChevronDown,
  Heart,
  IdCard,
  LogOut,
  Package,
  UserRound,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { Popover, PopoverPanel } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const ITEM =
  "flex items-center gap-3 rounded-sm px-3 py-2.5 text-[13px] font-medium text-slate-500 transition-colors duration-150 hover:bg-hover hover:text-navy-700";

interface MenuLink {
  href: string;
  label: string;
  icon: typeof UserRound;
}

const SESSION_LINKS: MenuLink[] = [
  { href: "/perfil", label: "Mi perfil", icon: UserRound },
  { href: "/perfil/pedidos", label: "Mis pedidos", icon: Package },
  { href: "/perfil/datos", label: "Mis datos", icon: IdCard },
  { href: "/favoritos", label: "Favoritos", icon: Heart },
];

const GUEST_LINKS: MenuLink[] = [
  { href: "/login", label: "Iniciar sesión", icon: UserRound },
  { href: "/registro", label: "Crear cuenta", icon: IdCard },
  { href: "/favoritos", label: "Favoritos", icon: Heart },
];

export function UserMenu() {
  const pathname = usePathname();
  const { state, clearProfile, showToast } = useStore();
  const [open, setOpen] = useState(false);

  useEffect(() => setOpen(false), [pathname]);

  // El perfil vive en localStorage: hasta hidratar, el servidor y el cliente
  // deben coincidir en el estado de invitado o React descarta el árbol.
  const profile = state.hydrated ? state.profile : null;
  const links = profile ? SESSION_LINKS : GUEST_LINKS;
  const firstName = profile?.name.trim().split(/\s+/)[0] ?? "";

  const handleSignOut = () => {
    setOpen(false);
    clearProfile();
    showToast("Sesión cerrada");
  };

  return (
    <Popover open={open} onClose={() => setOpen(false)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={profile ? `Cuenta de ${profile.name}` : "Tu cuenta"}
        className={cn(
          "nav-label inline-flex h-9 min-w-9 items-center justify-center gap-1.5 rounded-full px-2 text-slate-500 transition-colors duration-150 hover:bg-hover hover:text-navy-700 aria-expanded:bg-tint aria-expanded:text-navy-700",
          firstName && "lg:px-3"
        )}
      >
        <UserRound className="h-[18px] w-[18px] flex-none" strokeWidth={1.9} />
        {firstName && (
          <span className="hidden max-w-[92px] truncate lg:inline">
            {firstName}
          </span>
        )}
        <ChevronDown
          className={cn(
            "hidden h-3.5 w-3.5 flex-none transition-transform duration-200 md:block",
            open && "rotate-180"
          )}
          strokeWidth={2}
        />
      </button>

      {open && (
        <PopoverPanel align="end" role="menu" className="w-[256px] p-2">
          <div className="mb-1 rounded-md bg-page px-3.5 py-3">
            <p className="truncate text-[14px] font-semibold text-ink">
              {profile ? profile.name : "Cliente invitado"}
            </p>
            <p className="tabular mt-0.5 truncate text-[12px] text-slate-400">
              {profile ? profile.phone : "Inicia sesión o crea tu cuenta"}
            </p>
          </div>

          {links.map((link) => {
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                role="menuitem"
                onClick={() => setOpen(false)}
                className={ITEM}
              >
                <Icon className="h-4 w-4 flex-none" strokeWidth={1.9} />
                {link.label}
              </Link>
            );
          })}

          {profile && (
            <div className="mt-1 border-t border-line-soft pt-1">
              <button
                type="button"
                role="menuitem"
                onClick={handleSignOut}
                className={cn(ITEM, "w-full text-left hover:text-danger")}
              >
                <LogOut className="h-4 w-4 flex-none" strokeWidth={1.9} />
                Cerrar sesión
              </button>
            </div>
          )}
        </PopoverPanel>
      )}
    </Popover>
  );
}
