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
  Building2,
  Phone,
  Mail,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import {
  createSupplier,
  updateSupplier,
  deleteSupplier,
  type SupplierInput,
} from "../actions/supplier-actions";

interface SupplierItem {
  supplierId: number;
  name: string;
  taxId: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  contactPerson: string | null;
  paymentTerms: number | null;
  isActive: boolean;
}

export function SupplierListClient({ suppliers }: { suppliers: SupplierItem[] }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [toEdit, setToEdit] = useState<SupplierItem | null>(null);
  const [toDelete, setToDelete] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const filtered = suppliers.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.taxId?.toLowerCase().includes(search.toLowerCase()) ||
      s.contactPerson?.toLowerCase().includes(search.toLowerCase())
  );

  const parseForm = (fd: FormData): SupplierInput => ({
    name: fd.get("name") as string,
    taxId: (fd.get("taxId") as string) || undefined,
    email: (fd.get("email") as string) || undefined,
    phone: (fd.get("phone") as string) || undefined,
    address: (fd.get("address") as string) || undefined,
    contactPerson: (fd.get("contactPerson") as string) || undefined,
    paymentTerms: fd.get("paymentTerms") ? Number(fd.get("paymentTerms")) : undefined,
    notes: (fd.get("notes") as string) || undefined,
  });

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    const result = await createSupplier(parseForm(new FormData(e.currentTarget)));
    setIsSubmitting(false);
    if (result.success) {
      setIsCreateOpen(false);
      toast.success("Proveedor creado");
      router.refresh();
    } else toast.error(result.error);
  };

  const handleEdit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!toEdit) return;
    setIsSubmitting(true);
    const result = await updateSupplier(toEdit.supplierId, parseForm(new FormData(e.currentTarget)));
    setIsSubmitting(false);
    if (result.success) {
      setToEdit(null);
      toast.success("Proveedor actualizado");
      router.refresh();
    } else toast.error(result.error);
  };

  const handleDelete = async () => {
    if (toDelete == null) return;
    const result = await deleteSupplier(toDelete);
    if (result.success) {
      toast.success("Proveedor eliminado");
      router.refresh();
    } else toast.error(result.error);
    setToDelete(null);
  };

  const Form = ({ initial }: { initial?: SupplierItem }) => (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label>Nombre *</Label>
        <Input name="name" defaultValue={initial?.name} required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Identificacion fiscal</Label>
          <Input name="taxId" defaultValue={initial?.taxId ?? ""} placeholder="NIT / RUC / RFC" />
        </div>
        <div className="space-y-2">
          <Label>Persona de contacto</Label>
          <Input name="contactPerson" defaultValue={initial?.contactPerson ?? ""} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Email</Label>
          <Input name="email" type="email" defaultValue={initial?.email ?? ""} />
        </div>
        <div className="space-y-2">
          <Label>Telefono</Label>
          <Input name="phone" defaultValue={initial?.phone ?? ""} />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Direccion</Label>
        <Input name="address" defaultValue={initial?.address ?? ""} />
      </div>
      <div className="space-y-2">
        <Label>Dias de credito</Label>
        <Input name="paymentTerms" type="number" min={0} defaultValue={initial?.paymentTerms ?? ""} />
      </div>
      <div className="space-y-2">
        <Label>Notas</Label>
        <Textarea name="notes" rows={2} />
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <InputGroup className="max-w-sm">
          <InputGroupAddon><Search className="w-4 h-4" /></InputGroupAddon>
          <InputGroupInput
            placeholder="Buscar proveedor..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </InputGroup>
        <Button onClick={() => setIsCreateOpen(true)}>
          <Plus className="w-4 h-4 mr-2" /> Nuevo proveedor
        </Button>
      </div>

      <div className="grid gap-3">
        {filtered.length === 0 ? (
          <EmptyState title="Sin proveedores" description="Crea tu primer proveedor para empezar." />
        ) : (
          filtered.map((s) => (
            <div
              key={s.supplierId}
              className="bg-card border rounded-lg p-4 flex flex-wrap items-start gap-3 justify-between"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Building2 className="w-4 h-4 text-muted-foreground" />
                  <p className="font-medium">{s.name}</p>
                  {!s.isActive && <Badge variant="secondary">Inactivo</Badge>}
                  {s.taxId && <Badge variant="outline">{s.taxId}</Badge>}
                </div>
                <div className="text-sm text-muted-foreground mt-1 flex flex-wrap gap-x-3 gap-y-1">
                  {s.contactPerson && <span>Contacto: {s.contactPerson}</span>}
                  {s.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" /> {s.email}</span>}
                  {s.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {s.phone}</span>}
                  {s.paymentTerms != null && <span>Credito: {s.paymentTerms} dias</span>}
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="icon" onClick={() => setToEdit(s)}>
                  <SquarePen className="w-4 h-4" />
                </Button>
                <Button variant="outline" size="icon" onClick={() => setToDelete(s.supplierId)}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nuevo proveedor</DialogTitle></DialogHeader>
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
          <DialogHeader><DialogTitle>Editar proveedor</DialogTitle></DialogHeader>
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
            <AlertDialogTitle>Eliminar proveedor?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta accion no se puede deshacer. Si el proveedor tiene ordenes de compra, sera rechazado.
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
