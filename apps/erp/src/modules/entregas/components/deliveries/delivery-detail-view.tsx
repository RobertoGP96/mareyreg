"use client";

import { Button } from "@/components/ui/button";
import {
  BadgeCheck, Bike, Clock, CheckCircle2, ExternalLink, FileText, Hash, MapPin, Phone, UserRound, XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatAmount } from "@/lib/format";
import { CurrencyChip } from "@/modules/envios/components/shared/currency-chip";
import type { CashDeliveryDetail } from "../../queries/cash-delivery-queries";
import { DeliveryStatusIcon, CommissionStatusIcon } from "./delivery-status-icons";
import { DeliveryPhotoGallery, type GalleryActions } from "./delivery-photo-gallery";

interface Props {
  detail: CashDeliveryDetail;
  /** "sheet" apila todo en una columna; "page" reparte en dos columnas en escritorio. */
  layout?: "sheet" | "page";
  galleryActions?: GalleryActions;
}

export function fmtDateTime(d: Date | string | null) {
  if (!d) return null;
  return new Date(d).toLocaleString("es-MX", {
    year: "numeric", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit",
  });
}

export function hasCommission(d: Pick<CashDeliveryDetail, "commissionAmount" | "courierId">) {
  return Number(d.commissionAmount) > 0 && d.courierId != null;
}

export function commissionLabel(
  d: Pick<CashDeliveryDetail, "commissionAmount" | "courierId" | "commissionCurrencyDecimals" | "commissionCurrencyCode">
): string | undefined {
  if (!hasCommission(d)) return undefined;
  return `${formatAmount(Number(d.commissionAmount), d.commissionCurrencyDecimals ?? 2)} ${
    d.commissionCurrencyCode ?? ""
  }`.trim();
}

function Card({
  title,
  icon: Icon,
  children,
  className,
}: {
  title?: string;
  icon?: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-xl border border-border bg-card p-3", className)}>
      {title && (
        <h3 className="mb-1.5 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {Icon && <Icon className="h-3.5 w-3.5" />}
          {title}
        </h3>
      )}
      {children}
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5">
      <span className="shrink-0 text-xs text-muted-foreground">{label}</span>
      <span className="min-w-0 text-right text-sm">{children}</span>
    </div>
  );
}

function Empty() {
  return <span className="italic text-muted-foreground">—</span>;
}

function RecipientCard({ detail }: { detail: CashDeliveryDetail }) {
  return (
    <Card title="Destinatario" icon={UserRound}>
      <div className="flex items-center justify-between gap-2">
        <span className="truncate font-medium">{detail.recipientName}</span>
        <div className="flex shrink-0 items-center gap-1.5">
          <DeliveryStatusIcon status={detail.status} />
          <CommissionStatusIcon
            status={detail.commissionStatus}
            hasCommission={hasCommission(detail)}
            amountLabel={commissionLabel(detail)}
          />
        </div>
      </div>
      {detail.recipientPhone && (
        <a
          href={`tel:${detail.recipientPhone.replace(/\s+/g, "")}`}
          className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <Phone className="h-3 w-3" /> {detail.recipientPhone}
        </a>
      )}
      {detail.recipientAddress && (
        <p className="mt-1 flex items-start gap-1.5 text-xs text-muted-foreground">
          <MapPin className="mt-0.5 h-3 w-3 shrink-0" />
          <span>{detail.recipientAddress}</span>
        </p>
      )}
      {detail.recipientMapUrl && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="mt-1.5 h-7 px-2 text-xs"
          onClick={() => window.open(detail.recipientMapUrl!, "_blank", "noopener,noreferrer")}
        >
          <ExternalLink className="h-3 w-3" /> Abrir mapa
        </Button>
      )}
    </Card>
  );
}

