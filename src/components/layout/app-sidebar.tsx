"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { Collapsible } from "radix-ui";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import Image from "next/image";
import { ChevronRight, LayoutDashboard, Settings2 } from "lucide-react";
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

  const findActiveModuleId = () =>
    modules.find((m) => m.routes.some((r) => isActive(r.href)))?.id ?? null;

  const [openModuleId, setOpenModuleId] = useState<string | null>(findActiveModuleId);

  useEffect(() => {
    const activeId = findActiveModuleId();
    if (activeId) setOpenModuleId(activeId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  return (
    <Sidebar collapsible="icon" variant="sidebar" className="border-r-0">
      <SidebarHeader className="border-b border-sidebar-border/60 pb-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild className="hover:bg-sidebar-accent/50 data-[state=open]:bg-sidebar-accent/60">
              <Link href="/">
                <div className="relative flex aspect-square size-9 items-center justify-center overflow-hidden rounded-lg bg-gradient-brand shadow-[0_4px_12px_-2px_rgba(37,99,235,0.5)]">
                  <Image
                    src="/brand/gr-technology-logo.png"
                    alt="GR Technology"
                    width={36}
                    height={36}
                    className="relative z-10 size-9 rounded-lg object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-white/20" />
                </div>
                <div className="grid flex-1 text-left leading-tight">
                  <span className="truncate font-headline font-bold text-[1rem] tracking-tight text-sidebar-foreground">
                    GR Technology
                  </span>
                  <span className="truncate text-[0.62rem] uppercase tracking-[0.18em] text-sidebar-foreground/50">
                    Soluciones que avanzan contigo
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
        <SidebarGroup className="py-1">
          <SidebarGroupContent>
            <SidebarMenu>
              {modules.map((module) => {
                const isOpen = openModuleId === module.id;
                const hasActiveChild = module.routes.some((r) => isActive(r.href));
                return (
                  <Collapsible.Root
                    key={module.id}
                    asChild
                    open={isOpen}
                    onOpenChange={(v) => setOpenModuleId(v ? module.id : null)}
                  >
                    <SidebarMenuItem>
                      <Collapsible.Trigger asChild>
                        <SidebarMenuButton
                          tooltip={module.label}
                          isActive={hasActiveChild && !isOpen}
                          className="relative data-[active=true]:bg-gradient-to-r data-[active=true]:from-sidebar-accent data-[active=true]:to-sidebar-accent/40 data-[active=true]:text-white data-[active=true]:shadow-sm"
                        >
                          <module.icon />
                          <span>{module.label}</span>
                          <ChevronRight
                            className="ml-auto size-4 text-sidebar-foreground/50 transition-transform duration-200 data-[state=open]:rotate-90"
                            data-state={isOpen ? "open" : "closed"}
                          />
                        </SidebarMenuButton>
                      </Collapsible.Trigger>
                      <Collapsible.Content className="overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down">
                        <SidebarMenuSub>
                          {module.routes.map((route) => {
                            const active = isActive(route.href);
                            return (
                              <SidebarMenuSubItem key={route.href}>
                                <SidebarMenuSubButton
                                  asChild
                                  isActive={active}
                                  className="relative data-[active=true]:bg-gradient-to-r data-[active=true]:from-sidebar-accent data-[active=true]:to-sidebar-accent/40 data-[active=true]:text-white data-[active=true]:shadow-sm"
                                >
                                  <Link href={route.href}>
                                    {active && (
                                      <span className="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-[2px] rounded-r-full bg-[var(--brand)]" />
                                    )}
                                    <route.icon />
                                    <span>{route.name}</span>
                                  </Link>
                                </SidebarMenuSubButton>
                              </SidebarMenuSubItem>
                            );
                          })}
                        </SidebarMenuSub>
                      </Collapsible.Content>
                    </SidebarMenuItem>
                  </Collapsible.Root>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
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
