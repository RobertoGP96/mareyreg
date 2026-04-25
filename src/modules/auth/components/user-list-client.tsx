"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AvatarInitials } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
  Dialog,
  DialogContent,
  DialogHeader,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Field, FormDialogHeader } from "@/components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import {
  MoreHorizontal,
  SquarePen,
  Trash2,
  UserRoundPlus,
  Search,
  ShieldCheck,
  UserRound,
  AtSign,
  KeyRound,
  Loader2,
  Filter,
} from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { toast } from "sonner";
import { createUser, updateUser, deleteUser } from "../actions/auth-actions";
import { getEnabledModules } from "@/lib/module-registry";

const ROLE_LABELS: Record<string, string> = {
  admin: "Administrador",
  dispatcher: "Despachador",
  viewer: "Observador",
};

const ROLE_VARIANT: Record<
  string,
  "brand" | "info" | "secondary"
> = {
  admin: "brand",
  dispatcher: "info",
  viewer: "secondary",
};

const enabledModules = getEnabledModules();

function timeAgo(d: Date): string {
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

interface UserItem {
  userId: number;
  email: string;
  fullName: string;
  role: string;
  createdAt: Date;
  modulePermissions: { moduleId: string }[];
}

interface Props {
  users: UserItem[];
}

export function UserListClient({ users }: Props) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<UserItem | null>(null);
  const [userToEdit, setUserToEdit] = useState<UserItem | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createModules, setCreateModules] = useState<string[]>(
    enabledModules.map((m) => m.id)
  );
  const [editModules, setEditModules] = useState<string[]>([]);

  const filtered = users.filter(
    (u) =>
      u.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const toggleCreateModule = (moduleId: string) => {
    setCreateModules((prev) =>
      prev.includes(moduleId)
        ? prev.filter((m) => m !== moduleId)
        : [...prev, moduleId]
    );
  };

  const toggleEditModule = (moduleId: string) => {
    setEditModules((prev) =>
      prev.includes(moduleId)
        ? prev.filter((m) => m !== moduleId)
        : [...prev, moduleId]
    );
  };

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    const fd = new FormData(e.currentTarget);
    const result = await createUser({
      fullName: fd.get("fullName") as string,
      email: fd.get("email") as string,
      password: fd.get("password") as string,
      role: fd.get("role") as "admin" | "dispatcher" | "viewer",
      modules: createModules,
    });
    setIsSubmitting(false);
    if (result.success) {
      setIsCreateOpen(false);
      setCreateModules(enabledModules.map((m) => m.id));
      toast.success("Usuario creado");
      router.refresh();
    } else toast.error(result.error);
  };

  const handleUpdate = async (e: React.FormEvent<HTMLFormElement>) => {
    if (!userToEdit) return;
    e.preventDefault();
    setIsSubmitting(true);
    const fd = new FormData(e.currentTarget);
    const password = fd.get("password") as string;
    const result = await updateUser(userToEdit.userId, {
      fullName: fd.get("fullName") as string,
      email: fd.get("email") as string,
      role: fd.get("role") as "admin" | "dispatcher" | "viewer",
      ...(password ? { password } : {}),
      modules: editModules,
    });
    setIsSubmitting(false);
    if (result.success) {
      setUserToEdit(null);
      toast.success("Usuario actualizado");
      router.refresh();
    } else toast.error(result.error);
  };

  const handleDelete = async () => {
    if (!userToDelete) return;
    setIsSubmitting(true);
    const result = await deleteUser(userToDelete.userId);
    setIsSubmitting(false);
    if (result.success) {
      setUserToDelete(null);
      toast.success("Usuario eliminado");
      router.refresh();
    } else toast.error(result.error);
  };

  const openEdit = (user: UserItem) => {
    setUserToEdit(user);
    setEditModules(user.modulePermissions.map((p) => p.moduleId));
  };

  const renderModulesCell = (user: UserItem) => {
    if (user.role === "admin") {
      return (
        <span className="text-[12px] font-medium text-foreground">Todos</span>
      );
    }
    if (user.modulePermissions.length === 0) {
      return <span className="text-[12px] text-muted-foreground">—</span>;
    }
    const labels = user.modulePermissions
      .map((p) => enabledModules.find((m) => m.id === p.moduleId)?.label)
      .filter(Boolean);
    return (
      <span className="text-[12px] text-muted-foreground">
        {labels.join(", ")}
      </span>
    );
  };

  return (
    <>
      <div className="rounded-xl border border-border bg-card shadow-sm">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3 border-b border-border p-4">
          <InputGroup className="flex-1 min-w-[240px]">
            <InputGroupAddon>
              <Search />
            </InputGroupAddon>
            <InputGroupInput
              placeholder="Buscar usuario…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <InputGroupAddon align="inline-end">
              <Badge variant="secondary">{filtered.length}</Badge>
            </InputGroupAddon>
          </InputGroup>
          <Button variant="secondary" size="sm">
            <Filter className="size-4" />
            Filtros
          </Button>
          <Button
            variant="brand"
            size="sm"
            onClick={() => setIsCreateOpen(true)}
          >
            <UserRoundPlus className="size-4" />
            Invitar usuario
          </Button>
        </div>

        {filtered.length === 0 ? (
          <div className="p-8">
            <EmptyState
              title="No hay usuarios"
              description={
                searchQuery
                  ? `No se encontraron resultados para "${searchQuery}".`
                  : "Crea el primer usuario para empezar."
              }
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="bg-muted/50 text-left">
                  {["Usuario", "Rol", "Módulos", "Último acceso", "Estado", ""].map(
                    (h) => (
                      <th
                        key={h}
                        className="px-4 py-2.5 text-[10.5px] font-bold uppercase tracking-[0.1em] text-muted-foreground"
                      >
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {filtered.map((user) => {
                  const variant = ROLE_VARIANT[user.role] ?? "secondary";
                  return (
                    <tr
                      key={user.userId}
                      className="border-t border-border transition-colors hover:bg-muted/30"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <AvatarInitials name={user.fullName} size={32} />
                          <div className="min-w-0">
                            <div className="text-[13px] font-semibold text-foreground">
                              {user.fullName}
                            </div>
                            <div className="text-[11.5px] text-muted-foreground truncate">
                              {user.email}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={variant}>
                          <ShieldCheck className="size-3" />
                          {ROLE_LABELS[user.role] ?? user.role}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 max-w-[220px]">
                        {renderModulesCell(user)}
                      </td>
                      <td className="px-4 py-3 text-[12px] text-muted-foreground">
                        {timeAgo(user.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="success">Activa</Badge>
                      </td>
                      <td className="px-2 py-3 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              className="text-muted-foreground"
                              aria-label={`Acciones para ${user.fullName}`}
                            >
                              <MoreHorizontal className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-44">
                            <DropdownMenuItem onClick={() => openEdit(user)}>
                              <SquarePen className="size-4" /> Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => setUserToDelete(user)}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="size-4" /> Eliminar
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <FormDialogHeader
              icon={UserRoundPlus}
              title="Invitar usuario"
              description="Añade un nuevo usuario con su rol y módulos asignados."
            />
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-5">
            <Field label="Nombre completo" icon={UserRound} required>
              <Input
                name="fullName"
                required
                placeholder="Nombre del usuario"
              />
            </Field>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Email" icon={AtSign} required>
                <Input name="email" type="email" required />
              </Field>
              <Field
                label="Contraseña"
                icon={KeyRound}
                required
                hint="Mínimo 6 caracteres."
              >
                <Input name="password" type="password" required minLength={6} />
              </Field>
            </div>
            <Field label="Rol" icon={ShieldCheck} required>
              <Select name="role" defaultValue="viewer">
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Administrador</SelectItem>
                  <SelectItem value="dispatcher">Despachador</SelectItem>
                  <SelectItem value="viewer">Observador</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field
              label="Módulos permitidos"
              icon={KeyRound}
              hint="No aplica para administradores."
            >
              <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-3">
                {enabledModules.map((mod) => (
                  <div key={mod.id} className="flex items-center gap-2">
                    <Checkbox
                      id={`create-${mod.id}`}
                      checked={createModules.includes(mod.id)}
                      onCheckedChange={() => toggleCreateModule(mod.id)}
                    />
                    <label
                      htmlFor={`create-${mod.id}`}
                      className="text-sm font-medium cursor-pointer select-none"
                    >
                      {mod.label}
                    </label>
                  </div>
                ))}
              </div>
            </Field>
            <div className="flex justify-end gap-2 pt-4 border-t border-border">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsCreateOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" variant="brand" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="size-4 animate-spin" />}
                {isSubmitting ? "Creando…" : "Crear usuario"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog
        open={!!userToEdit}
        onOpenChange={(o) => !o && setUserToEdit(null)}
      >
        <DialogContent>
          <DialogHeader>
            <FormDialogHeader
              icon={SquarePen}
              title="Editar usuario"
              description={userToEdit?.fullName}
            />
          </DialogHeader>
          <form onSubmit={handleUpdate} className="space-y-5">
            <Field label="Nombre completo" icon={UserRound} required>
              <Input
                name="fullName"
                defaultValue={userToEdit?.fullName}
                required
              />
            </Field>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Email" icon={AtSign} required>
                <Input
                  name="email"
                  type="email"
                  defaultValue={userToEdit?.email}
                  required
                />
              </Field>
              <Field
                label="Nueva contraseña"
                icon={KeyRound}
                hint="Deja vacío para no cambiar."
              >
                <Input name="password" type="password" minLength={6} />
              </Field>
            </div>
            <Field label="Rol" icon={ShieldCheck} required>
              <Select name="role" defaultValue={userToEdit?.role}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Administrador</SelectItem>
                  <SelectItem value="dispatcher">Despachador</SelectItem>
                  <SelectItem value="viewer">Observador</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Módulos permitidos" icon={KeyRound}>
              <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-3">
                {enabledModules.map((mod) => (
                  <div key={mod.id} className="flex items-center gap-2">
                    <Checkbox
                      id={`edit-${mod.id}`}
                      checked={editModules.includes(mod.id)}
                      onCheckedChange={() => toggleEditModule(mod.id)}
                    />
                    <label
                      htmlFor={`edit-${mod.id}`}
                      className="text-sm font-medium cursor-pointer select-none"
                    >
                      {mod.label}
                    </label>
                  </div>
                ))}
              </div>
            </Field>
            <div className="flex justify-end gap-2 pt-4 border-t border-border">
              <Button
                type="button"
                variant="outline"
                onClick={() => setUserToEdit(null)}
              >
                Cancelar
              </Button>
              <Button type="submit" variant="brand" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="size-4 animate-spin" />}
                {isSubmitting ? "Actualizando…" : "Actualizar"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!userToDelete}
        onOpenChange={() => setUserToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar usuario?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará a{" "}
              <strong>{userToDelete?.fullName}</strong> y no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-white hover:bg-destructive/90"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Eliminando…" : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
