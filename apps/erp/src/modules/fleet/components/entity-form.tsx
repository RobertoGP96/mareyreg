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
import { Field, FormDialogHeader } from "@/components/ui/field";
import { Building2, Loader2 } from "lucide-react";
import type { Entity } from "@/types";

const entitySchema = z.object({
  name: z.string().min(1, "El nombre es requerido"),
});

type EntityFormData = z.infer<typeof entitySchema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: EntityFormData) => Promise<void>;
  isLoading: boolean;
  entity?: Entity | null;
}

export function EntityForm({
  open,
  onOpenChange,
  onSubmit,
  isLoading,
  entity,
}: Props) {
  const form = useForm<EntityFormData>({
    resolver: zodResolver(entitySchema),
    defaultValues: {
      name: entity?.name ?? "",
    },
  });

  useEffect(() => {
    if (!open) return;
    form.reset({ name: entity?.name ?? "" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, entity]);

  const handleSubmit = form.handleSubmit(async (data) => {
    await onSubmit(data);
    form.reset();
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <FormDialogHeader
              icon={Building2}
              title={entity ? "Editar entidad" : "Nueva entidad"}
              description={entity ? "Actualiza el nombre de la entidad." : "Registra una nueva entidad operativa."}
            />
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5">
          <Field
            id="name"
            label="Nombre"
            icon={Building2}
            required
            error={form.formState.errors.name?.message}
          >
            <Input id="name" placeholder="Ej. Transportes del Norte S.A." {...form.register("name")} />
          </Field>
          <div className="flex justify-end gap-2 pt-4 border-t border-border">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="brand" disabled={isLoading}>
              {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              {isLoading ? "Guardando..." : entity ? "Actualizar" : "Crear entidad"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
