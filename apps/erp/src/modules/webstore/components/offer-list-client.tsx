"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/lib/toast";
import { PageHeader } from "@/components/ui/page-header";
import { KpiCard } from "@/components/ui/kpi-card";
import { StatusPill, type OpsStatus } from "@/components/ui/status-pill";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { EmptyState } from "@/components/ui/empty-state";
import { MobileListCard } from "@/components/ui/mobile-list-card";
import { ResponsiveListView } from "@/components/ui/responsive-list-view";
import { Fab } from "@/components/ui/fab";
import type { DataTableColumn } from "@/components/ui/data-table";
import { BadgePercent, Search, Pencil, Trash2, History, Plus, Tag } from "lucide-react";
import { formatAmount } from "@/lib/format";
import { toggleOffer, deleteOffer } from "@/modules/webstore/actions/offer-actions";
import type { OfferRow, OfferKpis, WebstoreProductPickerRow } from "@/modules/webstore/queries/offer-queries";
import { OfferFormDialog } from "./offer-form-dialog";
import { OfferHistoryDialog } from "./offer-history-dialog";

const TYPE_LABELS: Record<string, string> = {
  percent: "Porcentaje",
  fixed: "Monto fijo",
};

function offerStatus(offer: OfferRow): { status: OpsStatus; label: string } {
  if (!offer.isActive) return { status: "inactive", label: "Inactiva" };
  if (offer.endsAt && new Date(offer.endsAt) < new Date()) {
    return { status: "expired", label: "Vencida" };
  }
  return { status: "active", label: "Activa" };
}

function formatValue(offer: OfferRow): string {
  return offer.type === "fixed" ? formatAmount(Number(offer.value)) : `${offer.value}%`;
}

function formatVigencia(offer: OfferRow): string {
  if (!offer.startsAt && !offer.endsAt) return "Sin límite";
  const from = offer.startsAt ? new Date(offer.startsAt).toLocaleDateString("es-MX") : "—";
  const to = offer.endsAt ? new Date(offer.endsAt).toLocaleDateString("es-MX") : "—";
  return `${from} a ${to}`;
}

interface Props {
  offers: OfferRow[];
  kpis: OfferKpis;
  products: WebstoreProductPickerRow[];
}

