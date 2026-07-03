"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ResponsiveFormDialog } from "@/components/ui/responsive-form-dialog";
import { Input } from "@/components/ui/input";
import { Field, FormDialogHeader } from "@/components/ui/field";
import { FormSection } from "@/components/ui/form-section";
import { Loader2, UserRound, Phone, Mail, MapPin } from "lucide-react";
import { toast } from "@/lib/toast";
import { updateWebstoreCustomer } from "../actions/customer-actions";

export interface CustomerEditItem {
  customerId: number;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  version: number;
}

export function CustomerEditDialog({
  customer,
  open,
  onOpenChange,
}: {
  customer: CustomerEditItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (customer) {
      setName(customer.name);
      setPhone(customer.phone ?? "");
      setEmail(customer.email ?? "");
      setAddress(customer.address ?? "");
    }
  }, [customer]);

  const handleSubmit = async () => {
    if (!customer) return;
    if (!name.trim()) {
      toast.error("El nombre es requerido");
      return;
    }
    setSubmitting(true);
    const result = await updateWebstoreCustomer(customer.customerId, {
      name,
      phone: phone || undefined,
      email: email || undefined,
      address: address || undefined,
      version: customer.version,
    });
    setSubmitting(false);
    if (result.success) {
      toast.success("Cliente actualizado");
      onOpenChange(false);
      router.refresh();
    } else {
      toast.error(result.error);
    }
  };

  return (
    <ResponsiveFormDialog
      open={open}
      onOpenChange={onOpenChange}
      a11yTitle="Editar cliente"
      description="Datos de contacto del cliente de la tienda en línea."
      desktopMaxWidth="sm:max-w-lg"
    >
      <FormDialogHeader
        icon={UserRound}
        title="Editar cliente"
        description="Datos de contacto del cliente de la tienda en línea."
      />
      <div className="space-y-4 mt-4">
        <FormSection icon={UserRound} title="Datos">
          <Field label="Nombre" icon={UserRound} required>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Teléfono" icon={Phone}>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
            </Field>
            <Field label="Email" icon={Mail}>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
          </div>
          <Field label="Dirección" icon={MapPin}>
            <Input value={address} onChange={(e) => setAddress(e.target.value)} />
          </Field>
        </FormSection>
      </div>
      <div className="flex justify-end gap-2 pt-4 border-t border-border mt-4">
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
          Cancelar
        </Button>
        <Button type="button" variant="brand" onClick={handleSubmit} disabled={submitting}>
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
          {submitting ? "Guardando…" : "Guardar cambios"}
        </Button>
      </div>
    </ResponsiveFormDialog>
  );
}