function AmountsCard({ detail }: { detail: CashDeliveryDetail }) {
  return (
    <div className="space-y-2">
      <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Montos entregados
      </h3>
      {detail.lines.map((line) => (
        <div key={line.lineId} className="rounded-xl border border-border bg-card p-3">
          <div className="flex items-center justify-between gap-2">
            <CurrencyChip code={line.currencyCode} size="sm" />
            <span className="font-mono text-base font-semibold tabular-nums">
              {formatAmount(Number(line.amount), line.currencyDecimals)}
            </span>
          </div>
          {line.denominations.length > 0 ? (
            <ul className="mt-2 space-y-0.5 border-t border-border pt-2">
              {line.denominations.map((d) => (
                <li
                  key={d.denominationId}
                  className="flex items-center justify-between font-mono text-xs tabular-nums text-muted-foreground"
                >
                  <span>
                    {formatAmount(Number(d.value), line.currencyDecimals)} × {d.quantity}
                  </span>
                  <span>{formatAmount(Number(d.value) * d.quantity, line.currencyDecimals)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 border-t border-border pt-2 text-xs italic text-muted-foreground">
              Sin desglose de billetes (entrega migrada o moneda digital).
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

function CourierCard({ detail }: { detail: CashDeliveryDetail }) {
  return (
    <Card title="Mensajero y comisión" icon={Bike}>
      <Row label="Mensajero">{detail.courierName ?? <Empty />}</Row>
      <Row label="Comisión">
        {hasCommission(detail) ? (
          <span className="font-mono tabular-nums">{commissionLabel(detail)}</span>
        ) : (
          <Empty />
        )}
      </Row>
      {hasCommission(detail) && (
        <Row label="Estado">
          <span className="inline-flex items-center gap-1">
            {detail.commissionStatus === "paid" ? (
              <>
                <BadgeCheck className="h-3.5 w-3.5 text-[var(--ops-success)]" /> Pagada
              </>
            ) : (
              <>
                <Clock className="h-3.5 w-3.5 text-[var(--ops-warning)]" /> Pendiente de pago
              </>
            )}
          </span>
        </Row>
      )}
      {detail.commissionPaidAt && (
        <Row label="Pagada el">
          <span className="tabular-nums">{fmtDateTime(detail.commissionPaidAt)}</span>
          {detail.commissionPaidByName && (
            <span className="block text-xs text-muted-foreground">por {detail.commissionPaidByName}</span>
          )}
        </Row>
      )}
    </Card>
  );
}

type TimelineEntry = {
  key: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: string;
  title: string;
  when: Date | string | null;
  who: string | null;
};

function TimelineCard({ detail }: { detail: CashDeliveryDetail }) {
  const entries: TimelineEntry[] = [
    {
      key: "created",
      icon: Clock,
      tone: "text-[var(--ops-idle)]",
      title: "Registrada",
      when: detail.occurredAt,
      who: detail.createdByName,
    },
  ];
  if (detail.deliveredAt) {
    entries.push({
      key: "delivered",
      icon: CheckCircle2,
      tone: "text-[var(--ops-success)]",
      title: "Entregada",
      when: detail.deliveredAt,
      who: detail.confirmedByName,
    });
  }
  if (detail.cancelledAt) {
    entries.push({
      key: "cancelled",
      icon: XCircle,
      tone: "text-[var(--ops-critical)]",
      title: "Cancelada",
      when: detail.cancelledAt,
      who: null,
    });
  }
  if (detail.commissionPaidAt) {
    entries.push({
      key: "commission",
      icon: BadgeCheck,
      tone: "text-[var(--ops-success)]",
      title: "Comisión pagada",
      when: detail.commissionPaidAt,
      who: detail.commissionPaidByName,
    });
  }

  return (
    <Card title="Cronología" icon={Clock}>
      <ol className="space-y-2">
        {entries.map((e) => (
          <li key={e.key} className="flex items-start gap-2">
            <e.icon className={cn("mt-0.5 h-4 w-4 shrink-0", e.tone)} />
            <div className="min-w-0 flex-1">
              <p className="text-sm">{e.title}</p>
              <p className="text-xs tabular-nums text-muted-foreground">
                {fmtDateTime(e.when)}
                {e.who ? ` · ${e.who}` : ""}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </Card>
  );
}

function DetailsCard({ detail }: { detail: CashDeliveryDetail }) {
  return (
    <Card title="Detalles" icon={FileText}>
      <Row label="Referencia">
        {detail.reference ? (
          <span className="inline-flex items-center gap-1 font-mono text-sm">
            <Hash className="h-3 w-3 text-muted-foreground" /> {detail.reference}
          </span>
        ) : (
          <Empty />
        )}
      </Row>
      <Row label="Notas">
        {detail.notes ? <span className="whitespace-pre-wrap">{detail.notes}</span> : <Empty />}
      </Row>
    </Card>
  );
}

export function DeliveryDetailView({ detail, layout = "sheet", galleryActions }: Props) {
  const gallery = (
    <DeliveryPhotoGallery
      photos={detail.photos}
      legacyPhotoUrl={detail.legacyPhotoUrl}
      actions={galleryActions}
    />
  );

  if (layout === "page") {
    return (
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-4">
          <RecipientCard detail={detail} />
          <AmountsCard detail={detail} />
          {gallery}
        </div>
        <div className="space-y-4">
          <CourierCard detail={detail} />
          <TimelineCard detail={detail} />
          <DetailsCard detail={detail} />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <RecipientCard detail={detail} />
      <AmountsCard detail={detail} />
      <CourierCard detail={detail} />
      <TimelineCard detail={detail} />
      <DetailsCard detail={detail} />
      {gallery}
    </div>
  );
}
