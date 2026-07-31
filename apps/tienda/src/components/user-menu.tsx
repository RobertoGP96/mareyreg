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
  "flex items-center gap-3 px-4 py-3 text-[13px] text-slate-500 transition-colors duration-150 hover:bg-hover hover:text-navy-900";

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
        className="nav-label inline-flex items-center gap-1.5 text-slate-400 transition-colors duration-150 hover:text-navy-900 aria-expanded:text-navy-900"
      >
        <UserRound className="h-4 w-4 flex-none" strokeWidth={1.6} />
        {firstName && (
          <span className="hidden max-w-[92px] truncate lg:inline">
            {firstName}
          </span>
        )}
        <ChevronDown
          className={`hidden h-3.5 w-3.5 flex-none transition-transform duration-150 md:block ${
            open ? "rotate-180" : ""
          }`}
          strokeWidth={1.6}
        />
      </button>

      {open && (
        <PopoverPanel align="end" role="menu" className="w-[248px]">
          <div className="border-b border-line-soft px-4 py-4">
            <p className="truncate text-[14px] font-semibold text-ink">
              {profile ? profile.name : "Cliente invitado"}
            </p>
            <p className="tabular mt-1 truncate text-[12px] text-slate-400">
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
                className={`${ITEM} border-b border-line-soft`}
              >
                <Icon className="h-4 w-4 flex-none" strokeWidth={1.6} />
                {link.label}
              </Link>
            );
          })}

          {profile && (
            <button
              type="button"
              role="menuitem"
              onClick={handleSignOut}
              className={cn(ITEM, "w-full text-left hover:text-alert")}
            >
              <LogOut className="h-4 w-4 flex-none" strokeWidth={1.6} />
              Cerrar sesión
            </button>
          )}
        </PopoverPanel>
      )}
    </Popover>
  );
}
