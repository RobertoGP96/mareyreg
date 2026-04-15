"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Plus,
  Search,
  SquarePen,
  Trash2,
  UserRound,
  Phone,
  Mail,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import {
  createPacaClient,
  updatePacaClient,
  deletePacaClient,
  type PacaClientInput,
} from "../actions/paca-client-actions";

interface PacaClientItem {
  clientId: number;
  name: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  isActive: boolean;
}

export function PacaClientListClient({ clients }: { clients: PacaClientItem[] }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [toEdit, setToEdit] = useState<PacaClientItem | null>(null);
  const [toDelete, setToDelete] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const filtered = clients.filter((c) => {
    const q = search.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      c.phone?.toLowerCase().includes(q) ||
      c.email?.toLowerCase().includes(q)
    );
  });

  const parseForm = (fd: FormData): PacaClientInput => ({
    name: fd.get("name") as string,
    phone: (fd.get("phone") as string) || undefined,
    email: (fd.get("email") as string) || undefined,
    notes: (fd.get("notes") as string) || undefined,
  });

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    const result = await createPacaClient(parseForm(new FormData(e.currentTarget)));
    setIsSubmitting(false);
    if (result.success) {
      setIsCreateOpen(false);
      toast.success("Cliente creado");
      router.refresh();
    } else toast.error(result.error);
  };

  const handleEdit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!toEdit) return;
    setIsSubmitting(true);
    const result = await updatePacaClient(
      toEdit.clientId,
      parseForm(new FormData(e.currentTarget))
    );
    setIsSubmitting(false);
    if (result.success) {
      setToEdit(null);
      toast.success("Cliente actualizado");
      router.refresh();
    } else toast.error(result.error);
  };

  const handleDelete = async () => {
    if (toDelete == null) return;
    const result = await deletePacaClient(toDelete);
    if (result.success) {
      toast.success("Cliente eliminado");
      router.refresh();
    } else toast.error(result.error);
    setToDelete(null);
  };

  const Form = ({ initial }: { initial?: PacaClientItem }) => (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label>Nombre *</Label>
        <Input name="name" defaultValue={initial?.name} required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Telefono</Label>
          <Input name="phone" defaultValue={initial?.phone ?? ""} />
        </div>
        <div className="space-y-2">
          <Label>Email</Label>
          <Input name="email" type="email" defaultValue={initial?.email ?? ""} />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Notas</Label>
        <Textarea name="notes" rows={2} defaultValue={initial?.notes ?? ""} />
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <InputGroup className="max-w-sm">
          <InputGroupAddon>
            <Search className="w-4 h-4" />
          </InputGroupAddon>
          <InputGroupInput
            placeholder="Buscar cliente..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </InputGroup>
        <Button onClick={() => setIsCreateOpen(true)}>
          <Plus className="w-4 h-4 mr-2" /> Nuevo cliente
        </Button>
      </div>

      <div className="grid gap-3">
        {filtered.length === 0 ? (
          <EmptyState
            title="Sin clientes"
            description="Crea tu primer cliente de pacas para empezar."
          />
        ) : (
          filtered.map((c) => (
            <div
              key={c.clientId}
              className="bg-card border rounded-lg p-4 flex flex-wrap items-start gap-3 justify-between"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <UserRound className="w-4 h-4 text-muted-foreground" />
                  <p className="font-medium">{c.name}</p>
                  {!c.isActive && <Badge variant="secondary">Inactivo</Badge>}
                </div>
                <div className="text-sm text-muted-foreground mt-1 flex flex-wrap gap-x-3 gap-y-1">
                  {c.phone && (
                    <span className="flex items-center gap-1">
                      <Phone className="w-3 h-3" /> {c.phone}
                    </span>
                  )}
                  {c.email && (
                    <span className="flex items-center gap-1">
                      <Mail className="w-3 h-3" /> {c.email}
                    </span>
                  )}
                  {c.notes && <span className="truncate max-w-xs">{c.notes}</span>}
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="icon" onClick={() => setToEdit(c)}>
                  <SquarePen className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setToDelete(c.clientId)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nuevo cliente</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <Form />
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Guardar
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!toEdit} onOpenChange={(o) => !o && setToEdit(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar cliente</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEdit} className="space-y-4">
            {toEdit && <Form initial={toEdit} />}
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Guardar cambios
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={toDelete != null} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar cliente?</AlertDialogTitle>
            <AlertDialogDescription>
              El cliente sera marcado como inactivo. Las reservaciones y ventas historicas
              seguiran conservando su informacion.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
