"use client";

import type { LucideIcon } from "lucide-react";
import { BadgeCheck, CheckCircle2, Clock, CircleSlash, Coins, XCircle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { CashDeliveryStatus, DeliveryCommissionStatus } from "@/generated/prisma";

// Icono + tooltip en vez de pill con texto: la tabla tiene 8 columnas y las
// etiquetas ("Pendiente", "Comisión pagada") se comían el ancho útil.
function StatusIcon({
  icon: Icon,
  label,
  className,
}: {
  icon: LucideIcon;
  label: string;
  className: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          role="img"
          aria-label={label}
          className={cn(
            "inline-flex size-7 items-center justify-center rounded-full ring-1",
            className
          )}
        >
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

const DELIVERY_STATUS: Record<
  CashDeliveryStatus,
  { icon: LucideIcon; label: string; className: string }
> = {
  pending: {
    icon: Clock,
    label: "Pendiente de entregar",
    className:
      "bg-[var(--ops-warning)]/12 text-[var(--ops-warning)] ring-[var(--ops-warning)]/30",
  },
  delivered: {
    icon: CheckCircle2,
    label: "Entregada",
    className:
      "bg-[var(--ops-success)]/10 text-[var(--ops-success)] ring-[var(--ops-success)]/25",
  },
  cancelled: {
    icon: XCircle,
    label: "Cancelada",
    className:
      "bg-[var(--ops-critical)]/10 text-[var(--ops-critical)] ring-[var(--ops-critical)]/25",
  },
};

export function DeliveryStatusIcon({ status }: { status: CashDeliveryStatus }) {
  const s = DELIVERY_STATUS[status];
  return <StatusIcon icon={s.icon} label={s.label} className={s.className} />;
}

export function CommissionStatusIcon({
  status,
  hasCommission,
  amountLabel,
}: {
  status: DeliveryCommissionStatus;
  hasCommission: boolean;
  amountLabel?: string;
}) {
  if (!hasCommission) {
    return (
      <StatusIcon
        icon={CircleSlash}
        label="Sin comisión asignada"
        className="bg-muted text-muted-foreground ring-border"
      />
    );
  }
  const paid = status === "paid";
  const suffix = amountLabel ? ` · ${amountLabel}` : "";
  return (
    <StatusIcon
      icon={paid ? BadgeCheck : Coins}
      label={`${paid ? "Comisión pagada" : "Comisión pendiente de pago"}${suffix}`}
      className={
        paid
          ? "bg-[var(--ops-success)]/10 text-[var(--ops-success)] ring-[var(--ops-success)]/25"
          : "bg-[var(--ops-warning)]/12 text-[var(--ops-warning)] ring-[var(--ops-warning)]/30"
      }
    />
  );
}
