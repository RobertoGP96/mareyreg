"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod/v4";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Field, FormDialogHeader } from "@/components/ui/field";
import { Building2, User, IdCard, Phone, FileText, Loader2 } from "lucide-react";
import type { Entity } from "@/types";

const driverSchema = z.object({
  entity_id: z.number().min(1, "La entidad es requerida"),
  full_name: z.string().min(1, "El nombre es requerido"),
  identification_number: z.string().min(1, "La identificacion es requerida"),
  phone_number: z.string().min(1, "El telefono es requerido"),
  operative_license: z.string().optional(),
});

type DriverFormData = z.infer<typeof driverSchema>;

interface DriverForEdit {
  entityId: number;
  fullName: string;
  identificationNumber: string;
  phoneNumber: string;
  operativeLicense: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: DriverFormData) => Promise<void>;
  isLoading: boolean;
  driver?: DriverForEdit | null;
  entities: Entity[];
}

export function DriverForm({
  open,
  onOpenChange,
  onSubmit,
  isLoading,
  driver,
  entities,
}: Props) {
  const form = useForm<DriverFormData>({
    resolver: zodResolver(driverSchema),
    defaultValues: {
      entity_id: driver?.entityId ?? 0,
      full_name: driver?.fullName ?? "",
      identification_number: driver?.identificationNumber ?? "",
      phone_number: driver?.phoneNumber ?? "",
      operative_license: driver?.operativeLicense ?? "",
    },
  });

  useEffect(() => {
    if (!open) return;
    if (driver) {
      form.reset({
        entity_id: driver.entityId,
        full_name: driver.fullName,
        identification_number: driver.identificationNumber,
        phone_number: driver.phoneNumber,
        operative_license: driver.operativeLicense ?? "",
      });
    } else {
      form.reset({
        entity_id: 0,
        full_name: "",
        identification_number: "",
        phone_number: "",
        operative_license: "",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, driver]);

  const handleSubmit = form.handleSubmit(async (data) => {
    await onSubmit(data);
    form.reset();
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <FormDialogHeader
              icon={User}
              title={driver ? "Editar conductor" : "Nuevo conductor"}
              description={driver ? "Actualiza los datos del conductor." : "Registra un nuevo conductor en el sistema."}
            />
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          <Field
            label="Entidad"
            icon={Building2}
            required
            error={form.formState.errors.entity_id?.message}
          >
            <Select
              value={form.watch("entity_id")?.toString() || ""}
              onValueChange={(value) =>
                form.setValue("entity_id", parseInt(value, 10))
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Seleccionar entidad" />
              </SelectTrigger>
              <SelectContent>
                {entities.map((entity) => (
                  <SelectItem
                    key={entity.entityId}
                    value={entity.entityId.toString()}
                  >
                    {entity.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field
            id="full_name"
            label="Nombre completo"
            icon={User}
            required
            error={form.formState.errors.full_name?.message}
          >
            <Input id="full_name" placeholder="Ej. Juan Pérez López" {...form.register("full_name")} />
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field
              id="identification_number"
              label="Identificación"
              icon={IdCard}
              required
              error={form.formState.errors.identification_number?.message}
            >
              <Input
                id="identification_number"
                placeholder="Número de ID"
                {...form.register("identification_number")}
              />
            </Field>
            <Field
              id="phone_number"
              label="Teléfono"
              icon={Phone}
              required
              error={form.formState.errors.phone_number?.message}
            >
              <Input id="phone_number" placeholder="Número de contacto" {...form.register("phone_number")} />
            </Field>
          </div>

          <Field
            id="operative_license"
            label="Licencia operativa"
            icon={FileText}
            hint="Opcional — ingresa el número de licencia si aplica."
          >
            <Input
              id="operative_license"
              placeholder="Número de licencia"
              {...form.register("operative_license")}
            />
          </Field>

          <div className="flex justify-end gap-2 pt-4 border-t border-border">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" variant="brand" disabled={isLoading}>
              {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              {isLoading ? "Guardando..." : driver ? "Actualizar" : "Crear conductor"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
