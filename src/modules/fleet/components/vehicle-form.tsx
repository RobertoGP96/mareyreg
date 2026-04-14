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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Field, FormDialogHeader } from "@/components/ui/field";
import { FormSection } from "@/components/ui/form-section";
import { Truck, Tag, FileText, User, Loader2 } from "lucide-react";
import type { Driver } from "@/types";

const vehicleSchema = z.object({
  name: z.string().optional(),
  cuña_circulation_number: z.string().optional(),
  plancha_circulation_number: z.string().optional(),
  cuña_plate_number: z.string().optional(),
  plancha_plate_number: z.string().optional(),
  driver_id: z.number().optional(),
});

type VehicleFormData = z.infer<typeof vehicleSchema>;

interface VehicleForEdit {
  name: string | null;
  cuña_circulation_number: string | null;
  plancha_circulation_number: string | null;
  cuña_plate_number: string | null;
  plancha_plate_number: string | null;
  driver_id: number | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: VehicleFormData) => Promise<void>;
  isLoading: boolean;
  vehicle?: VehicleForEdit | null;
  drivers: Driver[];
}

export function VehicleForm({
  open,
  onOpenChange,
  onSubmit,
  isLoading,
  vehicle,
  drivers,
}: Props) {
  const form = useForm<VehicleFormData>({
    resolver: zodResolver(vehicleSchema),
    defaultValues: {
      name: vehicle?.name ?? "",
      cuña_circulation_number: vehicle?.cuña_circulation_number ?? "",
      plancha_circulation_number: vehicle?.plancha_circulation_number ?? "",
      cuña_plate_number: vehicle?.cuña_plate_number ?? "",
      plancha_plate_number: vehicle?.plancha_plate_number ?? "",
      driver_id: vehicle?.driver_id ?? undefined,
    },
  });

  if (vehicle) {
    form.reset({
      name: vehicle.name ?? "",
      cuña_circulation_number: vehicle.cuña_circulation_number ?? "",
      plancha_circulation_number: vehicle.plancha_circulation_number ?? "",
      cuña_plate_number: vehicle.cuña_plate_number ?? "",
      plancha_plate_number: vehicle.plancha_plate_number ?? "",
      driver_id: vehicle.driver_id ?? undefined,
    });
  }

  const handleSubmit = form.handleSubmit(async (data) => {
    await onSubmit(data);
    form.reset();
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle asChild>
            <FormDialogHeader
              icon={Truck}
              title={vehicle ? "Editar vehículo" : "Nuevo vehículo"}
              description={vehicle ? "Actualiza los datos del vehículo." : "Registra un nuevo vehículo con sus placas y documentación."}
            />
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <FormSection icon={Truck} title="Identificación" description="Información principal del vehículo y conductor asignado.">
            <Field id="name" label="Nombre" icon={Truck}>
              <Input id="name" placeholder="Ej. Camión 01" {...form.register("name")} />
            </Field>

            <Field label="Conductor asignado" icon={User} hint="Puede dejarse sin asignar.">
              <Select
                value={form.watch("driver_id")?.toString() || "none"}
                onValueChange={(value) =>
                  form.setValue(
                    "driver_id",
                    value === "none" ? undefined : parseInt(value, 10)
                  )
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Seleccionar conductor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin conductor</SelectItem>
                  {drivers.map((driver) => (
                    <SelectItem key={driver.driverId} value={driver.driverId.toString()}>
                      {driver.fullName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </FormSection>

          <FormSection icon={Tag} title="Placas" description="Placas de circulación de cuña y plancha.">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field id="cuña_plate_number" label="Placa Cuña" icon={Tag}>
                <Input id="cuña_plate_number" placeholder="ABC-1234" {...form.register("cuña_plate_number")} />
              </Field>
              <Field id="plancha_plate_number" label="Placa Plancha" icon={Tag}>
                <Input id="plancha_plate_number" placeholder="XYZ-5678" {...form.register("plancha_plate_number")} />
              </Field>
            </div>
          </FormSection>

          <FormSection icon={FileText} title="Documentación" description="Números de circulación oficiales.">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field id="cuña_circulation_number" label="Circulación Cuña" icon={FileText}>
                <Input id="cuña_circulation_number" {...form.register("cuña_circulation_number")} />
              </Field>
              <Field id="plancha_circulation_number" label="Circulación Plancha" icon={FileText}>
                <Input id="plancha_circulation_number" {...form.register("plancha_circulation_number")} />
              </Field>
            </div>
          </FormSection>

          <div className="flex justify-end gap-2 pt-4 border-t border-border">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="brand" disabled={isLoading}>
              {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              {isLoading ? "Guardando..." : vehicle ? "Actualizar" : "Crear vehículo"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
