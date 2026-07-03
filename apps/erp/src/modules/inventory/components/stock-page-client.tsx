"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { KpiCard } from "@/components/ui/kpi-card";
import { MetricTile } from "@/components/ui/metric-tile";
import { StatusPill } from "@/components/ui/status-pill";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import {
  Dialog,
  DialogContent,
  DialogHeader,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Field, FormDialogHeader } from "@/components/ui/field";
import { FormSection } from "@/components/ui/form-section";
import {
  Plus,
  Search,
  PackageOpen,
  Warehouse as WarehouseIcon,
  ArrowDownToLine,
  ArrowUpFromLine,
  ArrowLeftRight,
  Wrench,
  CircleDollarSign,
  Package,
  AlertTriangle,
  Loader2,
  FileText,
  StickyNote,
} from "lucide-react";
import { toast } from "@/lib/toast";
import {
  createStockMovement,
  createStockTransfer,
} from "../actions/stock-actions";
import { MOVEMENT_TYPES, getUnitAbbreviation } from "@/lib/constants";
import { formatEquivalence } from "../lib/units";
import { formatAmount } from "@/lib/format";

interface PresentationItem {
  presentationId: number;
  name: string;
  factor: number;
  isBase: boolean;
  piecesPerUnit: number | null;
}

interface StockLevelItem {
  productId: number;
  warehouseId: number;
  currentQuantity: number;
  currentPieces: number;
  product: {
    name: string;
    minStock: number;
    maxStock: number | null;
    unit: string;
    costPrice: number | null;
    isCatchWeight: boolean;
    largestPresentation: { name: string; factor: number; piecesPerUnit: number | null } | null;
  };
  warehouse: { name: string };
}

interface MovementItem {
  movementId: number;
  quantity: number;
  pieces: number | null;
  movementType: string;
  unitCost: number | null;
  origUnitCost: number | null;
  exchangeRate: number | null;
  origCurrency: { code: string; decimalPlaces: number } | null;
  referenceDoc: string | null;
  notes: string | null;
  createdAt: string;
  product: { name: string; unit: string; isCatchWeight: boolean };
  warehouse: { name: string };
}

interface ProductItem {
  productId: number;
  name: string;
  unit: string;
  isCatchWeight: boolean;
  presentations: PresentationItem[];
}

interface WarehouseItem {
  warehouseId: number;
  name: string;
}

interface Props {
  stockLevels: StockLevelItem[];
  movements: MovementItem[];
  products: ProductItem[];
  warehouses: WarehouseItem[];
}

const MOVEMENT_ICON: Record<string, typeof ArrowDownToLine> = {
  entry: ArrowDownToLine,
  exit: ArrowUpFromLine,
  transfer: ArrowLeftRight,
  adjustment: Wrench,
};

const MOVEMENT_BG: Record<string, string> = {
  entry: "bg-[var(--ops-success)]/10 text-[var(--ops-success)]",
  exit: "bg-[var(--ops-critical)]/10 text-[var(--ops-critical)]",
  transfer: "bg-[var(--ops-active)]/10 text-[var(--ops-active)]",
  adjustment: "bg-[var(--ops-warning)]/12 text-[var(--ops-warning)]",
};

function getMovementLabel(type: string) {
  return MOVEMENT_TYPES.find((m) => m.value === type)?.label ?? type;
}

/**
 * Referencia compacta de moneda original de un movimiento, ej.
 * "190 CUP · 0.30 USD @ 635". null si el movimiento no tiene costo o ya
 * estaba en moneda base (origCurrency null).
 */
function formatOrigCostReference(m: MovementItem): string | null {
  if (m.unitCost == null || m.origCurrency == null || m.origUnitCost == null) return null;
  const cupPart = `${formatAmount(m.unitCost, 0)} CUP`;
  const origPart = `${formatAmount(m.origUnitCost, m.origCurrency.decimalPlaces)} ${m.origCurrency.code}`;
  const ratePart = m.exchangeRate != null ? ` @ ${formatAmount(m.exchangeRate, 0)}` : "";
  return `${cupPart} · ${origPart}${ratePart}`;
}

