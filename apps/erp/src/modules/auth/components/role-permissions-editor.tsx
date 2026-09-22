"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/toast";
import { updateRoleModules } from "../actions/role-actions";
import type { SystemRole } from "../lib/roles";

export type ModuleOption = {
  id: string;
  label: string;
  parentId?: string;
};

type Props = {
  role: SystemRole;
  modules: ModuleOption[];
  initialModuleIds: string[];
};

function sameSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const set = new Set(a);
  return b.every((id) => set.has(id));
}

export function RolePermissionsEditor({ role, modules, initialModuleIds }: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>(initialModuleIds);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isDirty = !sameSet(selected, initialModuleIds);

  // Padres primero y cada hijo justo debajo del suyo, para que la lista lea
  // igual que el sidebar.
  const ordered = useMemo(() => {
    const top = modules.filter((m) => !m.parentId);
    return top.flatMap((parent) => [
      parent,
      ...modules.filter((m) => m.parentId === parent.id),
    ]);
  }, [modules]);

  if (role === "admin") {
    return (
      <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="grid size-9 shrink-0 place-items-center rounded-md bg-[var(--brand)]/10 text-[var(--brand)]">
            <ShieldCheck className="size-[18px]" />
          </div>
          <div className="min-w-0">
            <div className="text-[14px] font-semibold text-foreground">Acceso total</div>
            <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
              El administrador entra a todos los módulos sin importar los permisos
              asignados. No hay nada que configurar aquí.
            </p>
          </div>
        </div>
        <ul className="mt-4 grid gap-1.5 sm:grid-cols-2">
          {ordered.map((m) => (
            <li
              key={m.id}
              className={cn(
                "flex items-center gap-2 text-[13px] text-foreground",
                m.parentId && "pl-6 text-muted-foreground"
              )}
            >
              <Check className="size-3.5 text-[var(--success)]" />
              {m.label}
            </li>
          ))}
        </ul>
      </div>
    );
  }

  const toggle = (id: string) =>
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
    );

  const handleSave = async () => {
    setIsSubmitting(true);
    try {
      const result = await updateRoleModules(role, selected);
      if (result.success) {
        toast.success("Permisos del rol guardados");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
        <div className="min-w-0">
          <div className="text-[14px] font-semibold text-foreground">
            Módulos por defecto
          </div>
          <p className="mt-0.5 text-[12.5px] text-muted-foreground">
            Todos los usuarios con este rol entran a estos módulos, además de los
            que tengan asignados individualmente.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setSelected(modules.map((m) => m.id))}
            disabled={isSubmitting}
          >
            Todos
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setSelected([])}
            disabled={isSubmitting}
          >
            Ninguno
          </Button>
        </div>
      </div>

      <ul className="divide-y divide-border">
        {ordered.map((m) => {
          const checked = selected.includes(m.id);
          const inputId = `role-${role}-${m.id}`;
          return (
            <li key={m.id}>
              <label
                htmlFor={inputId}
                className={cn(
                  "flex min-h-[48px] cursor-pointer items-center gap-3 px-4 py-2.5 transition-colors hover:bg-muted/40",
                  m.parentId && "pl-10"
                )}
              >
                <Checkbox
                  id={inputId}
                  checked={checked}
                  onCheckedChange={() => toggle(m.id)}
                  disabled={isSubmitting}
                />
                <span
                  className={cn(
                    "flex-1 text-[13px] font-medium select-none",
                    m.parentId ? "text-muted-foreground" : "text-foreground"
                  )}
                >
                  {m.label}
                </span>
                {checked && (
                  <Badge variant="success" className="hidden sm:inline-flex">
                    Incluido
                  </Badge>
                )}
              </label>
            </li>
          );
        })}
      </ul>

      <div className="flex flex-col gap-2 border-t border-border p-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[12px] text-muted-foreground">
          <span className="font-semibold tabular-nums text-foreground">
            {selected.length}
          </span>{" "}
          de {modules.length} módulos · los cambios aplican cuando cada usuario
          vuelva a iniciar sesión.
        </p>
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setSelected(initialModuleIds)}
            disabled={!isDirty || isSubmitting}
          >
            Descartar
          </Button>
          <Button
            type="button"
            variant="brand"
            size="sm"
            onClick={handleSave}
            disabled={!isDirty || isSubmitting}
          >
            {isSubmitting && <Loader2 className="size-4 animate-spin" />}
            {isSubmitting ? "Guardando…" : "Guardar cambios"}
          </Button>
        </div>
      </div>
    </div>
  );
}
