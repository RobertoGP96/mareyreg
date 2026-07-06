"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Scale, Plus, Trash2, Loader2 } from "lucide-react";
import { toast } from "@/lib/toast";
import {
  registerInitialPieces,
  getPieceReconciliationAction,
} from "../actions/piece-actions";
import type { PieceReconciliationRow } from "../queries/piece-queries";

interface ProductItem {
  productId: number;
  name: string;
  unit: string;
  presentations: {
    presentationId: number;
    name: string;
    piecesPerUnit: number | null;
  }[];
}

interface WarehouseItem {
  warehouseId: number;
  name: string;
}

interface Props {
  products: ProductItem[];
  warehouses: WarehouseItem[];
}

interface PieceRow {
  weight: string;
  label: string;
}

export function PieceRegistrationClient({ products, warehouses }: Props) {
  const router = useRouter();
  const [productId, setProductId] = useState<string>("");
  const [warehouseId, setWarehouseId] = useState<string>("");
  const [presentationId, setPresentationId] = useState<string>("piece");
  const [rows, setRows] = useState<PieceRow[]>([{ weight: "", label: "" }]);
  const [reconciliation, setReconciliation] = useState<PieceReconciliationRow[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedProduct = useMemo(
    () => products.find((p) => String(p.productId) === productId) ?? null,
    [products, productId]
  );

  // Presentaciones con piezas agrupadas (Caja de N pzas): registrar el pesaje
  // de la caja completa crea una pieza con pieceCount = piecesPerUnit.
  const groupedPresentations = useMemo(
    () =>
      selectedProduct?.presentations.filter(
        (pr) => pr.piecesPerUnit != null && pr.piecesPerUnit > 1
      ) ?? [],
    [selectedProduct]
  );

  const activePresentation = useMemo(() => {
    if (presentationId === "piece") return null;
    return (
      groupedPresentations.find((pr) => String(pr.presentationId) === presentationId) ?? null
    );
  }, [groupedPresentations, presentationId]);

  const pieceCountEach = activePresentation?.piecesPerUnit ?? 1;

  const loadReconciliation = useCallback(async () => {
    if (!productId) {
      setReconciliation([]);
      return;
    }
    const result = await getPieceReconciliationAction(Number(productId));
    if (result.success) setReconciliation(result.data.rows);
    else toast.error(result.error);
  }, [productId]);

  useEffect(() => {
    void loadReconciliation();
  }, [loadReconciliation]);

  const selectedReconciliation = useMemo(
    () =>
      reconciliation.find((r) => String(r.warehouseId) === warehouseId) ?? null,
    [reconciliation, warehouseId]
  );

  const totalNewKg = rows.reduce((s, r) => s + (Number(r.weight) || 0), 0);
  const totalNewPieces = rows.filter((r) => Number(r.weight) > 0).length * pieceCountEach;

  const updateRow = (index: number, patch: Partial<PieceRow>) => {
    setRows(rows.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  };

  const handleSubmit = async () => {
    if (!productId || !warehouseId) {
      toast.error("Selecciona producto y almacén");
      return;
    }
    const validRows = rows.filter((r) => Number(r.weight) > 0);
    if (!validRows.length) {
      toast.error("Captura al menos un pesaje mayor a 0");
      return;
    }
    if (rows.some((r) => r.weight !== "" && !(Number(r.weight) > 0))) {
      toast.error("Cada peso debe ser mayor a 0");
      return;
    }
    setIsSubmitting(true);
    try {
      const result = await registerInitialPieces({
        productId: Number(productId),
        warehouseId: Number(warehouseId),
        pieces: validRows.map((r) => ({
          weightKg: Number(r.weight),
          pieceCount: pieceCountEach,
          presentationId: activePresentation?.presentationId,
          label: r.label.trim() || undefined,
        })),
      });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(`${result.data.created} pesajes registrados`);
      setRows([{ weight: "", label: "" }]);
      await loadReconciliation();
      router.refresh();
    } catch {
      toast.error("No se pudieron registrar los pesajes. Intenta de nuevo.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Alta de pesajes"
        description="Registra el peso individual de piezas que ya están en stock (quesos, cajas pesadas) para venderlas y moverlas por pieza."
        badge="Peso variable"
      />

      {products.length === 0 ? (
        <EmptyState
          title="Sin productos de peso variable"
          description="Marca productos como catch weight en Inventario → Productos para registrar sus pesajes."
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 rounded-xl border border-border bg-card shadow-panel p-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Producto</Label>
                <Select
                  value={productId}
                  onValueChange={(v) => {
                    setProductId(v);
                    setPresentationId("piece");
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Seleccionar..." />
                  </SelectTrigger>
                  <SelectContent>
                    {products.map((p) => (
                      <SelectItem key={p.productId} value={String(p.productId)}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Almacén</Label>
                <Select value={warehouseId} onValueChange={setWarehouseId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Seleccionar..." />
                  </SelectTrigger>
                  <SelectContent>
                    {warehouses.map((w) => (
                      <SelectItem key={w.warehouseId} value={String(w.warehouseId)}>
                        {w.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {groupedPresentations.length > 0 && (
              <div className="space-y-1.5">
                <Label className="text-xs">Cada pesaje corresponde a</Label>
                <Select value={presentationId} onValueChange={setPresentationId}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="piece">Pieza suelta (1 pza)</SelectItem>
                    {groupedPresentations.map((pr) => (
                      <SelectItem key={pr.presentationId} value={String(pr.presentationId)}>
                        {pr.name} completa ({pr.piecesPerUnit} pzas)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-xs">Pesajes (kg)</Label>
              <div className="space-y-1.5">
                {rows.map((row, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground w-8 shrink-0 tabular-nums">
                      {idx + 1}
                    </span>
                    <Input
                      type="number"
                      step="0.001"
                      min="0"
                      placeholder="Peso (kg)"
                      className="h-10"
                      value={row.weight}
                      onChange={(e) => updateRow(idx, { weight: e.target.value })}
                    />
                    <Input
                      placeholder="Etiqueta"
                      className="h-10 w-28 shrink-0"
                      value={row.label}
                      onChange={(e) => updateRow(idx, { label: e.target.value })}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      disabled={rows.length === 1}
                      onClick={() => setRows(rows.filter((_, i) => i !== idx))}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setRows([...rows, { weight: "", label: "" }])}
              >
                <Plus className="h-3.5 w-3.5" />
                Agregar pesaje
              </Button>
            </div>

            <div className="flex items-center justify-between border-t border-border pt-4 flex-wrap gap-3">
              <p className="text-sm font-mono tabular-nums">
                Total: {totalNewKg.toFixed(3)} kg · {totalNewPieces} pzas
              </p>
              <Button
                type="button"
                variant="brand"
                disabled={isSubmitting}
                onClick={handleSubmit}
              >
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Scale className="h-4 w-4" />
                )}
                Registrar pesajes
              </Button>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card shadow-panel p-4 space-y-3">
            <h2 className="font-headline text-sm font-semibold text-foreground">
              Cuadre por almacén
            </h2>
            {!productId ? (
              <p className="text-sm text-muted-foreground">
                Selecciona un producto para ver cuánto stock queda sin registrar.
              </p>
            ) : reconciliation.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin stock registrado.</p>
            ) : (
              <div className="space-y-3">
                {reconciliation.map((r) => (
                  <div
                    key={r.warehouseId}
                    className={`rounded-lg border p-3 space-y-1 ${
                      String(r.warehouseId) === warehouseId
                        ? "border-[var(--brand)]/50 bg-[var(--brand)]/[0.04]"
                        : "border-border"
                    }`}
                  >
                    <p className="text-sm font-medium">{r.warehouseName}</p>
                    <p className="text-xs text-muted-foreground font-mono tabular-nums">
                      Stock: {r.currentKg.toFixed(3)} kg · {r.currentPieces} pzas
                    </p>
                    <p className="text-xs text-muted-foreground font-mono tabular-nums">
                      Registrado: {r.registeredKg.toFixed(3)} kg · {r.registeredPieces} pzas
                    </p>
                    <p
                      className={`text-xs font-mono tabular-nums font-medium ${
                        r.remainingKg < -0.001 || r.remainingPieces < 0
                          ? "text-[var(--ops-critical)]"
                          : "text-foreground"
                      }`}
                    >
                      Sin registrar: {r.remainingKg.toFixed(3)} kg · {r.remainingPieces} pzas
                    </p>
                  </div>
                ))}
              </div>
            )}
            {selectedReconciliation && totalNewKg > 0 && (
              <p
                className={`text-xs ${
                  totalNewKg > selectedReconciliation.remainingKg + 0.001 ||
                  totalNewPieces > selectedReconciliation.remainingPieces
                    ? "text-[var(--ops-critical)]"
                    : "text-muted-foreground"
                }`}
              >
                {totalNewKg > selectedReconciliation.remainingKg + 0.001 ||
                totalNewPieces > selectedReconciliation.remainingPieces
                  ? "Los pesajes capturados exceden el stock sin registrar de este almacén."
                  : "Los pesajes caben en el stock sin registrar de este almacén."}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
