"use client";

import type { ReactNode } from "react";
import { KeyRound, Users } from "lucide-react";
import { SectionTabs } from "@/components/ui/section-tabs";

export type RoleDetailTab = "permisos" | "miembros";

type Props = {
  defaultTab: RoleDetailTab;
  moduleCount: number;
  memberCount: number;
  permissions: ReactNode;
  members: ReactNode;
};

// Wrapper cliente: SectionTabs recibe componentes de icono, que no pueden
// viajar como props desde un server component.
export function RoleDetailTabs({
  defaultTab,
  moduleCount,
  memberCount,
  permissions,
  members,
}: Props) {
  return (
    <SectionTabs
      sticky={false}
      defaultTab={defaultTab}
      tabs={[
        {
          id: "permisos",
          label: "Permisos",
          icon: KeyRound,
          badge: moduleCount,
          content: permissions,
        },
        {
          id: "miembros",
          label: "Miembros",
          icon: Users,
          badge: memberCount,
          content: members,
        },
      ]}
    />
  );
}
