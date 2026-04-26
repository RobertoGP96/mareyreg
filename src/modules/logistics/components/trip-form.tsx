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
import {
  Route as RouteIcon,
  UserRound,
  CalendarDays,
  MapPin,
  Package,
  CircleDollarSign,
  Clock,
  Loader2,
  Activity,
} from "lucide-react";
import { CUBAN_PROVINCES, PRODUCTS } from "@/lib/constants";
import type { Driver, TripStatus } from "@/types";
import type { RouteOption } from "../queries/route-queries";

const tripSchema = z.object({
  driver_id: z.number().min(1, "El conductor es requerido"),
  route_id: z.string().optional(),
  load_date: z.string().optional(),
  load_time: z.string().optional(),
  trip_payment: z.string().optional(),
  province: z.string().optional(),
  product: z.string().optional(),
  status: z.string().optional(),
});

type TripFormSchema = z.infer<typeof tripSchema>;

export type TripFormSubmit = {
  driver_id: number;
  route_id?: number | null;
  load_date?: string;
  load_time?: string;
  trip_payment?: string;
  province?: string;
  product?: string;
  status?: TripStatus;
};

interface TripForEdit {
  tripId: number;
  driverId: number;
  routeId?: number | null;
  loadDate: string | null;
  loadTime: string | null;
  tripPayment: string | null;
  province: string | null;
  product: string | null;
  status?: TripStatus;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: TripFormSubmit) => Promise<void>;
  isLoading: boolean;
  trip?: TripForEdit | null;
  drivers: Driver[];
  routes?: RouteOption[];
}

const NONE = "__none__";

export function TripForm({
  open,
  onOpenChange,
  onSubmit,
  isLoading,
  trip,
  drivers,
  routes = [],
}: Props) {
  const form = useForm<TripFormSchema>({
    resolver: zodResolver(tripSchema),
    defaultValues: {
      driver_id: trip?.driverId ?? 0,
      route_id: trip?.routeId ? String(trip.routeId) : NONE,
      load_date: trip?.loadDate ?? "",
      load_time: trip?.loadTime ?? "",
      trip_payment: trip?.tripPayment ?? "",
      province: trip?.province ?? "",
      product: trip?.product ?? "",
      status: trip?.status ?? "scheduled",
    },
  });

  useEffect(() => {
    if (!open) return;
    form.reset({
      driver_id: trip?.driverId ?? 0,
      route_id: trip?.routeId ? String(trip.routeId) : NONE,
      load_date: trip?.loadDate ?? "",
      load_time: trip?.loadTime ?? "",
      trip_payment: trip?.tripPayment ?? "",
      province: trip?.province ?? "",
      product: trip?.product ?? "",
      status: trip?.status ?? "scheduled",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, trip?.tripId]);

  const handleSubmit = form.handleSubmit(async (data) => {
    await onSubmit({
      driver_id: data.driver_id,
      route_id: data.route_id && data.route_id !== NONE ? Number(data.route_id) : null,
      load_date: data.load_date,
      load_time: data.load_time,
      trip_payment: data.trip_payment,
      province: data.province,
      product: data.product,
      status: (data.status as TripStatus | undefined) ?? "scheduled",
    });
    form.reset();
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <FormDialogHeader
            icon={RouteIcon}
            title={trip ? "Editar viaje" : "Nuevo viaje"}
            description={trip ? "Actualiza los datos del viaje." : "Programa un viaje con conductor, ruta y carga."}
          />
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <FormSection icon={UserRound} title="Asignación" description="Conductor responsable y estado.">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Conductor" icon={UserRound} required error={form.formState.errors.driver_id?.message}>
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
              <Field label="Estado" icon={Activity}>
                <Select
                  value={form.watch("status") || "scheduled"}
                  onValueChange={(value) => form.setValue("status", value)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="scheduled">Programado</SelectItem>
                    <SelectItem value="in_progress">En curso</SelectItem>
                    <SelectItem value="completed">Completado</SelectItem>
                    <SelectItem value="cancelled">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>
          </FormSection>

          <FormSection icon={RouteIcon} title="Ruta" description="Trayecto operativo (opcional).">
            <Field label="Ruta" icon={RouteIcon} hint="Selecciona una ruta del catálogo o déjala vacía.">
              <Select
                value={form.watch("route_id") || NONE}
                onValueChange={(value) => form.setValue("route_id", value)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Sin ruta asignada" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Sin ruta</SelectItem>
                  {routes.map((r) => (
                    <SelectItem key={r.routeId} value={r.routeId.toString()}>
                      {r.label}
                      {r.distanceKm != null && ` · ${r.distanceKm} km`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </FormSection>

          <FormSection icon={CalendarDays} title="Programación" description="Fecha y hora de carga.">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Fecha de carga" icon={CalendarDays}>
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

            <Field label="Pago del viaje" icon={CircleDollarSign} hint="Monto estimado o acordado.">
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
