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
import { FormSection } from "@/components/ui/form-section";
import { RouteIcon, User, Calendar, MapPin, Package, DollarSign, Clock, Loader2 } from "lucide-react";
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

  // Reset form values when opening with a different trip (edit) or reopening (create)
  useEffect(() => {
    if (!open) return;
    if (trip) {
      form.reset({
        driver_id: trip.driverId,
        load_date: trip.loadDate ?? "",
        load_time: trip.loadTime ?? "",
        trip_payment: trip.tripPayment ?? "",
        province: trip.province ?? "",
        product: trip.product ?? "",
      });
    } else {
      form.reset({
        driver_id: 0,
        load_date: "",
        load_time: "",
        trip_payment: "",
        province: "",
        product: "",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, trip?.tripId]);

  const handleSubmit = form.handleSubmit(async (data) => {
    await onSubmit(data);
    form.reset();
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <FormDialogHeader
              icon={RouteIcon}
              title={trip ? "Editar viaje" : "Nuevo viaje"}
              description={trip ? "Actualiza los datos del viaje." : "Programa un viaje con conductor, destino y carga."}
            />
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <FormSection icon={User} title="Asignación" description="Conductor responsable del viaje.">
            <Field label="Conductor" icon={User} required error={form.formState.errors.driver_id?.message}>
              <Select
                value={form.watch("driver_id")?.toString() || ""}
                onValueChange={(value) => form.setValue("driver_id", parseInt(value, 10))}
              >
                <SelectTrigger className="w-full">
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
            </Field>
          </FormSection>

          <FormSection icon={Calendar} title="Programación" description="Fecha y hora de carga.">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Fecha de carga" icon={Calendar}>
                <Input type="date" {...form.register("load_date")} />
              </Field>
              <Field label="Hora de carga" icon={Clock}>
                <Input type="time" {...form.register("load_time")} />
              </Field>
            </div>
          </FormSection>

          <FormSection icon={MapPin} title="Destino y carga" description="Provincia de entrega y producto transportado.">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Provincia" icon={MapPin}>
                <Select
                  value={form.watch("province") || ""}
                  onValueChange={(value) => form.setValue("province", value)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Seleccionar provincia" />
                  </SelectTrigger>
                  <SelectContent>
                    {CUBAN_PROVINCES.map((p) => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Producto" icon={Package}>
                <Select
                  value={form.watch("product") || ""}
                  onValueChange={(value) => form.setValue("product", value)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Seleccionar producto" />
                  </SelectTrigger>
                  <SelectContent>
                    {PRODUCTS.map((p) => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>

            <Field label="Pago del viaje" icon={DollarSign} hint="Monto estimado o acordado.">
              <Input placeholder="0.00" {...form.register("trip_payment")} />
            </Field>
          </FormSection>

          <div className="flex justify-end gap-2 pt-4 border-t border-border">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="brand" disabled={isLoading}>
              {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              {isLoading ? "Guardando..." : trip ? "Actualizar" : "Crear viaje"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
