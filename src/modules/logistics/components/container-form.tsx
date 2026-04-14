"use client";

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
import { Container, Barcode, PackageCheck, Loader2 } from "lucide-react";
import { CONTAINER_TYPES } from "@/lib/constants";

const containerSchema = z.object({
  serial_number: z.string().min(1, "El numero de serie es requerido"),
  type: z.string().optional(),
});

type ContainerFormData = z.infer<typeof containerSchema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: ContainerFormData) => Promise<void>;
  isLoading: boolean;
}

export function ContainerForm({ open, onOpenChange, onSubmit, isLoading }: Props) {
  const form = useForm<ContainerFormData>({
    resolver: zodResolver(containerSchema),
    defaultValues: { serial_number: "", type: "" },
  });

  const handleSubmit = form.handleSubmit(async (data) => {
    await onSubmit(data);
    form.reset();
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <FormDialogHeader
              icon={Container}
              title="Agregar contenedor"
              description="Registra un contenedor identificado por número de serie."
            />
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5">
          <Field
            id="serial_number"
            label="Número de serie"
            icon={Barcode}
            required
            error={form.formState.errors.serial_number?.message}
          >
            <Input id="serial_number" placeholder="Ej. MSKU1234567" {...form.register("serial_number")} />
          </Field>

          <Field label="Tipo" icon={PackageCheck} hint="Opcional.">
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
              {isLoading ? "Agregando..." : "Agregar contenedor"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
