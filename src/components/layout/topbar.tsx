"use client";

import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { UserNav } from "./user-nav";
import { ThemeSwitcher } from "./theme-switcher";
import { getBreadcrumbs } from "@/lib/breadcrumb-utils";
import { Fragment } from "react";

export function Topbar() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const breadcrumbs = getBreadcrumbs(pathname);

  return (
    <header className="glass-panel flex h-14 shrink-0 items-center gap-2 border-b border-border/60 px-4 md:px-6 sticky top-0 z-40">
      <SidebarTrigger className="-ml-1 size-8 rounded-md hover:bg-accent/60" />
      <Separator orientation="vertical" className="mx-1 !h-5 bg-border/80" />
      <Breadcrumb>
        <BreadcrumbList className="gap-1.5 text-[0.82rem] flex-nowrap">
          {breadcrumbs.map((crumb, index) => {
            const Icon = crumb.icon;
            const isLast = index === breadcrumbs.length - 1;
            return (
              <Fragment key={index}>
                {index > 0 && (
                  <BreadcrumbSeparator className="[&>svg]:size-3.5 text-muted-foreground/50" />
                )}
                <BreadcrumbItem>
                  {crumb.href ? (
                    <BreadcrumbLink
                      href={crumb.href}
                      title={crumb.label}
                      aria-label={crumb.label}
                      className="text-muted-foreground hover:text-foreground transition-colors font-medium flex items-center gap-1.5"
                    >
                      {Icon && <Icon className="size-4 shrink-0" aria-hidden="true" />}
                      <span className={isLast ? "inline" : "hidden sm:inline"}>
                        {crumb.label}
                      </span>
                    </BreadcrumbLink>
                  ) : (
                    <BreadcrumbPage
                      title={crumb.label}
                      aria-label={crumb.label}
                      className="text-foreground font-semibold flex items-center gap-1.5"
                    >
                      {Icon && <Icon className="size-4 shrink-0" aria-hidden="true" />}
                      <span className="inline">{crumb.label}</span>
                    </BreadcrumbPage>
                  )}
                </BreadcrumbItem>
              </Fragment>
            );
          })}
        </BreadcrumbList>
      </Breadcrumb>
      <div className="flex-1" />
      <div className="flex items-center gap-1">
        <ThemeSwitcher />
        <Separator orientation="vertical" className="mx-1 !h-5 bg-border/80" />
        <UserNav
          user={
            session?.user
              ? {
                  fullName: session.user.fullName ?? session.user.name ?? "Usuario",
                  email: session.user.email ?? "",
                  role: session.user.role ?? "viewer",
                }
              : null
          }
        />
      </div>
    </header>
  );
}
