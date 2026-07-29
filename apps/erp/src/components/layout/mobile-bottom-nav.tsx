"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { useMemo, useState } from "react";
import { LayoutDashboard, MoreHorizontal, Settings2, type LucideIcon } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import {
  fixedRoutes,
  getEnabledModules,
  settingsRoute,
  type AppModule,
  type ModuleRoute,
} from "@/lib/module-registry";

const MAX_VISIBLE = 5;

type NavItem = {
  key: string;
  name: string;
  href: string;
  icon: LucideIcon;
};

function routeToItem(route: ModuleRoute): NavItem {
  return { key: route.href, name: route.name, href: route.href, icon: route.icon };
}

function moduleToItem(module: AppModule): NavItem {
  const first = module.routes[0];
  return {
    key: module.id,
    name: module.label,
    href: first?.href ?? "/",
    icon: module.icon,
  };
}

export function MobileBottomNav() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [overflowOpen, setOverflowOpen] = useState(false);

  const allowedModules = useMemo(() => {
    return getEnabledModules().filter((m) => {
      if (session?.user?.role === "admin") return true;
      return session?.user?.modules?.includes(m.id) ?? false;
    });
  }, [session]);

  const allHrefs = useMemo(
    () => allowedModules.flatMap((m) => m.routes.map((r) => r.href)),
    [allowedModules]
  );

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    if (pathname === href) return true;
    if (allHrefs.includes(pathname)) return false;
    return pathname.startsWith(href + "/");
  };

  const activeModule = useMemo(
    () => allowedModules.find((m) => m.routes.some((r) => isActive(r.href))) ?? null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [allowedModules, pathname]
  );

  const { primary, overflow, sheetTitle } = useMemo(() => {
    if (activeModule) {
      const items = activeModule.routes.map(routeToItem);
      if (items.length <= MAX_VISIBLE) {
        return { primary: items, overflow: [] as NavItem[], sheetTitle: activeModule.label };
      }
      return {
        primary: items.slice(0, MAX_VISIBLE - 1),
        overflow: items.slice(MAX_VISIBLE - 1),
        sheetTitle: activeModule.label,
      };
    }

    const home: NavItem = {
      key: "home",
      name: fixedRoutes[0]?.name ?? "Inicio",
      href: fixedRoutes[0]?.href ?? "/",
      icon: fixedRoutes[0]?.icon ?? LayoutDashboard,
    };
    const settings: NavItem = {
      key: "settings",
      name: settingsRoute.name,
      href: settingsRoute.href,
      icon: settingsRoute.icon,
    };
    const moduleItems = allowedModules.map(moduleToItem);
    const all = [home, ...moduleItems, settings];
    if (all.length <= MAX_VISIBLE) {
      return { primary: all, overflow: [] as NavItem[], sheetTitle: "Navegación" };
    }
    return {
      primary: all.slice(0, MAX_VISIBLE - 1),
      overflow: all.slice(MAX_VISIBLE - 1),
      sheetTitle: "Más opciones",
    };
  }, [activeModule, allowedModules]);

  const overflowActive = overflow.some((item) => isActive(item.href));

  return (
    <>
      <nav
        aria-label="Navegación principal"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border/60 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:hidden pb-[env(safe-area-inset-bottom)]"
      >
        <ul className="grid grid-cols-5">
          {primary.map((item) => {
            const active = isActive(item.href);
            const Icon = item.icon;
            return (
              <li key={item.key} className="contents">
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative flex h-[var(--mobile-nav-h)] flex-col items-center justify-center gap-0.5 px-1 text-[0.65rem] font-medium transition-colors",
                    active
                      ? "text-[var(--brand)]"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {active && (
                    <span className="absolute top-0 h-[2px] w-8 rounded-b-full bg-[var(--brand)]" />
                  )}
                  <Icon className={cn("size-5", active && "stroke-[2.4]")} aria-hidden="true" />
                  <span className="max-w-full truncate leading-tight">{item.name}</span>
                </Link>
              </li>
            );
          })}

          {overflow.length > 0 && (
            <li className="contents">
              <button
                type="button"
                onClick={() => setOverflowOpen(true)}
                aria-label="Más opciones"
                aria-expanded={overflowOpen}
                className={cn(
                  "relative flex h-[var(--mobile-nav-h)] flex-col items-center justify-center gap-0.5 px-1 text-[0.65rem] font-medium transition-colors",
                  overflowActive
                    ? "text-[var(--brand)]"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {overflowActive && (
                  <span className="absolute top-0 h-[2px] w-8 rounded-b-full bg-[var(--brand)]" />
                )}
                <MoreHorizontal className="size-5" aria-hidden="true" />
                <span className="leading-tight">Más</span>
              </button>
            </li>
          )}
        </ul>
      </nav>

      <Sheet open={overflowOpen} onOpenChange={setOverflowOpen}>
        <SheetContent
          side="bottom"
          className="rounded-t-2xl pb-[max(1rem,env(safe-area-inset-bottom))]"
        >
          <SheetHeader className="pb-2">
            <SheetTitle>{sheetTitle}</SheetTitle>
            <SheetDescription>
              {activeModule
                ? "Más opciones del módulo actual"
                : "Selecciona un módulo o sección"}
            </SheetDescription>
          </SheetHeader>
          <ul className="grid grid-cols-4 gap-2 px-4 pb-2">
            {overflow.map((item) => {
              const active = isActive(item.href);
              const Icon = item.icon;
              return (
                <li key={item.key}>
                  <Link
                    href={item.href}
                    onClick={() => setOverflowOpen(false)}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex h-20 flex-col items-center justify-center gap-1 rounded-xl border border-border/60 bg-card p-2 text-center text-[0.7rem] font-medium transition-colors",
                      active
                        ? "border-[var(--brand)]/40 bg-[var(--brand)]/10 text-[var(--brand)]"
                        : "text-foreground hover:bg-accent/40"
                    )}
                  >
                    <Icon className="size-5" aria-hidden="true" />
                    <span className="line-clamp-2 leading-tight">{item.name}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </SheetContent>
      </Sheet>
    </>
  );
}
