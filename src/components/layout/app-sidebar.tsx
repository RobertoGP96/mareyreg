"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { LayoutDashboard, Settings2 } from "lucide-react";
import { getEnabledModules } from "@/lib/module-registry";
import { LogoGR } from "@/components/brand/logo-gr";

export function AppSidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const allModules = getEnabledModules();

  const modules = allModules.filter((module) => {
    if (session?.user?.role === "admin") return true;
    return session?.user?.modules?.includes(module.id) ?? false;
  });

  const allHrefs = modules.flatMap((m) => m.routes.map((r) => r.href));

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    if (pathname === href) return true;
    if (allHrefs.includes(pathname)) return false;
    return pathname.startsWith(href + "/");
  };

  return (
    <Sidebar collapsible="icon" variant="sidebar" className="border-r-0">
      <SidebarHeader className="border-b border-sidebar-border/60 pb-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild className="hover:bg-sidebar-accent/50 data-[state=open]:bg-sidebar-accent/60">
              <Link href="/">
                <div className="relative flex aspect-square size-9 items-center justify-center overflow-hidden rounded-lg bg-gradient-brand shadow-[0_4px_12px_-2px_rgba(37,99,235,0.5)]">
                  <LogoGR size={22} mono dark className="relative z-10" />
                  <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-white/20" />
                </div>
                <div className="grid flex-1 text-left leading-tight">
                  <span className="truncate font-headline font-bold text-[1rem] tracking-tight text-sidebar-foreground">
                    GrayRegistration
                  </span>
                  <span className="truncate text-[0.62rem] uppercase tracking-[0.18em] text-sidebar-foreground/50">
                    Sistema de Gestión
                  </span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent className="gap-1 pt-2">
        {/* Home */}
        <SidebarGroup className="pb-1">
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={isActive("/")}
                  tooltip="Inicio"
                  className="relative data-[active=true]:bg-gradient-to-r data-[active=true]:from-sidebar-accent data-[active=true]:to-sidebar-accent/40 data-[active=true]:text-white data-[active=true]:shadow-sm"
                >
                  <Link href="/">
                    {isActive("/") && (
                      <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-r-full bg-[var(--brand)]" />
                    )}
                    <LayoutDashboard />
                    <span>Inicio</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Dynamic Modules */}
        {modules.map((module) => (
          <SidebarGroup key={module.id} className="py-1">
            <SidebarGroupLabel className="text-[0.68rem] font-semibold text-sidebar-foreground/40 uppercase tracking-[0.14em] px-2">
              {module.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {module.routes.map((route) => {
                  const active = isActive(route.href);
                  return (
                    <SidebarMenuItem key={route.href}>
                      <SidebarMenuButton
                        asChild
                        isActive={active}
                        tooltip={route.name}
                        className="relative data-[active=true]:bg-gradient-to-r data-[active=true]:from-sidebar-accent data-[active=true]:to-sidebar-accent/40 data-[active=true]:text-white data-[active=true]:shadow-sm"
                      >
                        <Link href={route.href}>
                          {active && (
                            <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-r-full bg-[var(--brand)]" />
                          )}
                          <route.icon />
                          <span>{route.name}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border/60 pt-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={isActive("/settings")}
              tooltip="Configuración"
              className="relative data-[active=true]:bg-sidebar-accent data-[active=true]:text-white"
            >
              <Link href="/settings">
                {isActive("/settings") && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-r-full bg-[var(--brand)]" />
                )}
                <Settings2 />
                <span>Configuración</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
