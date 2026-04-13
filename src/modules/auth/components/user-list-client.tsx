"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
  DialogTitle,
} from "@/components/ui/dialog";
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
import { MoreHorizontal, Pen, Trash2, UserPlus, Search } from "lucide-react";
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

const ROLE_COLORS: Record<string, string> = {
  admin: "bg-red-100 text-red-800",
  dispatcher: "bg-blue-100 text-blue-800",
  viewer: "bg-gray-100 text-gray-800",
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
    } else {
      toast.error(result.error);
    }
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
    } else {
      toast.error(result.error);
    }
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
    } else {
      toast.error(result.error);
    }
  };

  const openEdit = (user: UserItem) => {
    setUserToEdit(user);
    setEditModules(user.modulePermissions.map((p) => p.moduleId));
  };

  return (
    <>
      <div className="bg-card shadow-sm rounded-lg border">
        <div className="px-6 py-4 border-b">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-medium">Usuarios del Sistema</h2>
            <Button onClick={() => setIsCreateOpen(true)}>
              <UserPlus className="w-4 h-4 mr-2" />
              Agregar
            </Button>
          </div>
          <div className="mt-4">
            <InputGroup>
              <InputGroupInput
                placeholder="Buscar usuarios..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <InputGroupAddon>
                <Search />
              </InputGroupAddon>
              <InputGroupAddon align="inline-end">
                <Badge>{filtered.length}</Badge>
              </InputGroupAddon>
            </InputGroup>
          </div>
        </div>
        <div className="grid gap-4 p-6">
          {filtered.length > 0 ? (
            filtered.map((user) => (
              <div
                key={user.userId}
                className="bg-card border rounded-lg p-4 flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                      {user.fullName
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .slice(0, 2)
                        .toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium">{user.fullName}</p>
                    <p className="text-sm text-muted-foreground">{user.email}</p>
                  </div>
                  <Badge className={ROLE_COLORS[user.role]}>
                    {ROLE_LABELS[user.role]}
                  </Badge>
                  {user.role !== "admin" && (
                    <div className="flex gap-1">
                      {user.modulePermissions.map((p) => {
                        const mod = enabledModules.find((m) => m.id === p.moduleId);
                        return mod ? (
                          <Badge key={p.moduleId} variant="outline" className="text-xs">
                            {mod.label}
                          </Badge>
                        ) : null;
                      })}
                    </div>
                  )}
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => openEdit(user)}>
                      <Pen className="h-4 w-4 mr-2" />
                      Editar
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => setUserToDelete(user.userId)}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Eliminar
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ))
          ) : (
            <EmptyState title="No hay usuarios" description="No se encontraron usuarios." />
          )}
        </div>
      </div>

      {/* Create Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Crear Usuario</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-2">
              <Label>Nombre completo</Label>
              <Input name="fullName" required />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input name="email" type="email" required />
            </div>
            <div className="space-y-2">
              <Label>Contrasena</Label>
              <Input name="password" type="password" required minLength={6} />
            </div>
            <div className="space-y-2">
              <Label>Rol</Label>
              <Select name="role" defaultValue="viewer">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Administrador</SelectItem>
                  <SelectItem value="dispatcher">Despachador</SelectItem>
                  <SelectItem value="viewer">Observador</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Modulos permitidos</Label>
              <div className="space-y-2 rounded-md border p-3">
                {enabledModules.map((mod) => (
                  <div key={mod.id} className="flex items-center gap-2">
                    <Checkbox
                      id={`create-${mod.id}`}
                      checked={createModules.includes(mod.id)}
                      onCheckedChange={() => toggleCreateModule(mod.id)}
                    />
                    <Label htmlFor={`create-${mod.id}`} className="font-normal cursor-pointer">
                      {mod.label}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "Creando..." : "Crear Usuario"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!userToEdit} onOpenChange={(o) => !o && setUserToEdit(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Usuario</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpdate} className="space-y-4">
            <div className="space-y-2">
              <Label>Nombre completo</Label>
              <Input name="fullName" defaultValue={userToEdit?.fullName} required />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input name="email" type="email" defaultValue={userToEdit?.email} required />
            </div>
            <div className="space-y-2">
              <Label>Nueva contrasena (dejar vacio para no cambiar)</Label>
              <Input name="password" type="password" minLength={6} />
            </div>
            <div className="space-y-2">
              <Label>Rol</Label>
              <Select name="role" defaultValue={userToEdit?.role}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Administrador</SelectItem>
                  <SelectItem value="dispatcher">Despachador</SelectItem>
                  <SelectItem value="viewer">Observador</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Modulos permitidos</Label>
              <div className="space-y-2 rounded-md border p-3">
                {enabledModules.map((mod) => (
                  <div key={mod.id} className="flex items-center gap-2">
                    <Checkbox
                      id={`edit-${mod.id}`}
                      checked={editModules.includes(mod.id)}
                      onCheckedChange={() => toggleEditModule(mod.id)}
                    />
                    <Label htmlFor={`edit-${mod.id}`} className="font-normal cursor-pointer">
                      {mod.label}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "Actualizando..." : "Actualizar"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={!!userToDelete} onOpenChange={() => setUserToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar usuario?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta accion no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Eliminando..." : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
