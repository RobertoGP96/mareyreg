"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, PackageCheck } from "lucide-react";
import { toast } from "sonner";
import {
  createGoodsReceipt,
  type ReceiptLineInput,
} from "../actions/goods-receipt-actions";

interface POLine {
  lineId: number;
  quantity: unknown;
  receivedQty: unknown;
  unitCost: unknown;
  product: { productId: number; name: string; unit: string; tracksLots: boolean };
}

interface Props {
  poId: number;
  folio: string;
  lines: POLine[];
}

export function ReceiptClient({ poId, folio, lines }: Props) {
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

  const update = (lineId: number, patch: Partial<ReceiptLineInput>) => {
    setRows({ ...rows, [lineId]: { ...rows[lineId], ...patch } });
  };

  const handleSubmit = async () => {
    const payload = Object.values(rows).filter((r) => r.quantity > 0);
    if (!payload.length) {
      toast.error("Indica al menos una cantidad a recibir");
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
      toast.success(`Recepcion ${result.data.folio} registrada`);
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
      </div>

      <div className="bg-card border rounded-lg p-4 space-y-3">
        {lines.map((l) => {
          const pending = Number(l.quantity) - Number(l.receivedQty);
          const row = rows[l.lineId];
          return (
            <div key={l.lineId} className="border rounded p-3 grid grid-cols-12 gap-2 items-end">
              <div className="col-span-12 sm:col-span-4">
                <p className="font-medium">{l.product.name}</p>
                <p className="text-xs text-muted-foreground">
                  Pendiente: {pending} {l.product.unit}
                </p>
              </div>
              <div className="col-span-6 sm:col-span-2 space-y-1">
                <Label className="text-xs">Cantidad</Label>
                <Input
                  type="number"
                  min="0"
                  max={pending}
                  step="0.01"
                  value={row.quantity || ""}
                  onChange={(e) => update(l.lineId, { quantity: Number(e.target.value) })}
                />
              </div>
              <div className="col-span-6 sm:col-span-2 space-y-1">
                <Label className="text-xs">Costo unit.</Label>
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
