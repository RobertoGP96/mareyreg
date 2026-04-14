"use client";

import { useForm } from "react-hook-form";
import { z } from "zod/v4";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Building2, User, IdCard, Phone, FileText } from "lucide-react";
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

  if (driver) {
    form.reset({
      entity_id: driver.entityId,
      full_name: driver.fullName,
      identification_number: driver.identificationNumber,
      phone_number: driver.phoneNumber,
      operative_license: driver.operativeLicense ?? "",
    });
  }

  const handleSubmit = form.handleSubmit(async (data) => {
    await onSubmit(data);
    form.reset();
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5 text-primary" />
            {driver ? "Editar Conductor" : "Nuevo Conductor"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="entity_id" className="flex items-center gap-1.5 mb-1.5">
              <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
              Entidad
            </Label>
            <Select
              value={form.watch("entity_id")?.toString() || ""}
              onValueChange={(value) =>
                form.setValue("entity_id", parseInt(value, 10))
              }
            >
              <SelectTrigger>
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
            {form.formState.errors.entity_id && (
              <p className="text-destructive text-sm mt-1">
                {form.formState.errors.entity_id.message}
              </p>
            )}
          </div>
          <div>
            <Label htmlFor="full_name" className="flex items-center gap-1.5 mb-1.5">
              <User className="h-3.5 w-3.5 text-muted-foreground" />
              Nombre Completo
            </Label>
            <Input id="full_name" placeholder="Nombre del conductor" {...form.register("full_name")} />
            {form.formState.errors.full_name && (
              <p className="text-destructive text-sm mt-1">
                {form.formState.errors.full_name.message}
              </p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="identification_number" className="flex items-center gap-1.5 mb-1.5">
                <IdCard className="h-3.5 w-3.5 text-muted-foreground" />
                Identificacion
              </Label>
              <Input
                id="identification_number"
                placeholder="Numero de ID"
                {...form.register("identification_number")}
              />
              {form.formState.errors.identification_number && (
                <p className="text-destructive text-sm mt-1">
                  {form.formState.errors.identification_number.message}
                </p>
              )}
            </div>
            <div>
              <Label htmlFor="phone_number" className="flex items-center gap-1.5 mb-1.5">
                <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                Telefono
              </Label>
              <Input id="phone_number" placeholder="Numero de telefono" {...form.register("phone_number")} />
              {form.formState.errors.phone_number && (
                <p className="text-destructive text-sm mt-1">
                  {form.formState.errors.phone_number.message}
                </p>
              )}
            </div>
          </div>
          <div>
            <Label htmlFor="operative_license" className="flex items-center gap-1.5 mb-1.5">
              <FileText className="h-3.5 w-3.5 text-muted-foreground" />
              Licencia Operativa
            </Label>
            <Input
              id="operative_license"
              placeholder="Opcional"
              {...form.register("operative_license")}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading
                ? "Guardando..."
                : driver
                  ? "Actualizar"
                  : "Crear"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
