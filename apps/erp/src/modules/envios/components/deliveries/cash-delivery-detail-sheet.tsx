"use client";

import Image from "next/image";
import { Button } from "@/components/ui/button";
import { ResponsiveFormDialog } from "@/components/ui/responsive-form-dialog";
import { FormDialogHeader } from "@/components/ui/field";
import { Loader2, HandCoins, ExternalLink, MapPin, Phone, SquarePen } from "lucide-react";
import { CurrencyChip } from "../shared/currency-chip";
import { formatAmount } from "../../lib/format";
import type { CashDeliveryDetail } from "../../queries/cash-delivery-queries";
import { DeliveryStatusIcon, CommissionStatusIcon } from "./delivery-status-icons";

interface Props {
  detail: CashDeliveryDetail | null;
  loading: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit?: (detail: CashDeliveryDetail) => void;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5">
      <span className="text-xs text-muted-foreground shrink-0">{label}</span>
      <span className="text-sm text-right min-w-0">{children}</span>
    </div>
  );
}

function fmtDate(d: Date | string | null) {
  if (!d) return null;
  return new Date(d).toLocaleString("es-MX", {
    year: "numeric", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit",
  });
}

export function CashDeliveryDetailSheet({ detail, loading, onOpenChange, onEdit }: Props) {
  const open = loading || !!detail;
  const commissionLabel =
    detail && Number(detail.commissionAmount) > 0
      ? `${formatAmount(
          Number(detail.commissionAmount),
          detail.commissionCurrencyDecimals ?? 2
        )} ${detail.commissionCurrencyCode ?? ""}`.trim()
      : undefined;

  return (
    <ResponsiveFormDialog
      open={open}
      onOpenChange={onOpenChange}
      a11yTitle="Detalle de la entrega"
      description="Montos, desglose de billetes, mensajero y comisión."
      desktopMaxWidth="sm:max-w-lg"
    >
      <FormDialogHeader
        icon={HandCoins}
        title="Detalle de la entrega"
        description="Montos, desglose de billetes, mensajero y comisión."
      />

      {loading || !detail ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-4 mt-4">
          <section className="rounded-xl border border-border p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium truncate">{detail.recipientName}</span>
              <div className="flex items-center gap-1.5 shrink-0">
                <DeliveryStatusIcon status={detail.status} />
                <CommissionStatusIcon
                  status={detail.commissionStatus}
                  hasCommission={Number(detail.commissionAmount) > 0 && detail.courierId != null}
                  amountLabel={commissionLabel}
                />
              </div>
            </div>
            {detail.recipientPhone && (
              <p className="mt-1 text-xs text-muted-foreground flex items-center gap-1">
                <Phone className="h-3 w-3" /> {detail.recipientPhone}
              </p>
            )}
            {detail.recipientAddress && (
              <p className="mt-0.5 text-xs text-muted-foreground flex items-start gap-1">
                <MapPin className="h-3 w-3 mt-0.5 shrink-0" />
                <span>{detail.recipientAddress}</span>
              </p>
            )}
            {detail.recipientMapUrl && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="mt-1 h-7 px-2 text-xs"
                onClick={() =>
                  window.open(detail.recipientMapUrl!, "_blank", "noopener,noreferrer")
                }
              >
                <ExternalLink className="h-3 w-3" /> Abrir mapa
              </Button>
            )}
          </section>

          <section className="space-y-2">
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Montos entregados
            </h3>
            {detail.lines.map((line) => (
              <div key={line.lineId} className="rounded-xl border border-border p-3">
                <div className="flex items-center justify-between gap-2">
                  <CurrencyChip code={line.currencyCode} size="sm" />
                  <span className="font-mono tabular-nums font-medium">
                    {formatAmount(Number(line.amount), line.currencyDecimals)}
                  </span>
                </div>

                {line.denominations.length > 0 ? (
                  <ul className="mt-2 space-y-0.5 border-t border-border pt-2">
                    {line.denominations.map((d) => (
                      <li
                        key={d.denominationId}
                        className="flex items-center justify-between text-xs font-mono tabular-nums text-muted-foreground"
                      >
                        <span>
                          {formatAmount(Number(d.value), line.currencyDecimals)} × {d.quantity}
                        </span>
                        <span>
                          {formatAmount(
                            Number(d.value) * d.quantity,
                            line.currencyDecimals
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-xs text-muted-foreground italic border-t border-border pt-2">
                    Sin desglose de billetes (entrega migrada o moneda digital).
                  </p>
                )}
              </div>
            ))}
          </section>

          <section className="rounded-xl border border-border p-3">
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
              Mensajero y comisión
            </h3>
            <Row label="Mensajero">
              {detail.courierName ?? <span className="text-muted-foreground italic">—</span>}
            </Row>
            <Row label="Comisión">
              {Number(detail.commissionAmount) > 0 ? (
                <span className="font-mono tabular-nums">
                  {formatAmount(
                    Number(detail.commissionAmount),
                    detail.commissionCurrencyDecimals ?? 2
                  )}{" "}
                  {detail.commissionCurrencyCode}
                </span>
              ) : (
                <span className="text-muted-foreground italic">—</span>
              )}
            </Row>
            <Row label="Estado comisión">
              {detail.commissionStatus === "paid" ? "Pagada" : "Pendiente"}
            </Row>
            {detail.commissionPaidAt && (
              <Row label="Pagada el">
                <span className="tabular-nums">{fmtDate(detail.commissionPaidAt)}</span>
              </Row>
            )}
          </section>

          <section className="rounded-xl border border-border p-3">
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
              Detalles
            </h3>
            <Row label="Registrada">
              <span className="tabular-nums">{fmtDate(detail.occurredAt)}</span>
            </Row>
            {detail.deliveredAt && (
              <Row label="Entregada">
                <span className="tabular-nums">{fmtDate(detail.deliveredAt)}</span>
              </Row>
            )}
            {detail.cancelledAt && (
              <Row label="Cancelada">
                <span className="tabular-nums">{fmtDate(detail.cancelledAt)}</span>
              </Row>
            )}
            <Row label="Referencia">
              {detail.reference ?? <span className="text-muted-foreground italic">—</span>}
            </Row>
            {detail.notes && <Row label="Notas">{detail.notes}</Row>}
          </section>

          {detail.photoUrl && (
            <section className="rounded-xl border border-border p-3">
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                Comprobante
              </h3>
              <button
                type="button"
                onClick={() => window.open(detail.photoUrl!, "_blank", "noopener,noreferrer")}
                className="relative block h-40 w-full overflow-hidden rounded-lg border border-border"
              >
                <Image
                  src={detail.photoUrl}
                  alt="Comprobante de la entrega"
                  fill
                  sizes="(max-width: 640px) 100vw, 480px"
                  className="object-cover"
                  unoptimized
                />
              </button>
            </section>
          )}
        </div>
      )}

      <div className="flex items-center justify-between gap-2 pt-4 border-t border-border">
        <span className="text-xs text-muted-foreground">
          {detail && detail.status !== "pending"
            ? "Solo se pueden editar entregas pendientes."
            : null}
        </span>
        <div className="flex gap-2 shrink-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
          {detail && onEdit && detail.status === "pending" && (
            <Button type="button" variant="brand" onClick={() => onEdit(detail)}>
              <SquarePen className="h-4 w-4" /> Editar
            </Button>
          )}
        </div>
      </div>
    </ResponsiveFormDialog>
  );
}
