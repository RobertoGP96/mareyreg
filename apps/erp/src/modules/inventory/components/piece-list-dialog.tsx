"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusPill, type OpsStatus } from "@/components/ui/status-pill";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Dialog,
  DialogContent,
  DialogHeader,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FormDialogHeader } from "@/components/ui/field";
import { Scale, ArrowLeftRight, Trash2, Loader2 } from "lucide-react";
import { toast } from "@/lib/toast";
import {
  getProductPiecesAction,
  transferPieces,
  disposePiece,
  reweighPiece,
} from "../actions/piece-actions";
import type { ProductPieceRow } from "../queries/piece-queries";

interface WarehouseItem {
  warehouseId: number;
  name: string;
}

interface Props {
  productId: number | null;
  productName: string;
  warehouses: WarehouseItem[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type PieceAction =
  | { type: "transfer"; piece: ProductPieceRow }
  | { type: "reweigh"; piece: ProductPieceRow }
  | { type: "dispose"; piece: ProductPieceRow }
  | null;

const PIECE_STATUS_PILL: Record<string, { status: OpsStatus; label: string }> = {
  available: { status: "available", label: "Disponible" },
  reserved: { status: "pending", label: "Reservada" },
  sold: { status: "completed", label: "Vendida" },
  disposed: { status: "cancelled", label: "Baja" },
};

export function PieceListDialog({
  productId,
  productName,
  warehouses,
  open,
  onOpenChange,
}: Props) {
  const router = useRouter();
  const [pieces, setPieces] = useState<ProductPieceRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [action, setAction] = useState<PieceAction>(null);
  const [targetWarehouseId, setTargetWarehouseId] = useState<string>("");
  const [newWeight, setNewWeight] = useState("");
  const [disposeReason, setDisposeReason] = useState("");

  const loadPieces = useCallback(async () => {
    if (productId == null) return;
    setIsLoading(true);
    try {
      const result = await getProductPiecesAction(productId);
      if (result.success) setPieces(result.data.pieces);
      else toast.error(result.error);
    } catch {
      toast.error("Error al cargar los pesajes");
    } finally {
      setIsLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    if (open && productId != null) {
      setAction(null);
      void loadPieces();
    }
  }, [open, productId, loadPieces]);

  const resetActionState = () => {
    setAction(null);
    setTargetWarehouseId("");
    setNewWeight("");
    setDisposeReason("");
  };

  const handleSubmitAction = async () => {
    if (!action) return;
    setIsSubmitting(true);
    try {
      if (action.type === "transfer") {
        if (!targetWarehouseId) {
          toast.error("Selecciona el almacén destino");
          return;
        }
        const result = await transferPieces({
          pieceIds: [action.piece.pieceId],
          warehouseIdTo: Number(targetWarehouseId),
        });
        if (!result.success) {
          toast.error(result.error);
          return;
        }
        toast.success("Pieza transferida");
      } else if (action.type === "reweigh") {
        const weight = Number(newWeight);
        if (!(weight > 0)) {
          toast.error("Captura el nuevo peso (mayor a 0)");
          return;
        }
        const result = await reweighPiece({
          pieceId: action.piece.pieceId,
          newWeightKg: weight,
          version: action.piece.version,
        });
        if (!result.success) {
          toast.error(result.error);
          return;
        }
        toast.success("Peso actualizado");
      } else {
        if (!disposeReason.trim()) {
          toast.error("Indica el motivo de la baja");
          return;
        }
        const result = await disposePiece({
          pieceId: action.piece.pieceId,
          reason: disposeReason,
        });
        if (!result.success) {
          toast.error(result.error);
          return;
        }
        toast.success("Pieza dada de baja");
      }
      resetActionState();
      await loadPieces();
      router.refresh();
    } catch {
      toast.error("No se pudo completar la operación. Intenta de nuevo.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const availableTargets = action?.type === "transfer"
    ? warehouses.filter((w) => w.warehouseId !== action.piece.warehouseId)
    : warehouses;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) resetActionState();
      }}
    >
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <FormDialogHeader
            icon={Scale}
            title={`Pesajes de ${productName}`}
            description="Piezas registradas con su peso real. Transfiere, re-pesa o da de baja piezas disponibles."
          />
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : pieces.length === 0 ? (
          <EmptyState
            title="Sin pesajes registrados"
            description="Registra piezas al recibir compras o con el alta inicial en Stock → Pesajes."
          />
        ) : (
          <div className="divide-y divide-border/60 rounded-lg border border-border overflow-hidden">
            {pieces.map((p) => {
              const pill = PIECE_STATUS_PILL[p.status] ?? PIECE_STATUS_PILL.available;
              const isSelected = action?.piece.pieceId === p.pieceId;
              return (
                <div
                  key={p.pieceId}
                  className={`px-3 py-2.5 ${isSelected ? "bg-[var(--brand)]/[0.05]" : ""}`}
                >
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="font-mono tabular-nums font-semibold text-foreground min-w-20">
                      {p.weightKg.toFixed(3)} kg
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {p.label ?? `#${p.pieceId}`}
                      {p.pieceCount > 1 && ` · ${p.pieceCount} pzas`}
                      {p.presentationName && ` · ${p.presentationName}`}
                    </span>
                    <span className="text-xs text-muted-foreground">{p.warehouseName}</span>
                    <StatusPill status={pill.status} label={pill.label} size="sm" />
                    {p.status === "available" && (
                      <span className="ml-auto flex gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          title="Transferir"
                          onClick={() => {
                            setAction({ type: "transfer", piece: p });
                            setTargetWarehouseId("");
                          }}
                        >
                          <ArrowLeftRight className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          title="Re-pesar"
                          onClick={() => {
                            setAction({ type: "reweigh", piece: p });
                            setNewWeight(String(p.weightKg));
                          }}
                        >
                          <Scale className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          title="Dar de baja"
                          onClick={() => {
                            setAction({ type: "dispose", piece: p });
                            setDisposeReason("");
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-[var(--ops-critical)]" />
                        </Button>
                      </span>
                    )}
                  </div>
                  {p.status === "disposed" && p.disposedReason && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Baja: {p.disposedReason}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {action && (
          <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
            <p className="text-sm font-medium">
              {action.type === "transfer" && `Transferir pieza ${action.piece.label ?? `#${action.piece.pieceId}`}`}
              {action.type === "reweigh" && `Re-pesar pieza ${action.piece.label ?? `#${action.piece.pieceId}`} (actual: ${action.piece.weightKg.toFixed(3)} kg)`}
              {action.type === "dispose" && `Dar de baja pieza ${action.piece.label ?? `#${action.piece.pieceId}`} (${action.piece.weightKg.toFixed(3)} kg)`}
            </p>
            {action.type === "transfer" && (
              <div className="space-y-1.5">
                <Label className="text-xs">Almacén destino</Label>
                <Select value={targetWarehouseId} onValueChange={setTargetWarehouseId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Seleccionar..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableTargets.map((w) => (
                      <SelectItem key={w.warehouseId} value={String(w.warehouseId)}>
                        {w.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {action.type === "reweigh" && (
              <div className="space-y-1.5">
                <Label className="text-xs">Nuevo peso (kg)</Label>
                <Input
                  type="number"
                  step="0.001"
                  min="0"
                  value={newWeight}
                  onChange={(e) => setNewWeight(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  La diferencia se registra como ajuste solo de peso en el kardex (las piezas
                  no cambian).
                </p>
              </div>
            )}
            {action.type === "dispose" && (
              <div className="space-y-1.5">
                <Label className="text-xs">Motivo</Label>
                <Input
                  placeholder="Dañada, caducada…"
                  value={disposeReason}
                  onChange={(e) => setDisposeReason(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Descuenta el peso y las piezas exactas de la pieza del stock.
                </p>
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" size="sm" onClick={resetActionState}>
                Cancelar
              </Button>
              <Button
                type="button"
                variant="brand"
                size="sm"
                disabled={isSubmitting}
                onClick={handleSubmitAction}
              >
                {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                Confirmar
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
