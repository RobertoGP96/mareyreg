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
import { Home, Settings } from "lucide-react";
import { getEnabledModules } from "@/lib/module-registry";

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
    <Sidebar collapsible="icon" variant="sidebar">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <img
                    src="/truck-white.svg"
                    alt="MAREYreg"
                    className="size-5"
                  />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold roadway-font text-lg">
                    MAREYreg
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    Sistema de Gestion
                  </span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {/* Home */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={isActive("/")}
                  tooltip="Inicio"
                >
                  <Link href="/">
                    <Home />
                    <span>Inicio</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Dynamic Modules */}
        {modules.map((module) => (
          <SidebarGroup key={module.id}>
            <SidebarGroupLabel className="uppercase tracking-widest text-[10px] font-bold">{module.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {module.routes.map((route) => (
                  <SidebarMenuItem key={route.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive(route.href)}
                      tooltip={route.name}
                    >
                      <Link href={route.href}>
                        <route.icon />
                        <span>{route.name}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={isActive("/settings")}
              tooltip="Configuracion"
            >
              <Link href="/settings">
                <Settings />
                <span>Configuracion</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
