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
import { Textarea } from "@/components/ui/textarea";
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
  MapPin,
  Gauge,
  Clock,
  Loader2,
  FileText,
} from "lucide-react";
import { CUBAN_PROVINCES } from "@/lib/constants";

const routeSchema = z
  .object({
    origin_province: z.string().min(1, "Origen requerido"),
    destination_province: z.string().min(1, "Destino requerido"),
    distance_km: z.string().optional(),
    estimated_hours: z.string().optional(),
    description: z.string().optional(),
  })
  .refine((d) => d.origin_province !== d.destination_province, {
    message: "Origen y destino deben ser diferentes",
    path: ["destination_province"],
  });

export type RouteFormData = z.infer<typeof routeSchema>;

export interface RouteForEdit {
  routeId: number;
  originProvince: string;
  destinationProvince: string;
  distanceKm: number | null;
  estimatedHours: number | null;
  description: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: {
    origin_province: string;
    destination_province: string;
    distance_km?: number | null;
    estimated_hours?: number | null;
    description?: string | null;
  }) => Promise<void>;
  isLoading: boolean;
  route?: RouteForEdit | null;
}

export function RouteForm({ open, onOpenChange, onSubmit, isLoading, route }: Props) {
  const form = useForm<RouteFormData>({
    resolver: zodResolver(routeSchema),
    defaultValues: {
      origin_province: route?.originProvince ?? "",
      destination_province: route?.destinationProvince ?? "",
      distance_km: route?.distanceKm?.toString() ?? "",
      estimated_hours: route?.estimatedHours?.toString() ?? "",
      description: route?.description ?? "",
    },
  });

  useEffect(() => {
    if (!open) return;
    form.reset({
      origin_province: route?.originProvince ?? "",
      destination_province: route?.destinationProvince ?? "",
      distance_km: route?.distanceKm?.toString() ?? "",
      estimated_hours: route?.estimatedHours?.toString() ?? "",
      description: route?.description ?? "",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, route?.routeId]);

  const handleSubmit = form.handleSubmit(async (data) => {
    await onSubmit({
      origin_province: data.origin_province,
      destination_province: data.destination_province,
      distance_km: data.distance_km ? Number(data.distance_km) : null,
      estimated_hours: data.estimated_hours ? Number(data.estimated_hours) : null,
      description: data.description?.trim() || null,
    });
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <FormDialogHeader
            icon={RouteIcon}
            title={route ? "Editar ruta" : "Nueva ruta"}
            description={route ? "Actualiza los datos de la ruta." : "Define un origen y destino con métricas estimadas."}
          />
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <FormSection icon={MapPin} title="Trayecto" description="Provincias de origen y destino.">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Origen" icon={MapPin} required error={form.formState.errors.origin_province?.message}>
                <Select
                  value={form.watch("origin_province") || ""}
                  onValueChange={(value) => form.setValue("origin_province", value, { shouldValidate: true })}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Provincia de origen" />
                  </SelectTrigger>
                  <SelectContent>
                    {CUBAN_PROVINCES.map((p) => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Destino" icon={MapPin} required error={form.formState.errors.destination_province?.message}>
                <Select
                  value={form.watch("destination_province") || ""}
                  onValueChange={(value) => form.setValue("destination_province", value, { shouldValidate: true })}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Provincia de destino" />
                  </SelectTrigger>
                  <SelectContent>
                    {CUBAN_PROVINCES.map((p) => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
          </FormSection>

          <FormSection icon={Gauge} title="Métricas" description="Distancia y duración estimadas.">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Distancia (km)" icon={Gauge}>
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  placeholder="0"
                  {...form.register("distance_km")}
                />
              </Field>
              <Field label="Horas estimadas" icon={Clock}>
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  placeholder="0"
                  {...form.register("estimated_hours")}
                />
              </Field>
            </div>
            <Field label="Descripción" icon={FileText} hint="Notas opcionales sobre la ruta.">
              <Textarea rows={3} placeholder="Detalles, peajes, restricciones…" {...form.register("description")} />
            </Field>
          </FormSection>

          <div className="flex justify-end gap-2 pt-4 border-t border-border">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="brand" disabled={isLoading}>
              {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              {isLoading ? "Guardando..." : route ? "Actualizar" : "Crear ruta"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
