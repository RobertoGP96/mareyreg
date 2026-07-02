"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  UserRound,
  ShieldCheck,
  Bell,
  Building2,
  Users,
  KeyRound,
  History,
  Plug,
  CreditCard,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  adminOnly?: boolean;
};

type NavSection = {
  title: string;
  items: NavItem[];
};

const SECTIONS: NavSection[] = [
  {
    title: "Cuenta",
    items: [
      { href: "/settings/profile", label: "Perfil", icon: UserRound },
      { href: "/settings/security", label: "Seguridad", icon: ShieldCheck },
      { href: "/settings/notifications", label: "Notificaciones", icon: Bell },
    ],
  },
  {
    title: "Empresa",
    items: [
      { href: "/settings/general", label: "General", icon: Building2 },
      {
        href: "/settings/users",
        label: "Usuarios y permisos",
        icon: Users,
        adminOnly: true,
      },
      { href: "/settings/roles", label: "Roles", icon: KeyRound, adminOnly: true },
      { href: "/settings/audit", label: "Auditoría", icon: History, adminOnly: true },
      {
        href: "/settings/integrations",
        label: "Integraciones",
        icon: Plug,
        adminOnly: true,
      },
      { href: "/settings/billing", label: "Facturación", icon: CreditCard, adminOnly: true },
    ],
  },
];

export function SettingsNav() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "admin";

  return (
    <nav aria-label="Configuración" className="flex flex-col gap-5">
      {SECTIONS.map((section) => {
        const visibleItems = section.items.filter(
          (item) => !item.adminOnly || isAdmin
        );
        if (visibleItems.length === 0) return null;
        return (
          <div key={section.title}>
            <div className="px-3 pb-2 text-[10.5px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
              {section.title}
            </div>
            <ul className="flex flex-col gap-px">
              {visibleItems.map((item) => {
                const isActive =
                  pathname === item.href ||
                  pathname.startsWith(`${item.href}/`);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={isActive ? "page" : undefined}
                      className={cn(
                        "flex items-center gap-2.5 rounded-md px-3 py-2 text-[13px] transition-colors cursor-pointer",
                        isActive
                          ? "bg-[var(--accent)] font-semibold text-[var(--accent-foreground)]"
                          : "font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                    >
                      <item.icon
                        className={cn(
                          "size-[15px] shrink-0",
                          isActive ? "text-[var(--accent-foreground)]" : ""
                        )}
                      />
                      <span>{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}
