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
import { CUBAN_PROVINCES, PRODUCTS } from "@/lib/constants";
import type { Driver } from "@/types";

const tripSchema = z.object({
  driver_id: z.number().min(1, "El conductor es requerido"),
  load_date: z.string().optional(),
  load_time: z.string().optional(),
  trip_payment: z.string().optional(),
  province: z.string().optional(),
  product: z.string().optional(),
});

type TripFormData = z.infer<typeof tripSchema>;

interface TripForEdit {
  tripId: number;
  driverId: number;
  loadDate: string | null;
  loadTime: string | null;
  tripPayment: string | null;
  province: string | null;
  product: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: TripFormData) => Promise<void>;
  isLoading: boolean;
  trip?: TripForEdit | null;
  drivers: Driver[];
}

export function TripForm({
  open,
  onOpenChange,
  onSubmit,
  isLoading,
  trip,
  drivers,
}: Props) {
  const form = useForm<TripFormData>({
    resolver: zodResolver(tripSchema),
    defaultValues: {
      driver_id: trip?.driverId ?? 0,
      load_date: trip?.loadDate ?? "",
      load_time: trip?.loadTime ?? "",
      trip_payment: trip?.tripPayment ?? "",
      province: trip?.province ?? "",
      product: trip?.product ?? "",
    },
  });

  if (trip) {
    form.reset({
      driver_id: trip.driverId,
      load_date: trip.loadDate ?? "",
      load_time: trip.loadTime ?? "",
      trip_payment: trip.tripPayment ?? "",
      province: trip.province ?? "",
      product: trip.product ?? "",
    });
  }

  const handleSubmit = form.handleSubmit(async (data) => {
    await onSubmit(data);
    form.reset();
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {trip ? "Editar Viaje" : "Nuevo Viaje"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Conductor</Label>
            <Select
              value={form.watch("driver_id")?.toString() || ""}
              onValueChange={(value) =>
                form.setValue("driver_id", parseInt(value, 10))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar conductor" />
              </SelectTrigger>
              <SelectContent>
                {drivers.map((d) => (
                  <SelectItem key={d.driverId} value={d.driverId.toString()}>
                    {d.fullName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {form.formState.errors.driver_id && (
              <p className="text-red-500 text-sm mt-1">
                {form.formState.errors.driver_id.message}
              </p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Fecha de Carga</Label>
              <Input type="date" {...form.register("load_date")} />
            </div>
            <div>
              <Label>Hora de Carga</Label>
              <Input type="time" {...form.register("load_time")} />
            </div>
          </div>
          <div>
            <Label>Provincia</Label>
            <Select
              value={form.watch("province") || ""}
              onValueChange={(value) => form.setValue("province", value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar provincia" />
              </SelectTrigger>
              <SelectContent>
                {CUBAN_PROVINCES.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Producto</Label>
            <Select
              value={form.watch("product") || ""}
              onValueChange={(value) => form.setValue("product", value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar producto" />
              </SelectTrigger>
              <SelectContent>
                {PRODUCTS.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Pago del Viaje</Label>
            <Input
              placeholder="0.00"
              {...form.register("trip_payment")}
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
                : trip
                  ? "Actualizar"
                  : "Crear"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
