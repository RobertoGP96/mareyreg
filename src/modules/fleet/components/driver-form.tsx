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
import type { Driver } from "@/types";

const driverSchema = z.object({
  full_name: z.string().min(1, "El nombre es requerido"),
  identification_number: z.string().min(1, "La identificacion es requerida"),
  phone_number: z.string().min(1, "El telefono es requerido"),
  operative_license: z.string().optional(),
});

type DriverFormData = z.infer<typeof driverSchema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: DriverFormData) => Promise<void>;
  isLoading: boolean;
  driver?: Driver | null;
}

export function DriverForm({
  open,
  onOpenChange,
  onSubmit,
  isLoading,
  driver,
}: Props) {
  const form = useForm<DriverFormData>({
    resolver: zodResolver(driverSchema),
    defaultValues: {
      full_name: driver?.fullName ?? "",
      identification_number: driver?.identificationNumber ?? "",
      phone_number: driver?.phoneNumber ?? "",
      operative_license: driver?.operativeLicense ?? "",
    },
  });

  // Reset form when driver changes
  if (driver) {
    form.reset({
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
