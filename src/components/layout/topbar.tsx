"use client";

import { useSession } from "next-auth/react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { UserNav } from "./user-nav";
import { ThemeSwitcher } from "./theme-switcher";

export function Topbar() {
  const { data: session } = useSession();

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-2 !h-4" />
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