export function StockPageClient({
  stockLevels,
  movements,
  products,
  warehouses,
}: Props) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [warehouseFilter, setWarehouseFilter] = useState<string>("all");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [movementType, setMovementType] = useState<
    "entry" | "exit" | "transfer" | "adjustment"
  >("entry");
  const [adjustmentSign, setAdjustmentSign] = useState<"positive" | "negative">(
    "positive"
  );
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [selectedPresentationId, setSelectedPresentationId] = useState<string>("base");
  const [quantityInput, setQuantityInput] = useState<string>("");
  const [piecesInput, setPiecesInput] = useState<string>("");

  const selectedProduct = useMemo(
    () => products.find((p) => String(p.productId) === selectedProductId) ?? null,
    [products, selectedProductId]
  );

  const nonBasePresentations = useMemo(
    () => selectedProduct?.presentations.filter((pr) => !pr.isBase) ?? [],
    [selectedProduct]
  );

  const showPresentationSelect =
    !!selectedProduct && selectedProduct.presentations.length > 1;

  const activePresentation = useMemo(() => {
    if (selectedPresentationId === "base") return null;
    return (
      selectedProduct?.presentations.find(
        (pr) => String(pr.presentationId) === selectedPresentationId
      ) ?? null
    );
  }, [selectedProduct, selectedPresentationId]);

  const equivalenceText = useMemo(() => {
    if (!activePresentation || !selectedProduct) return null;
    const qty = Number(quantityInput);
    if (!quantityInput || Number.isNaN(qty) || qty <= 0) return null;
    return formatEquivalence(
      qty,
      activePresentation.factor,
      activePresentation.name,
      selectedProduct.unit
    );
  }, [activePresentation, selectedProduct, quantityInput]);

  const resetPresentationState = () => {
    setSelectedProductId("");
    setSelectedPresentationId("base");
    setQuantityInput("");
    setPiecesInput("");
  };

  const summary = useMemo(() => {
    let totalValue = 0;
    let totalQty = 0;
    let lowCount = 0;
    let overCount = 0;
    let outCount = 0;
    for (const sl of stockLevels) {
      const qty = sl.currentQuantity;
      const min = sl.product.minStock;
      const max = sl.product.maxStock;
      const cost = sl.product.costPrice ?? 0;
      totalValue += qty * cost;
      totalQty += qty;
      if (qty <= 0) outCount += 1;
      else if (qty < min) lowCount += 1;
      if (max !== null && qty > max) overCount += 1;
    }
    return { totalValue, totalQty, lowCount, overCount, outCount };
  }, [stockLevels]);

  const filtered = useMemo(() => {
    const term = search.toLowerCase();
    return stockLevels.filter((sl) => {
      if (warehouseFilter !== "all" && String(sl.warehouseId) !== warehouseFilter)
        return false;
      if (!term) return true;
      return (
        sl.product.name.toLowerCase().includes(term) ||
        sl.warehouse.name.toLowerCase().includes(term)
      );
    });
  }, [stockLevels, search, warehouseFilter]);

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    const fd = new FormData(e.currentTarget);

    const productId = Number(fd.get("productId"));
    const quantity = Number(fd.get("quantity"));
    const presentationId = activePresentation ? activePresentation.presentationId : undefined;
    const pieces = selectedProduct?.isCatchWeight
      ? Number(fd.get("pieces"))
      : undefined;

    let result;
    if (movementType === "transfer") {
      const warehouseIdFrom = Number(fd.get("warehouseIdFrom"));
      const warehouseIdTo = Number(fd.get("warehouseIdTo"));
      result = await createStockTransfer({
        productId,
        warehouseIdFrom,
        warehouseIdTo,
        quantity,
        presentationId,
        pieces,
        referenceDoc: (fd.get("referenceDoc") as string) || undefined,
        notes: (fd.get("notes") as string) || undefined,
      });
    } else {
      const warehouseId = Number(fd.get("warehouseId"));
      result = await createStockMovement({
        productId,
        warehouseId,
        quantity,
        presentationId,
        movementType,
        adjustmentSign:
          movementType === "adjustment" ? adjustmentSign : undefined,
        unitCost: fd.get("unitCost") ? Number(fd.get("unitCost")) : undefined,
        pieces,
        referenceDoc: (fd.get("referenceDoc") as string) || undefined,
        notes: (fd.get("notes") as string) || undefined,
      });
    }

    setIsSubmitting(false);
    if (result.success) {
      setIsCreateOpen(false);
      resetPresentationState();
      toast.success("Movimiento registrado");
      router.refresh();
    } else {
      toast.error(result.error);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Stock"
        description="Niveles de stock por producto y almacén con histórico de movimientos."
        badge={`${stockLevels.length} niveles`}
        actions={
          <Button variant="brand" onClick={() => setIsCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            Nuevo movimiento
          </Button>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          label="Valor en stock"
          value={`$${summary.totalValue.toFixed(0)}`}
          icon={CircleDollarSign}
          accent="brand"
        />
        <KpiCard
          label="Unidades totales"
          value={summary.totalQty.toFixed(0)}
          icon={Package}
          accent="info"
        />
        <KpiCard
          label="Alertas bajas"
          value={summary.lowCount}
          icon={AlertTriangle}
          accent={summary.lowCount > 0 ? "warning" : "slate"}
        />
        <KpiCard
          label="Agotados"
          value={summary.outCount}
          icon={PackageOpen}
          accent={summary.outCount > 0 ? "danger" : "slate"}
        />
      </div>

      {/* Stock Levels */}
      <div className="rounded-xl border border-border bg-card shadow-panel overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 border-b border-border bg-muted/30 px-4 py-3">
          <InputGroup className="flex-1 min-w-[240px]">
            <InputGroupAddon>
              <Search />
            </InputGroupAddon>
            <InputGroupInput
              placeholder="Buscar producto o almacén…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <InputGroupAddon align="inline-end">
              <Badge variant="brand">{filtered.length}</Badge>
            </InputGroupAddon>
          </InputGroup>
          <Select value={warehouseFilter} onValueChange={setWarehouseFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los almacenes</SelectItem>
              {warehouses.map((w) => (
                <SelectItem key={w.warehouseId} value={String(w.warehouseId)}>
                  {w.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="divide-y divide-border/60">
          {filtered.length > 0 ? (
            filtered.map((sl) => {
              const qty = sl.currentQuantity;
              const minStock = sl.product.minStock;
              const maxStock = sl.product.maxStock;
              const isOut = qty <= 0;
              const isLow = !isOut && qty < minStock;
              const isOver = maxStock !== null && qty > maxStock;
              const abbr = getUnitAbbreviation(sl.product.unit);
              const cost = sl.product.costPrice ?? 0;
              const value = qty * cost;
              const largest = sl.product.largestPresentation;
              const presentationEquivalence =
                !sl.product.isCatchWeight && largest && largest.factor > 1 && qty >= largest.factor
                  ? `${Math.floor(qty / largest.factor)} ${largest.name}`
                  : null;
              // Catch-weight: piezas fungibles + equivalencia estimada en cajas
              // (piezas / piecesPerUnit) cuando el producto tiene una
              // presentación que agrupa piezas (ej. Caja de 5 pzas).
              const piecesEquivalence =
                sl.product.isCatchWeight && largest?.piecesPerUnit && largest.piecesPerUnit > 1
                  ? `≈${(sl.currentPieces / largest.piecesPerUnit).toFixed(1)} ${largest.name}`
                  : null;

              return (
                <div
                  key={`${sl.productId}-${sl.warehouseId}`}
                  className="group flex items-start gap-4 px-5 py-4 transition-colors hover:bg-[var(--brand)]/[0.04]"
                >
                  <div className="flex size-11 items-center justify-center rounded-lg bg-gradient-to-br from-[var(--brand)]/20 to-[var(--brand)]/5 ring-1 ring-inset ring-[var(--brand)]/20 shrink-0">
                    <Package
                      className="h-5 w-5 text-[var(--brand)]"
                      strokeWidth={2.2}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <h3 className="font-semibold text-foreground truncate">
                        {sl.product.name}
                      </h3>
                      <Badge variant="outline">
                        <WarehouseIcon className="h-3 w-3" /> {sl.warehouse.name}
                      </Badge>
                      {isOut && <StatusPill status="cancelled" size="sm" label="Agotado" />}
                      {isLow && <StatusPill status="pending" size="sm" label="Stock bajo" />}
                      {isOver && (
                        <StatusPill status="delayed" size="sm" label="Sobrestock" />
                      )}
                    </div>
                    <div className="flex flex-wrap gap-x-5 gap-y-1 text-[0.82rem] text-muted-foreground">
                      <span>
                        Cantidad:{" "}
                        <span className="font-mono tabular-nums font-medium text-foreground">
                          {qty} {abbr}
                          {sl.product.isCatchWeight && ` · ${sl.currentPieces} pzas`}
                        </span>
                        {presentationEquivalence && (
                          <span className="font-mono tabular-nums text-muted-foreground">
                            {" "}
                            ({presentationEquivalence})
                          </span>
                        )}
                        {piecesEquivalence && (
                          <span className="font-mono tabular-nums text-muted-foreground">
                            {" "}
                            ({piecesEquivalence})
                          </span>
                        )}
                      </span>
                      <span>
                        Min:{" "}
                        <span className="tabular-nums font-medium text-foreground">
                          {minStock} {abbr}
                        </span>
                      </span>
                      {maxStock !== null && (
                        <span>
                          Max:{" "}
                          <span className="tabular-nums font-medium text-foreground">
                            {maxStock} {abbr}
                          </span>
                        </span>
                      )}
                      {cost > 0 && (
                        <span className="inline-flex items-center gap-1 text-[var(--success)]">
                          <CircleDollarSign className="h-3 w-3" />
                          {cost.toFixed(2)} c/u
                        </span>
                      )}
                    </div>
                  </div>
                  {value > 0 && (
                    <div className="text-right shrink-0">
                      <div className="text-[10.5px] font-medium uppercase tracking-wider text-muted-foreground">
                        Valor
                      </div>
                      <div className="font-mono tabular-nums text-base font-bold text-foreground">
                        ${value.toFixed(0)}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <div className="p-8">
              <EmptyState
                title="Sin stock registrado"
                description={
                  search
                    ? `No se encontraron resultados para "${search}".`
                    : "Registra movimientos para ver los niveles de stock."
                }
              />
            </div>
          )}
        </div>
      </div>

      {/* Recent Movements */}
      <div className="rounded-xl border border-border bg-card shadow-panel overflow-hidden">
        <div className="flex items-center justify-between border-b border-border bg-muted/30 px-4 py-3">
          <h2 className="font-headline text-sm font-semibold text-foreground flex items-center gap-2">
            <ArrowLeftRight className="h-4 w-4 text-[var(--ops-active)]" />
            Movimientos recientes
          </h2>
          <Badge variant="outline">{movements.length}</Badge>
        </div>
        <div className="divide-y divide-border/60">
          {movements.length > 0 ? (
            movements.map((m) => {
              const Icon = MOVEMENT_ICON[m.movementType] ?? ArrowDownToLine;
              const bg = MOVEMENT_BG[m.movementType] ?? MOVEMENT_BG.transfer;
              const abbr = getUnitAbbreviation(m.product.unit);
              return (
                <div
                  key={m.movementId}
                  className="flex items-start gap-4 px-5 py-3"
                >
                  <span
                    className={`grid size-9 place-items-center rounded-md shrink-0 ${bg}`}
                  >
                    <Icon className="size-4" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-0.5">
                      <span className="font-medium text-foreground truncate">
                        {m.product.name}
                      </span>
                      <Badge variant="outline" className="text-[10px]">
                        {getMovementLabel(m.movementType)}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {m.warehouse.name}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                      <span>
                        <span className="font-mono tabular-nums font-medium text-foreground">
                          {m.quantity} {abbr}
                          {m.pieces != null && ` · ${m.pieces} pzas`}
                        </span>
                      </span>
                      {m.unitCost != null && m.unitCost > 0 && (
                        <span className="font-mono tabular-nums">
                          Costo: {formatOrigCostReference(m) ?? `${formatAmount(m.unitCost, 2)} CUP`}/{abbr}
                        </span>
                      )}
                      {m.referenceDoc && (
                        <span className="inline-flex items-center gap-1">
                          <FileText className="h-3 w-3" /> {m.referenceDoc}
                        </span>
                      )}
                      {m.notes && (
                        <span className="inline-flex items-center gap-1 truncate">
                          <StickyNote className="h-3 w-3" /> {m.notes}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
                    {new Date(m.createdAt).toLocaleDateString("es-ES")}
                  </span>
                </div>
              );
            })
          ) : (
            <div className="p-8">
              <EmptyState
                title="Sin movimientos"
                description="No se han registrado movimientos."
              />
            </div>
          )}
        </div>
      </div>

      {/* New Movement Dialog */}
      <Dialog
        open={isCreateOpen}
        onOpenChange={(o) => {
          setIsCreateOpen(o);
          if (!o) resetPresentationState();
        }}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <FormDialogHeader
              icon={ArrowLeftRight}
              title="Nuevo movimiento de stock"
              description="Registra entradas, salidas, transferencias o ajustes."
            />
          </DialogHeader>
          <form onSubmit={handleCreate}>
            <div className="space-y-5">
              <FormSection
                icon={Wrench}
                title="Tipo de movimiento"
                description="Selecciona el tipo y los datos generales."
              >
                <Field label="Tipo" icon={ArrowLeftRight} required>
                  <Select
                    name="movementType"
                    defaultValue="entry"
                    onValueChange={(v) =>
                      setMovementType(v as typeof movementType)
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MOVEMENT_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Producto" icon={Package} required>
                  <Select
                    name="productId"
                    value={selectedProductId}
                    onValueChange={(v) => {
                      setSelectedProductId(v);
                      setSelectedPresentationId("base");
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Seleccionar..." />
                    </SelectTrigger>
                    <SelectContent>
                      {products.map((p) => (
                        <SelectItem
                          key={p.productId}
                          value={String(p.productId)}
                        >
                          {p.name} ({getUnitAbbreviation(p.unit)})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                {showPresentationSelect && (
                  <Field label="Presentación" icon={Package}>
                    <Select
                      value={selectedPresentationId}
                      onValueChange={setSelectedPresentationId}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="base">
                          Unidad base ({getUnitAbbreviation(selectedProduct?.unit ?? "")})
                        </SelectItem>
                        {nonBasePresentations.map((pr) => (
                          <SelectItem
                            key={pr.presentationId}
                            value={String(pr.presentationId)}
                          >
                            {pr.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                )}
              </FormSection>

              <FormSection
                icon={WarehouseIcon}
                title="Almacén"
                description={
                  movementType === "transfer"
                    ? "Origen y destino de la transferencia."
                    : "Almacén afectado."
                }
              >
                {movementType === "transfer" ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field label="Origen" icon={WarehouseIcon} required>
                      <Select name="warehouseIdFrom">
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Seleccionar..." />
                        </SelectTrigger>
                        <SelectContent>
                          {warehouses.map((w) => (
                            <SelectItem
                              key={w.warehouseId}
                              value={String(w.warehouseId)}
                            >
                              {w.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field label="Destino" icon={WarehouseIcon} required>
                      <Select name="warehouseIdTo">
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Seleccionar..." />
                        </SelectTrigger>
                        <SelectContent>
                          {warehouses.map((w) => (
                            <SelectItem
                              key={w.warehouseId}
                              value={String(w.warehouseId)}
                            >
                              {w.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                  </div>
                ) : (
                  <Field label="Almacén" icon={WarehouseIcon} required>
                    <Select name="warehouseId">
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Seleccionar..." />
                      </SelectTrigger>
                      <SelectContent>
                        {warehouses.map((w) => (
                          <SelectItem
                            key={w.warehouseId}
                            value={String(w.warehouseId)}
                          >
                            {w.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                )}
              </FormSection>

              <FormSection
                icon={CircleDollarSign}
                title="Cantidad y costo"
                description="Detalles cuantitativos del movimiento."
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field
                    label={selectedProduct?.isCatchWeight ? "Peso (kg)" : "Cantidad"}
                    icon={Package}
                    required
                  >
                    <Input
                      name="quantity"
                      type="number"
                      step="0.01"
                      required
                      min="0.01"
                      value={quantityInput}
                      onChange={(e) => setQuantityInput(e.target.value)}
                    />
                    {equivalenceText && (
                      <p className="mt-1.5 text-xs text-muted-foreground font-mono tabular-nums">
                        {equivalenceText}
                      </p>
                    )}
                  </Field>
                  {selectedProduct?.isCatchWeight && (
                    <Field label="Piezas" icon={Package} required>
                      <Input
                        name="pieces"
                        type="number"
                        step="1"
                        required
                        min={movementType === "adjustment" ? "0" : "1"}
                        value={piecesInput}
                        onChange={(e) => setPiecesInput(e.target.value)}
                      />
                      {movementType === "adjustment" && (
                        <p className="mt-1.5 text-xs text-muted-foreground">
                          Usa 0 si el ajuste es solo de peso (ej. deshidratación), sin
                          perder piezas completas.
                        </p>
                      )}
                    </Field>
                  )}
                  {movementType === "adjustment" && (
                    <Field label="Signo del ajuste" icon={Wrench} required>
                      <Select
                        value={adjustmentSign}
                        onValueChange={(v) =>
                          setAdjustmentSign(v as "positive" | "negative")
                        }
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="positive">Positivo (+)</SelectItem>
                          <SelectItem value="negative">Negativo (-)</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                  )}
                  {movementType === "entry" && (
                    <Field
                      label={
                        activePresentation
                          ? `Costo por ${activePresentation.name}`
                          : "Costo unitario"
                      }
                      icon={CircleDollarSign}
                    >
                      <Input
                        name="unitCost"
                        type="number"
                        step="0.01"
                        placeholder="$0.00"
                      />
                    </Field>
                  )}
                </div>
              </FormSection>

              <FormSection
                title="Referencia"
                description="Documento y notas opcionales."
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Documento" icon={FileText}>
                    <Input
                      name="referenceDoc"
                      placeholder="No. factura, vale…"
                    />
                  </Field>
                  <Field label="Notas" icon={StickyNote}>
                    <Input name="notes" />
                  </Field>
                </div>
              </FormSection>
            </div>

            <div className="flex justify-end gap-2 pt-5 border-t border-border mt-6">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsCreateOpen(false);
                  resetPresentationState();
                }}
              >
                Cancelar
              </Button>
              <Button type="submit" variant="brand" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {isSubmitting ? "Registrando…" : "Registrar movimiento"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
