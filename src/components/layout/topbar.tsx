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
    <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-2 !h-4" />
      <Breadcrumb>
        <BreadcrumbList>
          {breadcrumbs.map((crumb, index) => (
            <Fragment key={index}>
              {index > 0 && <BreadcrumbSeparator />}
              <BreadcrumbItem>
                {crumb.href ? (
                  <BreadcrumbLink href={crumb.href}>
                    {crumb.label}
                  </BreadcrumbLink>
                ) : (
                  <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                )}
              </BreadcrumbItem>
            </Fragment>
          ))}
        </BreadcrumbList>
      </Breadcrumb>
      <div className="flex-1" />
      <ThemeSwitcher />
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
    </header>
  );
}
