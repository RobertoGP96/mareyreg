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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {vehicle ? "Editar Vehiculo" : "Nuevo Vehiculo"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">Nombre</Label>
            <Input
              id="name"
              placeholder="Ej: Camion 01"
              {...form.register("name")}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="cuña_plate_number">Placa Cuna</Label>
              <Input
                id="cuña_plate_number"
                {...form.register("cuña_plate_number")}
              />
            </div>
            <div>
              <Label htmlFor="plancha_plate_number">Placa Plancha</Label>
              <Input
                id="plancha_plate_number"
                {...form.register("plancha_plate_number")}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="cuña_circulation_number">
                Circulacion Cuna
              </Label>
              <Input
                id="cuña_circulation_number"
                {...form.register("cuña_circulation_number")}
              />
            </div>
            <div>
              <Label htmlFor="plancha_circulation_number">
                Circulacion Plancha
              </Label>
              <Input
                id="plancha_circulation_number"
                {...form.register("plancha_circulation_number")}
              />
            </div>
          </div>
          <div>
            <Label htmlFor="driver_id">Conductor</Label>
            <Select
              value={form.watch("driver_id")?.toString() || "none"}
              onValueChange={(value) =>
                form.setValue(
                  "driver_id",
                  value === "none" ? undefined : parseInt(value, 10)
                )
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar conductor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sin conductor</SelectItem>
                {drivers.map((driver) => (
                  <SelectItem
                    key={driver.driverId}
                    value={driver.driverId.toString()}
                  >
                    {driver.fullName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
                : vehicle
                  ? "Actualizar"
                  : "Crear"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
