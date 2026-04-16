"use client";

import { useEffect, useState } from "react";
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
import {
  Container,
  Barcode,
  PackageCheck,
  Loader2,
  Boxes,
  Package,
} from "lucide-react";
import { CONTAINER_TYPES } from "@/lib/constants";
import { cn } from "@/lib/utils";

const containerSchema = z.object({
  serials_raw: z.string().min(1, "Ingresa al menos un numero de serie"),
  type: z.string().optional(),
});

type ContainerFormData = z.infer<typeof containerSchema>;

export type ContainerSubmitPayload =
  | { mode: "single"; serial_number: string; type?: string }
  | { mode: "bulk"; serial_numbers: string[]; type?: string };

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: ContainerSubmitPayload) => Promise<void>;
  isLoading: boolean;
}

function parseSerials(raw: string): string[] {
  return raw
    .split(/[\s,;]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export function ContainerForm({ open, onOpenChange, onSubmit, isLoading }: Props) {
  const [mode, setMode] = useState<"single" | "bulk">("single");
  const form = useForm<ContainerFormData>({
    resolver: zodResolver(containerSchema),
    defaultValues: { serials_raw: "", type: "" },
  });

  useEffect(() => {
    if (!open) {
      form.reset({ serials_raw: "", type: "" });
      setMode("single");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const rawValue = form.watch("serials_raw") || "";
  const parsed = mode === "bulk" ? parseSerials(rawValue) : [];

  const handleSubmit = form.handleSubmit(async (data) => {
    const type = data.type && data.type.length > 0 ? data.type : undefined;
    if (mode === "single") {
      const serial = data.serials_raw.trim();
      if (!serial) {
        form.setError("serials_raw", { message: "El numero de serie es requerido" });
        return;
      }
      await onSubmit({ mode: "single", serial_number: serial, type });
    } else {
      const list = parseSerials(data.serials_raw);
      if (list.length === 0) {
        form.setError("serials_raw", { message: "Ingresa al menos un numero de serie" });
        return;
      }
      await onSubmit({ mode: "bulk", serial_numbers: list, type });
    }
    form.reset({ serials_raw: "", type: "" });
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <FormDialogHeader
            icon={Container}
            title="Agregar contenedor(es)"
            description="Registra uno o varios contenedores para este viaje."
          />
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Selector modo */}
          <div className="grid grid-cols-2 gap-2 rounded-lg border border-border bg-muted/30 p-1">
            <button
              type="button"
              onClick={() => setMode("single")}
              className={cn(
                "inline-flex items-center justify-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                mode === "single"
                  ? "bg-background text-foreground shadow-sm ring-1 ring-inset ring-border"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Package className="h-4 w-4" />
              Uno
            </button>
            <button
              type="button"
              onClick={() => setMode("bulk")}
              className={cn(
                "inline-flex items-center justify-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                mode === "bulk"
                  ? "bg-background text-foreground shadow-sm ring-1 ring-inset ring-border"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Boxes className="h-4 w-4" />
              Varios
            </button>
          </div>

          {mode === "single" ? (
            <Field
              id="serial_number"
              label="Numero de serie"
              icon={Barcode}
              required
              error={form.formState.errors.serials_raw?.message}
            >
              <Input
                id="serial_number"
                placeholder="Ej. MSKU1234567"
                {...form.register("serials_raw")}
              />
            </Field>
          ) : (
            <Field
              id="serials_raw"
              label="Numeros de serie"
              icon={Barcode}
              required
              hint={
                parsed.length > 0
                  ? `${parsed.length} contenedor${parsed.length === 1 ? "" : "es"} detectado${parsed.length === 1 ? "" : "s"}`
                  : "Uno por linea o separados por coma / espacio"
              }
              error={form.formState.errors.serials_raw?.message}
            >
              <Textarea
                id="serials_raw"
                rows={5}
                placeholder={"MSKU1234567\nHLBU9876543\nTCNU5555555"}
                {...form.register("serials_raw")}
              />
            </Field>
          )}

          <Field
            label="Tipo"
            icon={PackageCheck}
            hint={mode === "bulk" ? "Se aplicara a todos los contenedores." : "Opcional."}
          >
            <Select
              value={form.watch("type") || ""}
              onValueChange={(value) => form.setValue("type", value)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Seleccionar tipo" />
              </SelectTrigger>
              <SelectContent>
                {CONTAINER_TYPES.map((ct) => (
                  <SelectItem key={ct.value} value={ct.value}>
                    {ct.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <div className="flex justify-end gap-2 pt-4 border-t border-border">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="brand" disabled={isLoading}>
              {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              {isLoading
                ? "Agregando..."
                : mode === "bulk" && parsed.length > 1
                  ? `Agregar ${parsed.length} contenedores`
                  : "Agregar contenedor"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