export function OfferListClient({ offers, kpis, products }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingOffer, setEditingOffer] = useState<OfferRow | null>(null);
  const [historyOffer, setHistoryOffer] = useState<OfferRow | null>(null);
  const [pendingId, setPendingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return offers;
    return offers.filter((o) => o.name.toLowerCase().includes(term));
  }, [offers, search]);

  const openCreate = () => {
    setEditingOffer(null);
    setShowForm(true);
  };

  const openEdit = (offer: OfferRow) => {
    setEditingOffer(offer);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingOffer(null);
  };

  const handleToggle = async (offer: OfferRow, next: boolean) => {
    setPendingId(offer.offerId);
    try {
      const res = await toggleOffer(offer.offerId, next);
      if (res.success) {
        toast.success(next ? "Oferta activada" : "Oferta desactivada");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    } catch {
      toast.error("No se pudo cambiar el estado de la oferta.");
    } finally {
      setPendingId(null);
    }
  };

  const handleDelete = async (offer: OfferRow) => {
    if (!window.confirm(`¿Eliminar la oferta "${offer.name}"? Esta acción no se puede deshacer.`)) {
      return;
    }
    setDeletingId(offer.offerId);
    try {
      const res = await deleteOffer(offer.offerId);
      if (res.success) {
        toast.success("Oferta eliminada");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    } catch {
      toast.error("No se pudo eliminar la oferta.");
    } finally {
      setDeletingId(null);
    }
  };

  const renderActions = (offer: OfferRow) => (
    <div className="flex items-center gap-1">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-8"
        title="Editar"
        onClick={() => openEdit(offer)}
      >
        <Pencil className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-8"
        title="Historial"
        onClick={() => setHistoryOffer(offer)}
      >
        <History className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-8 text-destructive hover:text-destructive"
        title="Eliminar"
        disabled={deletingId === offer.offerId}
        onClick={() => handleDelete(offer)}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );

  const columns: DataTableColumn<OfferRow>[] = [
    {
      key: "name",
      header: "Oferta",
      cell: (offer) => (
        <div className="min-w-0">
          <div className="font-medium text-foreground truncate">{offer.name}</div>
          {offer.description && (
            <div className="text-xs text-muted-foreground truncate">{offer.description}</div>
          )}
        </div>
      ),
    },
    {
      key: "type",
      header: "Tipo",
      cell: (offer) => TYPE_LABELS[offer.type] ?? offer.type,
    },
    {
      key: "value",
      header: "Valor",
      align: "right",
      cell: (offer) => <span className="font-mono tabular-nums">{formatValue(offer)}</span>,
    },
    {
      key: "vigencia",
      header: "Vigencia",
      cell: (offer) => <span className="text-xs">{formatVigencia(offer)}</span>,
    },
    {
      key: "products",
      header: "Productos",
      align: "right",
      cell: (offer) => <span className="font-mono tabular-nums">{offer.products.length}</span>,
    },
    {
      key: "estado",
      header: "Estado",
      cell: (offer) => {
        const { status, label } = offerStatus(offer);
        return (
          <div className="flex items-center gap-2">
            <StatusPill status={status} label={label} size="sm" />
            <Switch
              checked={offer.isActive}
              disabled={pendingId === offer.offerId}
              onCheckedChange={(next) => handleToggle(offer, next)}
              aria-label={`Alternar oferta ${offer.name}`}
            />
          </div>
        );
      },
    },
    {
      key: "actions",
      header: "Acciones",
      align: "right",
      cell: renderActions,
    },
  ];

  const mobileCard = (offer: OfferRow) => {
    const { status, label } = offerStatus(offer);
    return (
      <MobileListCard
        key={offer.offerId}
        leading={
          <div className="flex size-10 items-center justify-center rounded-md bg-[var(--brand)]/10">
            <BadgePercent className="h-5 w-5 text-[var(--brand)]" />
          </div>
        }
        title={offer.name}
        subtitle={formatVigencia(offer)}
        value={<span className="font-mono tabular-nums">{formatValue(offer)}</span>}
        meta={
          <>
            <StatusPill status={status} label={label} size="sm" />
            <Badge variant="outline" className="text-[10px]">
              {offer.products.length} productos
            </Badge>
          </>
        }
        footer={
          <div className="flex items-center justify-between gap-2">
            <label className="flex items-center gap-1.5 rounded-lg bg-muted/50 px-2 py-1.5">
              <Switch
                checked={offer.isActive}
                disabled={pendingId === offer.offerId}
                onCheckedChange={(next) => handleToggle(offer, next)}
                aria-label={`Alternar oferta ${offer.name}`}
              />
              <span className="text-xs text-muted-foreground">Activa</span>
            </label>
            {renderActions(offer)}
          </div>
        }
      />
    );
  };

  return (
    <div className="space-y-5">
      <PageHeader
        icon={BadgePercent}
        title="Ofertas de la tienda"
        description="Agrupa varios productos en una oferta con descuento y vigencia compartida."
        badge={`${offers.length} ofertas`}
        actions={
          <Button type="button" variant="brand" onClick={openCreate} className="hidden md:inline-flex">
            <Plus className="h-4 w-4" />
            Nueva oferta
          </Button>
        }
      />

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <KpiCard label="Activas" value={kpis.active} icon={BadgePercent} accent="brand" size="compact" />
        <KpiCard label="Por vencer (7 días)" value={kpis.endingSoon} icon={History} accent="warning" size="compact" />
        <KpiCard label="Productos en oferta" value={kpis.productsOnOffer} icon={Tag} accent="success" size="compact" />
      </div>

      <ResponsiveListView<OfferRow>
        columns={columns}
        rows={filtered}
        rowKey={(offer) => offer.offerId}
        mobileCard={mobileCard}
        toolbar={
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar oferta…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>
        }
        emptyState={
          <EmptyState
            icon={<BadgePercent className="size-10" />}
            title="Sin ofertas"
            description="Crea una oferta para agrupar productos con un descuento compartido."
          />
        }
      />

      <Fab icon={Plus} label="Nueva oferta" onClick={openCreate} />

      <OfferFormDialog
        open={showForm}
        offer={editingOffer}
        products={products}
        onOpenChange={(o) => !o && closeForm()}
        onSaved={() => {
          closeForm();
          router.refresh();
        }}
      />

      <OfferHistoryDialog
        offerId={historyOffer?.offerId ?? null}
        offerName={historyOffer?.name}
        onOpenChange={(o) => !o && setHistoryOffer(null)}
      />
    </div>
  );
}
