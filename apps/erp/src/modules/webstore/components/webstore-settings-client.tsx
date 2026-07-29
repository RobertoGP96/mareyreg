"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Field } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Settings2, Warehouse, TriangleAlert, Info } from "lucide-react";
import { toast } from "@/lib/toast";
import { updateWebstoreWarehouse } from "../actions/settings-actions";

const AUTO_VALUE = "auto";

const LOCATION_TYPE_LABELS: Record<string, string> = {
  general: "Almacén general",
  store: "Punto de venta",
  service_unit: "Unidad de servicio",
};

interface WarehouseOption {
  warehouseId: number;
  name: string;
  location: string | null;
  locationType: string;
}

interface WebstoreSettingsClientProps {
  configuredWarehouseId: number | null;
  configuredWarehouseInactive: boolean;
  effectiveWarehouseName: string | null;
  warehouses: WarehouseOption[];
}

export function WebstoreSettingsClient({
  configuredWarehouseId,
  configuredWarehouseInactive,
  effectiveWarehouseName,
  warehouses,
}: WebstoreSettingsClientProps) {
  const router = useRouter();
  // Si el configurado quedó inactivo ya no aparece en el select (solo lista
  // activos); se muestra como "automático" + aviso para forzar re-selección.
  const initialValue =
    configuredWarehouseId != null && !configuredWarehouseInactive
      ? String(configuredWarehouseId)
      : AUTO_VALUE;
  const [selected, setSelected] = useState<string>(initialValue);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isDirty = selected !== initialValue;

  const handleSave = async () => {
    setIsSubmitting(true);
    try {
      const warehouseId = selected === AUTO_VALUE ? null : Number(selected);
      const result = await updateWebstoreWarehouse({ warehouseId });
      if (result.success) {
        const warehouseName = warehouses.find((w) => w.warehouseId === warehouseId)?.name;
        toast.success(
          warehouseId == null
            ? "La tienda usará el almacén automático"
            : `La tienda usará el almacén ${warehouseName ?? ""}`.trim()
        );
        router.refresh();
      } else {
        toast.error(result.error);
      }
    } catch (error) {
      console.error("updateWebstoreWarehouse:", error);
      toast.error("Error al guardar la configuración de la tienda");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        icon={Settings2}
        title="Configuración de la tienda"
        description="Define qué almacén alimenta el catálogo y despacha los pedidos de la tienda en línea."
      />

      <div className="rounded-xl border border-border bg-card shadow-panel p-5 space-y-5">
        {configuredWarehouseInactive && (
          <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400">
            <TriangleAlert className="h-4 w-4 shrink-0 mt-0.5" />
            <p>
              El almacén configurado está inactivo, así que la tienda está usando el almacén
              automático. Selecciona uno activo y guarda.
            </p>
          </div>
        )}

        <Field
          label="Almacén de la tienda"
          icon={Warehouse}
          hint="El catálogo público muestra el stock de este almacén y los pedidos en línea descuentan de él."
        >
          <Select value={selected} onValueChange={setSelected}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={AUTO_VALUE}>
                <div className="flex flex-col items-start">
                  <span>Automático</span>
                  <span className="text-xs text-muted-foreground">
                    Primer almacén activo del sistema
                  </span>
                </div>
              </SelectItem>
              {warehouses.map((w) => (
                <SelectItem key={w.warehouseId} value={String(w.warehouseId)}>
                  <div className="flex flex-col items-start">
                    <span>{w.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {[LOCATION_TYPE_LABELS[w.locationType] ?? w.locationType, w.location]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        {selected === AUTO_VALUE && effectiveWarehouseName && (
          <div className="flex items-start gap-2.5 rounded-lg border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
            <Info className="h-4 w-4 shrink-0 mt-0.5" />
            <p>
              Con la opción automática, la tienda está usando actualmente{" "}
              <span className="font-medium text-foreground">{effectiveWarehouseName}</span>. Si se
              crean o desactivan almacenes, este puede cambiar — fija uno para evitarlo.
            </p>
          </div>
        )}

        <div className="flex justify-end border-t border-border pt-4">
          <Button
            variant="brand"
            onClick={handleSave}
            disabled={!isDirty || isSubmitting}
            className="w-full sm:w-auto"
          >
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {isSubmitting ? "Guardando…" : "Guardar cambios"}
          </Button>
        </div>
      </div>
    </div>
  );
}
