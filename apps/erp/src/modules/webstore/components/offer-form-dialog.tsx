"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "@/lib/toast";
import { ResponsiveFormDialog } from "@/components/ui/responsive-form-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Field } from "@/components/ui/field";
import { FormSection } from "@/components/ui/form-section";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BadgePercent, Search, Loader2, AlertTriangle } from "lucide-react";
import { formatAmount } from "@/lib/format";
import { createOffer, updateOffer } from "@/modules/webstore/actions/offer-actions";
import type { OfferRow, WebstoreProductPickerRow } from "@/modules/webstore/queries/offer-queries";

interface Props {
  open: boolean;
  offer: OfferRow | null;
  products: WebstoreProductPickerRow[];
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

const toDateInputValue = (value: string | null) => (value ? value.slice(0, 10) : "");

function resultingPrice(currentPrice: number, type: string, value: number): number {
  if (type === "fixed") return Math.max(0, currentPrice - Math.min(value, currentPrice));
  return Math.max(0, currentPrice - currentPrice * (value / 100));
}

export function OfferFormDialog({ open, offer, products, onOpenChange, onSaved }: Props) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<"percent" | "fixed">("percent");
  const [value, setValue] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [search, setSearch] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (offer) {
      setName(offer.name);
      setDescription(offer.description ?? "");
      setType(offer.type === "fixed" ? "fixed" : "percent");
      setValue(offer.value);
      setStartsAt(toDateInputValue(offer.startsAt));
      setEndsAt(toDateInputValue(offer.endsAt));
      setSelectedIds(new Set(offer.products.map((p) => p.productId)));
    } else {
      setName("");
      setDescription("");
      setType("percent");
      setValue("");
      setStartsAt("");
      setEndsAt("");
      setSelectedIds(new Set());
    }
    setSearch("");
  }, [open, offer]);

  const filteredProducts = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return products;
    return products.filter(
      (p) => p.name.toLowerCase().includes(term) || (p.sku?.toLowerCase().includes(term) ?? false)
    );
  }, [products, search]);

  const toggleProduct = (productId: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(productId)) next.delete(productId);
      else next.add(productId);
      return next;
    });
  };

  const numericValue = Number(value);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (selectedIds.size === 0) {
      toast.error("Selecciona al menos un producto");
      return;
    }
    if (!Number.isFinite(numericValue) || numericValue <= 0) {
      toast.error("Ingresa un valor válido");
      return;
    }

    const input = {
      name,
      description: description || undefined,
      type,
      value: numericValue,
      startsAt: startsAt || undefined,
      endsAt: endsAt || undefined,
      productIds: Array.from(selectedIds),
      ...(offer ? { version: offer.version } : {}),
    };

    setIsSubmitting(true);
    try {
      const res = offer ? await updateOffer(offer.offerId, input) : await createOffer(input);
      if (res.success) {
        toast.success(offer ? "Oferta actualizada" : "Oferta creada");
        onSaved();
      } else {
        toast.error(res.error);
      }
    } catch {
      toast.error(offer ? "No se pudo actualizar la oferta." : "No se pudo crear la oferta.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ResponsiveFormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={offer ? "Editar oferta" : "Nueva oferta"}
      description="Agrupa productos con un descuento y vigencia compartida."
      showHeader
      desktopMaxWidth="sm:max-w-3xl"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <FormSection icon={BadgePercent} title="Datos de la oferta">
          <Field label="Nombre" required>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="Ej. Rebajas de temporada"
            />
          </Field>
          <Field label="Descripción" hint="Opcional. Visible internamente.">
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="—"
            />
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Tipo" required>
              <Select value={type} onValueChange={(v) => setType(v as "percent" | "fixed")}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="percent">Porcentaje</SelectItem>
                  <SelectItem value="fixed">Monto fijo</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field
              label="Valor"
              required
              hint={type === "percent" ? "Porcentaje entre 0 y 100." : "Monto fijo a descontar."}
            >
              <Input
                type="number"
                step="0.01"
                min="0"
                max={type === "percent" ? 100 : undefined}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                required
              />
            </Field>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Desde">
              <Input type="date" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
            </Field>
            <Field label="Hasta">
              <Input type="date" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
            </Field>
          </div>
        </FormSection>

        <FormSection
          icon={Search}
          title="Productos"
          description={`${selectedIds.size} producto(s) seleccionado(s)`}
        >
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre o SKU…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>
          <div className="max-h-[40vh] overflow-y-auto space-y-1.5 rounded-lg border border-border p-2">
            {filteredProducts.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">Sin productos.</p>
            ) : (
              filteredProducts.map((p) => {
                const checked = selectedIds.has(p.productId);
                const hasValidValue = Number.isFinite(numericValue) && numericValue > 0;
                const preview = hasValidValue
                  ? resultingPrice(p.currentPrice, type, numericValue)
                  : null;
                return (
                  <label
                    key={p.productId}
                    className="flex items-center gap-3 rounded-lg p-2 hover:bg-muted/40 cursor-pointer"
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() => toggleProduct(p.productId)}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-sm font-medium text-foreground truncate">{p.name}</span>
                        {p.hasManualDiscount && (
                          <Badge variant="warning" className="gap-1 text-[10px]">
                            <AlertTriangle className="h-3 w-3" />
                            Descuento manual se desactivará
                          </Badge>
                        )}
                      </div>
                      {p.sku && <div className="text-xs text-muted-foreground">{p.sku}</div>}
                    </div>
                    <div className="text-right shrink-0 text-xs">
                      <div className="font-mono tabular-nums text-muted-foreground line-through">
                        {formatAmount(p.currentPrice)}
                      </div>
                      {preview != null && (
                        <div className="font-mono tabular-nums text-[var(--success)] font-semibold">
                          {formatAmount(preview)}
                        </div>
                      )}
                    </div>
                  </label>
                );
              })
            )}
          </div>
        </FormSection>

        <div className="flex justify-end gap-2 pt-3 border-t border-border">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="submit" variant="brand" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {isSubmitting ? "Guardando…" : offer ? "Guardar cambios" : "Crear oferta"}
          </Button>
        </div>
      </form>
    </ResponsiveFormDialog>
  );
}
