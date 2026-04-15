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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Plus,
  Search,
  SquarePen,
  Trash2,
  User,
  Phone,
  Mail,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import {
  createCustomer,
  updateCustomer,
  deleteCustomer,
  type CustomerInput,
} from "../actions/customer-actions";

interface CustomerItem {
  customerId: number;
  name: string;
  taxId: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  customerType: "retail" | "wholesale";
  creditLimit: unknown;
  currentBalance: unknown;
  paymentTerms: number | null;
  priceListId: number | null;
  isActive: boolean;
}

interface PriceListOption {
  priceListId: number;
  name: string;
}

interface Props {
  customers: CustomerItem[];
  priceLists: PriceListOption[];
}

export function CustomerListClient({ customers, priceLists }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [toEdit, setToEdit] = useState<CustomerItem | null>(null);
  const [toDelete, setToDelete] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [customerType, setCustomerType] = useState<"retail" | "wholesale">("retail");
  const [priceListId, setPriceListId] = useState<string>("none");

  const filtered = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.taxId?.toLowerCase().includes(search.toLowerCase()) ||
      c.phone?.includes(search)
  );

  const parseForm = (fd: FormData): CustomerInput => ({
    name: fd.get("name") as string,
    taxId: (fd.get("taxId") as string) || undefined,
    email: (fd.get("email") as string) || undefined,
    phone: (fd.get("phone") as string) || undefined,
    address: (fd.get("address") as string) || undefined,
    customerType,
    creditLimit: fd.get("creditLimit") ? Number(fd.get("creditLimit")) : undefined,
    paymentTerms: fd.get("paymentTerms") ? Number(fd.get("paymentTerms")) : undefined,
    priceListId: priceListId === "none" ? null : Number(priceListId),
    notes: (fd.get("notes") as string) || undefined,
  });

  const openCreate = () => {
    setCustomerType("retail");
    setPriceListId("none");
    setIsCreateOpen(true);
  };

  const openEdit = (c: CustomerItem) => {
    setCustomerType(c.customerType);
    setPriceListId(c.priceListId ? String(c.priceListId) : "none");
    setToEdit(c);
  };

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    const result = await createCustomer(parseForm(new FormData(e.currentTarget)));
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
    const result = await updateCustomer(toEdit.customerId, parseForm(new FormData(e.currentTarget)));
    setIsSubmitting(false);
    if (result.success) {
      setToEdit(null);
      toast.success("Cliente actualizado");
      router.refresh();
    } else toast.error(result.error);
  };

  const handleDelete = async () => {
    if (toDelete == null) return;
    const result = await deleteCustomer(toDelete);
    if (result.success) {
      toast.success("Cliente eliminado");
      router.refresh();
    } else toast.error(result.error);
    setToDelete(null);
  };

  const Form = ({ initial }: { initial?: CustomerItem }) => (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label>Nombre *</Label>
        <Input name="name" defaultValue={initial?.name} required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Tipo *</Label>
          <Select value={customerType} onValueChange={(v) => setCustomerType(v as typeof customerType)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="retail">Minorista</SelectItem>
              <SelectItem value="wholesale">Mayorista</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Identificacion fiscal</Label>
          <Input name="taxId" defaultValue={initial?.taxId ?? ""} />
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
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Limite de credito</Label>
          <Input name="creditLimit" type="number" step="0.01" min={0} defaultValue={initial?.creditLimit ? String(initial.creditLimit) : ""} />
        </div>
        <div className="space-y-2">
          <Label>Dias de credito</Label>
          <Input name="paymentTerms" type="number" min={0} defaultValue={initial?.paymentTerms ?? ""} />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Lista de precios</Label>
        <Select value={priceListId} onValueChange={setPriceListId}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Precio estandar</SelectItem>
            {priceLists.map((p) => (
              <SelectItem key={p.priceListId} value={String(p.priceListId)}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
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
            placeholder="Buscar cliente..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </InputGroup>
        <Button onClick={openCreate}>
          <Plus className="w-4 h-4 mr-2" /> Nuevo cliente
        </Button>
      </div>

      <div className="grid gap-3">
        {filtered.length === 0 ? (
          <EmptyState title="Sin clientes" description="Crea tu primer cliente para empezar a vender." />
        ) : (
          filtered.map((c) => (
            <div
              key={c.customerId}
              className="bg-card border rounded-lg p-4 flex flex-wrap items-start gap-3 justify-between"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <User className="w-4 h-4 text-muted-foreground" />
                  <p className="font-medium">{c.name}</p>
                  <Badge variant="outline">{c.customerType === "wholesale" ? "Mayorista" : "Minorista"}</Badge>
                  {!c.isActive && <Badge variant="secondary">Inactivo</Badge>}
                </div>
                <div className="text-sm text-muted-foreground mt-1 flex flex-wrap gap-x-3 gap-y-1">
                  {c.taxId && <span>ID: {c.taxId}</span>}
                  {c.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" /> {c.email}</span>}
                  {c.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {c.phone}</span>}
                  <span>Saldo: ${String(c.currentBalance)}</span>
                  {c.creditLimit != null && Number(c.creditLimit) > 0 && <span>Limite: ${String(c.creditLimit)}</span>}
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="icon" onClick={() => openEdit(c)}>
                  <SquarePen className="w-4 h-4" />
                </Button>
                <Button variant="outline" size="icon" onClick={() => setToDelete(c.customerId)}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nuevo cliente</DialogTitle></DialogHeader>
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
          <DialogHeader><DialogTitle>Editar cliente</DialogTitle></DialogHeader>
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
              Esta accion no se puede deshacer. Si el cliente tiene facturas, sera rechazado.
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
