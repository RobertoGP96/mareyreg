"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { PageHeader } from "@/components/ui/page-header";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  MoreHorizontal,
  Pen,
  Trash2,
  UserPlus,
  Search,
  Users,
  Shield,
  User,
  Mail,
  Lock,
  Key,
  Loader2,
} from "lucide-react";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { EmptyState } from "@/components/ui/empty-state";
import { toast } from "sonner";
import { createUser, updateUser, deleteUser } from "../actions/auth-actions";
import { getEnabledModules } from "@/lib/module-registry";

const ROLE_LABELS: Record<string, string> = {
  admin: "Administrador",
  dispatcher: "Despachador",
  viewer: "Observador",
};

const ROLE_BADGE: Record<string, "destructive" | "info" | "secondary"> = {
  admin: "destructive",
  dispatcher: "info",
  viewer: "secondary",
};

const enabledModules = getEnabledModules();

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
  const [userToDelete, setUserToDelete] = useState<number | null>(null);
  const [userToEdit, setUserToEdit] = useState<UserItem | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createModules, setCreateModules] = useState<string[]>(enabledModules.map((m) => m.id));
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
    const result = await deleteUser(userToDelete);
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

  return (
    <div className="space-y-5">
      <PageHeader
        icon={Users}
        title="Usuarios del sistema"
        description="Gestiona accesos, roles y módulos permitidos por usuario."
        badge={`${users.length} usuarios`}
      >
        <Button variant="brand" onClick={() => setIsCreateOpen(true)}>
          <UserPlus className="h-4 w-4" />
          Nuevo usuario
        </Button>
      </PageHeader>

      <div className="rounded-xl border border-border bg-card shadow-panel overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 border-b border-border bg-muted/30 px-4 py-3">
          <InputGroup className="flex-1 min-w-[240px]">
            <InputGroupAddon>
              <Search />
            </InputGroupAddon>
            <InputGroupInput
              placeholder="Buscar por nombre o email…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <InputGroupAddon align="inline-end">
              <Badge variant="brand">{filtered.length}</Badge>
            </InputGroupAddon>
          </InputGroup>
        </div>

        <div className="divide-y divide-border/60">
          {filtered.length > 0 ? (
            filtered.map((user) => (
              <div
                key={user.userId}
                className="group flex items-start gap-4 px-5 py-4 transition-colors hover:bg-[var(--brand)]/[0.04]"
              >
                <Avatar className="size-11 bg-gradient-to-br from-[var(--brand)]/20 to-[var(--brand)]/5 ring-1 ring-inset ring-[var(--brand)]/20 shrink-0">
                  <AvatarFallback className="bg-transparent text-[var(--brand)] font-bold text-sm">
                    {user.fullName
                      .split(" ")
                      .map((n) => n[0])
                      .join("")
                      .slice(0, 2)
                      .toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <p className="font-semibold text-foreground truncate">{user.fullName}</p>
                    <Badge variant={ROLE_BADGE[user.role] || "secondary"} className="gap-1">
                      <Shield className="h-3 w-3" />
                      {ROLE_LABELS[user.role]}
                    </Badge>
                  </div>
                  <p className="text-[0.82rem] text-muted-foreground mb-1.5">
                    <Mail className="h-3 w-3 inline mr-1" />
                    {user.email}
                  </p>
                  {user.role !== "admin" && user.modulePermissions.length > 0 && (
                    <div className="flex gap-1 flex-wrap">
                      {user.modulePermissions.map((p) => {
                        const mod = enabledModules.find((m) => m.id === p.moduleId);
                        return mod ? (
                          <Badge key={p.moduleId} variant="outline">
                            {mod.label}
                          </Badge>
                        ) : null;
                      })}
                    </div>
                  )}
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="size-8 opacity-60 group-hover:opacity-100">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-40">
                    <DropdownMenuItem onClick={() => openEdit(user)}>
                      <Pen className="h-4 w-4" /> Editar
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => setUserToDelete(user.userId)}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" /> Eliminar
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ))
          ) : (
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
          )}
        </div>
      </div>

      {/* Create */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <FormDialogHeader
                icon={UserPlus}
                title="Crear usuario"
                description="Añade un nuevo usuario con su rol y módulos asignados."
              />
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-5">
            <Field label="Nombre completo" icon={User} required>
              <Input name="fullName" required placeholder="Nombre del usuario" />
            </Field>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Email" icon={Mail} required>
                <Input name="email" type="email" required />
              </Field>
              <Field label="Contraseña" icon={Lock} required hint="Mínimo 6 caracteres.">
                <Input name="password" type="password" required minLength={6} />
              </Field>
            </div>
            <Field label="Rol" icon={Shield} required>
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
            <Field label="Módulos permitidos" icon={Key} hint="No aplica para administradores.">
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
              <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" variant="brand" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {isSubmitting ? "Creando…" : "Crear usuario"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit */}
      <Dialog open={!!userToEdit} onOpenChange={(o) => !o && setUserToEdit(null)}>
        <DialogContent>
          <DialogHeader>
            <FormDialogHeader
                icon={Pen}
                title="Editar usuario"
                description={userToEdit?.fullName}
              />
          </DialogHeader>
          <form onSubmit={handleUpdate} className="space-y-5">
            <Field label="Nombre completo" icon={User} required>
              <Input name="fullName" defaultValue={userToEdit?.fullName} required />
            </Field>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Email" icon={Mail} required>
                <Input name="email" type="email" defaultValue={userToEdit?.email} required />
              </Field>
              <Field label="Nueva contraseña" icon={Lock} hint="Deja vacío para no cambiar.">
                <Input name="password" type="password" minLength={6} />
              </Field>
            </div>
            <Field label="Rol" icon={Shield} required>
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
            <Field label="Módulos permitidos" icon={Key}>
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
              <Button type="button" variant="outline" onClick={() => setUserToEdit(null)}>
                Cancelar
              </Button>
              <Button type="submit" variant="brand" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {isSubmitting ? "Actualizando…" : "Actualizar"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!userToDelete} onOpenChange={() => setUserToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar usuario?</AlertDialogTitle>
            <AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription>
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
    </div>
  );
}
