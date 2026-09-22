"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  ArrowRightLeft,
  MoreHorizontal,
  Search,
  UserRoundPlus,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AvatarInitials } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { MobileListCard } from "@/components/ui/mobile-list-card";
import { ResponsiveListView } from "@/components/ui/responsive-list-view";
import { type DataTableColumn } from "@/components/ui/data-table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { toast } from "@/lib/toast";
import { updateUser } from "../actions/auth-actions";
import { mergeEffectiveModules } from "../lib/effective-modules";
import { ROLE_LABELS, SYSTEM_ROLES, type SystemRole } from "../lib/roles";
import type { RoleMember } from "../queries/role-queries";
import type { ModuleOption } from "./role-permissions-editor";

type Props = {
  role: SystemRole;
  members: RoleMember[];
  roleModuleIds: string[];
  modules: ModuleOption[];
};

function formatLastLogin(d: Date | null): string {
  if (!d) return "Nunca";
  const diff = Date.now() - d.getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "Hace instantes";
  if (m < 60) return `Hace ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `Hace ${h} h`;
  const days = Math.floor(h / 24);
  if (days === 1) return "Ayer";
  if (days < 7) return `Hace ${days} días`;
  return d.toLocaleDateString("es-MX", { day: "numeric", month: "short" });
}

export function RoleMembersList({ role, members, roleModuleIds, modules }: Props) {
  const router = useRouter();
  const { data: session } = useSession();
  const currentUserId = session?.user?.userId;
  const [query, setQuery] = useState("");
  const [pendingMove, setPendingMove] = useState<{
    member: RoleMember;
    to: SystemRole;
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const labelOf = new Map(modules.map((m) => [m.id, m.label]));
  const q = query.trim().toLowerCase();
  const filtered = q
    ? members.filter(
        (m) =>
          m.fullName.toLowerCase().includes(q) ||
          m.email.toLowerCase().includes(q)
      )
    : members;

  const effectiveModules = (member: RoleMember): string => {
    if (role === "admin") return "Todos";
    const ids = mergeEffectiveModules(member.moduleIds, roleModuleIds);
    if (ids.length === 0) return "—";
    return ids
      .map((id) => labelOf.get(id))
      .filter(Boolean)
      .join(", ");
  };

  const handleMove = async () => {
    if (!pendingMove) return;
    setIsSubmitting(true);
    try {
      const result = await updateUser(pendingMove.member.userId, {
        role: pendingMove.to,
      });
      if (result.success) {
        setPendingMove(null);
        toast.success(
          `${pendingMove.member.fullName} ahora es ${ROLE_LABELS[pendingMove.to]}`
        );
        router.refresh();
      } else {
        toast.error(result.error);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const actionsFor = (member: RoleMember) => {
    const isSelf = member.userId === currentUserId;
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-muted-foreground"
            aria-label={`Acciones para ${member.fullName}`}
          >
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuLabel>
            {isSelf ? "No puedes cambiar tu propio rol" : "Mover a rol"}
          </DropdownMenuLabel>
          {SYSTEM_ROLES.filter((r) => r !== role).map((r) => (
            <DropdownMenuItem
              key={r}
              disabled={isSelf}
              onClick={() => setPendingMove({ member, to: r })}
            >
              <ArrowRightLeft className="size-4" /> {ROLE_LABELS[r]}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href="/settings/users">Editar en usuarios</Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };

  const columns: DataTableColumn<RoleMember>[] = [
    {
      key: "user",
      header: "Usuario",
      cell: (m) => (
        <div className="flex items-center gap-2.5">
          <AvatarInitials name={m.fullName} size={32} />
          <div className="min-w-0">
            <div className="text-[13px] font-semibold text-foreground">
              {m.fullName}
              {m.userId === currentUserId && (
                <Badge variant="outline" className="ml-2 align-middle">
                  Tú
                </Badge>
              )}
            </div>
            <div className="truncate text-[11.5px] text-muted-foreground">
              {m.email}
            </div>
          </div>
        </div>
      ),
    },
    {
      key: "modules",
      header: "Módulos efectivos",
      className: "max-w-[260px]",
      cell: (m) => (
        <span className="text-[12px] text-muted-foreground">
          {effectiveModules(m)}
        </span>
      ),
    },
    {
      key: "lastLogin",
      header: "Último acceso",
      width: "w-36",
      cell: (m) => (
        <span className="text-[12px] text-muted-foreground">
          {formatLastLogin(m.lastLoginAt)}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      width: "w-12",
      cell: (m) => actionsFor(m),
    },
  ];

  const toolbar = (
    <InputGroup className="min-w-[200px] flex-1">
      <InputGroupAddon>
        <Search />
      </InputGroupAddon>
      <InputGroupInput
        placeholder="Buscar miembro…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <InputGroupAddon align="inline-end">
        <Badge variant="secondary">{filtered.length}</Badge>
      </InputGroupAddon>
    </InputGroup>
  );

  const emptyState = (
    <EmptyState
      icon={<Users className="size-5" />}
      title={q ? "Sin resultados" : "Este rol no tiene miembros"}
      description={
        q
          ? `Ningún miembro coincide con "${query}".`
          : "Asigna el rol al crear o editar un usuario."
      }
    >
      {!q && (
        <Button variant="brand" size="sm" asChild>
          <Link href="/settings/users">
            <UserRoundPlus className="size-4" />
            Ir a usuarios
          </Link>
        </Button>
      )}
    </EmptyState>
  );

  return (
    <>
      <ResponsiveListView<RoleMember>
        columns={columns}
        rows={filtered}
        rowKey={(m) => m.userId}
        toolbar={toolbar}
        emptyState={emptyState}
        itemLabel="miembros"
        pageSize={0}
        mobileCard={(m) => (
          <MobileListCard
            leading={<AvatarInitials name={m.fullName} size={36} />}
            title={m.fullName}
            subtitle={m.email}
            meta={`Último acceso: ${formatLastLogin(m.lastLoginAt)}`}
            actions={actionsFor(m)}
            footer={
              <span className="text-[11.5px] text-muted-foreground">
                {effectiveModules(m)}
              </span>
            }
          />
        )}
      />

      <AlertDialog
        open={!!pendingMove}
        onOpenChange={(o) => !o && !isSubmitting && setPendingMove(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Cambiar de rol?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{pendingMove?.member.fullName}</strong> pasará de{" "}
              {ROLE_LABELS[role]} a{" "}
              <strong>{pendingMove ? ROLE_LABELS[pendingMove.to] : ""}</strong>.
              El cambio aplica cuando vuelva a iniciar sesión.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleMove} disabled={isSubmitting}>
              {isSubmitting ? "Cambiando…" : "Cambiar rol"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
