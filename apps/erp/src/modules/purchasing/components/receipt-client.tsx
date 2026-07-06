"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, PackageCheck } from "lucide-react";
import { toast } from "@/lib/toast";
import { ToastDetail, ToastLines } from "@/components/ui/toast-content";
import { formatEquivalence, piecesFor } from "@/modules/inventory/lib/units";
import {
  createGoodsReceipt,
  type ReceiptLineInput,
} from "../actions/goods-receipt-actions";

interface POLine {
  lineId: number;
  quantity: unknown;
  receivedQty: unknown;
  unitCost: unknown;
  unitFactor: unknown;
  presentation: { presentationId: number; name: string; piecesPerUnit: number | null } | null;
  product: { productId: number; name: string; unit: string; tracksLots: boolean; isCatchWeight: boolean };
}

interface Props {
  poId: number;
  folio: string;
  lines: POLine[];
  pendingRate: { code: string; rate: number } | null;
}

export function ReceiptClient({ poId, folio, lines, pendingRate }: Props) {
  const router = useRouter();
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [rows, setRows] = useState<Record<number, ReceiptLineInput>>(
    Object.fromEntries(
      lines.map((l) => [
        l.lineId,
        {
          poLineId: l.lineId,
          quantity: 0,
          unitCost: Number(l.unitCost),
          lotCode: "",
          expirationDate: "",
          manufactureDate: "",
        },
      ])
    )
  );
  // Pesos por pieza (kg) capturados en báscula, por línea de OC — solo
  // productos catch-weight. Se arma como array plano al enviar.
  const [pieceWeightsByLine, setPieceWeightsByLine] = useState<Record<number, string[]>>({});
  // Modo de pesaje por línea: "piece" = un peso por pieza suelta (default),
  // "unit" = cada caja/presentación se pesa completa (caso lomos por caja).
  const [weighingModeByLine, setWeighingModeByLine] = useState<Record<number, "piece" | "unit">>({});
  // Etiqueta física opcional por pesaje, alineada con pieceWeightsByLine.
  const [pieceLabelsByLine, setPieceLabelsByLine] = useState<Record<number, string[]>>({});

  const update = (lineId: number, patch: Partial<ReceiptLineInput>) => {
    setRows({ ...rows, [lineId]: { ...rows[lineId], ...patch } });
  };

  const updatePieceWeight = (lineId: number, index: number, value: string) => {
    const current = pieceWeightsByLine[lineId] ?? [];
    const next = [...current];
    next[index] = value;
    setPieceWeightsByLine({ ...pieceWeightsByLine, [lineId]: next });
  };

  const updatePieceLabel = (lineId: number, index: number, value: string) => {
    const current = pieceLabelsByLine[lineId] ?? [];
    const next = [...current];
    next[index] = value;
    setPieceLabelsByLine({ ...pieceLabelsByLine, [lineId]: next });
  };

  const expectedWeightsFor = (lineId: number, quantity: number, piecesPerUnit: number) => {
    const mode = weighingModeByLine[lineId] ?? "piece";
    return mode === "unit" ? quantity : piecesFor(quantity, piecesPerUnit);
  };

  const handleSubmit = async () => {
    const payload = Object.values(rows)
      .filter((r) => r.quantity > 0)
      .map((r) => {
        const line = lines.find((l) => l.lineId === r.poLineId);
        if (!line?.product.isCatchWeight) return r;
        const piecesPerUnit = line.presentation?.piecesPerUnit ?? 1;
        // Recorta al conteo esperado: si se capturaron pesos en un modo y se
        // cambió al otro, los sobrantes no deben viajar al servidor.
        const expected = expectedWeightsFor(r.poLineId, r.quantity, piecesPerUnit);
        const weights = (pieceWeightsByLine[r.poLineId] ?? []).slice(0, expected).map(Number);
        const labels = pieceLabelsByLine[r.poLineId] ?? [];
        return {
          ...r,
          pieceWeights: weights,
          weighingMode: weighingModeByLine[r.poLineId] ?? "piece",
          pieceLabels: weights.map((_, i) => labels[i]?.trim() || null),
        };
      });
    if (!payload.length) {
      toast.error("Indica al menos una cantidad a recibir");
      return;
    }
    const catchWeightMissing = payload.find((r) => {
      const line = lines.find((l) => l.lineId === r.poLineId);
      if (!line?.product.isCatchWeight) return false;
      const piecesPerUnit = line.presentation?.piecesPerUnit ?? 1;
      const expected = expectedWeightsFor(r.poLineId, r.quantity, piecesPerUnit);
      return !r.pieceWeights || r.pieceWeights.length !== expected || r.pieceWeights.some((w) => !(w > 0));
    });
    if (catchWeightMissing) {
      toast.error("Captura el peso de cada pieza (mayor a 0) para los productos de peso variable");
      return;
    }
    setIsSubmitting(true);
    const result = await createGoodsReceipt({
      poId,
      notes: notes || undefined,
      lines: payload,
    });
    setIsSubmitting(false);
    if (result.success) {
      const totalUnits = payload.reduce((s, l) => s + l.quantity, 0);
      toast.success(`Recepcion ${result.data.folio} registrada`, {
        description: (
          <ToastLines>
            <ToastDetail
              label={`${payload.length} ${payload.length === 1 ? "linea" : "lineas"}`}
              value={`${totalUnits} u.`}
              mono
            />
          </ToastLines>
        ),
      });
      router.push(`/purchase-orders/${poId}`);
      router.refresh();
    } else toast.error(result.error);
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Recepcion de OC {folio}</h1>
        <p className="text-muted-foreground mt-1">
          Indica las cantidades recibidas y los datos de lote si aplica
        </p>
        {pendingRate && (
          Number.isNaN(pendingRate.rate) ? (
            <p className="text-sm text-destructive mt-2">
              No hay tasa de cambio configurada para {pendingRate.code}. Configúrala en Divisas → Tasa de cambio.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground mt-2 font-mono tabular-nums">
              Se valuará a la tasa vigente: 1 {pendingRate.code} = {pendingRate.rate.toFixed(2)} CUP
            </p>
          )
        )}
      </div>

      <div className="bg-card border rounded-lg p-4 space-y-3">
        {lines.map((l) => {
          const pending = Number(l.quantity) - Number(l.receivedQty);
          const row = rows[l.lineId];
          const factor = Number(l.unitFactor);
          const presentationName = l.presentation?.name ?? l.product.unit;
          const currencySuffix = pendingRate ? ` (${pendingRate.code})` : "";
          const isCatchWeight = l.product.isCatchWeight;
          const piecesPerUnit = l.presentation?.piecesPerUnit ?? 1;
          const costLabel = isCatchWeight
            ? `Costo ($/kg)${currencySuffix}`
            : (factor !== 1 ? `Costo por ${presentationName}` : "Costo unit.") + currencySuffix;
          const weighingMode = weighingModeByLine[l.lineId] ?? "piece";
          const expectedWeights =
            isCatchWeight && row.quantity > 0
              ? expectedWeightsFor(l.lineId, row.quantity, piecesPerUnit)
              : 0;
          const weights = pieceWeightsByLine[l.lineId] ?? [];
          const labels = pieceLabelsByLine[l.lineId] ?? [];
          const totalWeightKg = weights
            .slice(0, expectedWeights)
            .reduce((s, w) => s + (Number(w) || 0), 0);
          const weightRowLabel = weighingMode === "unit" ? presentationName : "Pieza";
          return (
            <div key={l.lineId} className="border rounded p-3 grid grid-cols-12 gap-2 items-end">
              <div className="col-span-12 sm:col-span-4">
                <p className="font-medium">{l.product.name}</p>
                <p className="text-xs text-muted-foreground">
                  Pendiente: {pending} {presentationName}
                </p>
              </div>
              <div className="col-span-6 sm:col-span-2 space-y-1">
                <Label className="text-xs">Cantidad ({presentationName})</Label>
                <Input
                  type="number"
                  min="0"
                  max={pending}
                  step={isCatchWeight ? "1" : "0.01"}
                  value={row.quantity || ""}
                  onChange={(e) => update(l.lineId, { quantity: Number(e.target.value) })}
                />
              </div>
              <div className="col-span-6 sm:col-span-2 space-y-1">
                <Label className="text-xs">{costLabel}</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={row.unitCost ?? ""}
                  onChange={(e) => update(l.lineId, { unitCost: Number(e.target.value) })}
                />
              </div>
              {l.product.tracksLots && (
                <>
                  <div className="col-span-6 sm:col-span-2 space-y-1">
                    <Label className="text-xs">Lote</Label>
                    <Input
                      value={row.lotCode ?? ""}
                      onChange={(e) => update(l.lineId, { lotCode: e.target.value })}
                    />
                  </div>
                  <div className="col-span-6 sm:col-span-2 space-y-1">
                    <Label className="text-xs">Vence</Label>
                    <Input
                      type="date"
                      value={row.expirationDate ?? ""}
                      onChange={(e) => update(l.lineId, { expirationDate: e.target.value })}
                    />
                  </div>
                </>
              )}
              {!isCatchWeight && factor !== 1 && row.quantity > 0 && (
                <div className="col-span-12 -mt-1">
                  <p className="text-xs text-muted-foreground">
                    {formatEquivalence(row.quantity, factor, presentationName, l.product.unit)}
                  </p>
                </div>
              )}
              {isCatchWeight && expectedWeights > 0 && (
                <div className="col-span-12 space-y-2 border-t pt-2 mt-1">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <p className="text-xs font-medium">
                      {weighingMode === "unit"
                        ? `Peso por ${presentationName} (kg)`
                        : "Peso por pieza (kg)"}
                    </p>
                    {piecesPerUnit > 1 && (
                      <div className="flex rounded-md border overflow-hidden">
                        <button
                          type="button"
                          className={`px-3 h-9 text-xs ${weighingMode === "piece" ? "bg-secondary font-medium" : "text-muted-foreground"}`}
                          onClick={() =>
                            setWeighingModeByLine({ ...weighingModeByLine, [l.lineId]: "piece" })
                          }
                        >
                          Por pieza
                        </button>
                        <button
                          type="button"
                          className={`px-3 h-9 text-xs border-l ${weighingMode === "unit" ? "bg-secondary font-medium" : "text-muted-foreground"}`}
                          onClick={() =>
                            setWeighingModeByLine({ ...weighingModeByLine, [l.lineId]: "unit" })
                          }
                        >
                          Por {presentationName}
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    {Array.from({ length: expectedWeights }, (_, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <Label className="text-xs w-20 shrink-0">
                          {weightRowLabel} {idx + 1}
                        </Label>
                        <Input
                          type="number"
                          step="0.001"
                          min="0"
                          className="h-9"
                          value={weights[idx] ?? ""}
                          onChange={(e) => updatePieceWeight(l.lineId, idx, e.target.value)}
                        />
                        <Input
                          className="h-9 w-24 shrink-0"
                          placeholder="Etiqueta"
                          value={labels[idx] ?? ""}
                          onChange={(e) => updatePieceLabel(l.lineId, idx, e.target.value)}
                        />
                      </div>
                    ))}
                  </div>
                  <p className="text-sm font-mono tabular-nums">
                    Total: {totalWeightKg.toFixed(3)} kg
                  </p>
                </div>
              )}
            </div>
          );
        })}

        <div className="space-y-2">
          <Label>Notas</Label>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
        </div>

        <Button className="w-full" onClick={handleSubmit} disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <PackageCheck className="w-4 h-4 mr-2" />}
          Registrar recepcion
        </Button>
      </div>
    </div>
  );
}
