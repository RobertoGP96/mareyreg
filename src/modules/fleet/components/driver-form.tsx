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
          <DialogTitle>
            {driver ? "Editar Conductor" : "Nuevo Conductor"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="entity_id">Entidad</Label>
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
              <p className="text-red-500 text-sm mt-1">
                {form.formState.errors.entity_id.message}
              </p>
            )}
          </div>
          <div>
            <Label htmlFor="full_name">Nombre Completo</Label>
            <Input id="full_name" {...form.register("full_name")} />
            {form.formState.errors.full_name && (
              <p className="text-red-500 text-sm mt-1">
                {form.formState.errors.full_name.message}
              </p>
            )}
          </div>
          <div>
            <Label htmlFor="identification_number">
              Numero de Identificacion
            </Label>
            <Input
              id="identification_number"
              {...form.register("identification_number")}
            />
            {form.formState.errors.identification_number && (
              <p className="text-red-500 text-sm mt-1">
                {form.formState.errors.identification_number.message}
              </p>
            )}
          </div>
          <div>
            <Label htmlFor="phone_number">Telefono</Label>
            <Input id="phone_number" {...form.register("phone_number")} />
            {form.formState.errors.phone_number && (
              <p className="text-red-500 text-sm mt-1">
                {form.formState.errors.phone_number.message}
              </p>
            )}
          </div>
          <div>
            <Label htmlFor="operative_license">Licencia Operativa</Label>
            <Input
              id="operative_license"
              {...form.register("operative_license")}
            />
          </div>
          <div className="flex justify-end gap-2">
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
