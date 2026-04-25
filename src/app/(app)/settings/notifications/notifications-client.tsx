"use client";

import { useState } from "react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Save } from "lucide-react";
import { toast } from "sonner";

type ChannelKey = "email" | "push" | "in_app";

type ChannelState = Record<ChannelKey, boolean>;

type NotificationItem = {
  key: string;
  label: string;
  description: string;
};

type NotificationGroup = {
  title: string;
  items: NotificationItem[];
};

const GROUPS: NotificationGroup[] = [
  {
    title: "Operación diaria",
    items: [
      {
        key: "trip_status",
        label: "Cambios de estado de viajes",
        description: "Inicio, llegada, retraso o incidencia en una ruta.",
      },
      {
        key: "stock_alerts",
        label: "Alertas de inventario",
        description: "Stock por debajo del mínimo o caducidades próximas.",
      },
      {
        key: "paca_movements",
        label: "Movimientos de pacas",
        description: "Reservaciones, ventas y reclasificaciones.",
      },
    ],
  },
  {
    title: "Comercial",
    items: [
      {
        key: "new_orders",
        label: "Nuevas órdenes",
        description: "Cuando un cliente realiza una compra o reservación.",
      },
      {
        key: "ar_due",
        label: "Cuentas por cobrar vencidas",
        description: "Notificar cuando una factura supere los 30 días.",
      },
    ],
  },
  {
    title: "Sistema",
    items: [
      {
        key: "security",
        label: "Eventos de seguridad",
        description: "Inicios de sesión sospechosos y cambios de contraseña.",
      },
      {
        key: "product_updates",
        label: "Novedades del producto",
        description: "Resumen mensual con nuevas funciones y mejoras.",
      },
    ],
  },
];

export function NotificationsClient() {
  const [state, setState] = useState<Record<string, ChannelState>>(() => {
    const initial: Record<string, ChannelState> = {};
    for (const g of GROUPS) {
      for (const it of g.items) {
        initial[it.key] = {
          email: true,
          push: it.key === "trip_status" || it.key === "security",
          in_app: true,
        };
      }
    }
    return initial;
  });

  const toggle = (itemKey: string, channel: ChannelKey, value: boolean) => {
    setState((s) => ({
      ...s,
      [itemKey]: { ...s[itemKey], [channel]: value },
    }));
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-card shadow-sm">
        <div className="grid grid-cols-[1fr_repeat(3,90px)] items-center gap-2 border-b border-border px-6 py-3.5 text-[10.5px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
          <div>Evento</div>
          <div className="text-center">Email</div>
          <div className="text-center">Push</div>
          <div className="text-center">In-app</div>
        </div>

        {GROUPS.map((group, gi) => (
          <div key={group.title} className={gi > 0 ? "border-t border-border" : ""}>
            <div className="bg-muted/40 px-6 py-2 text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
              {group.title}
            </div>
            <ul className="divide-y divide-border">
              {group.items.map((it) => (
                <li
                  key={it.key}
                  className="grid grid-cols-[1fr_repeat(3,90px)] items-center gap-2 px-6 py-4"
                >
                  <div className="min-w-0">
                    <div className="text-[13.5px] font-semibold text-foreground">
                      {it.label}
                    </div>
                    <div className="mt-0.5 text-[12px] text-muted-foreground">
                      {it.description}
                    </div>
                  </div>
                  {(["email", "push", "in_app"] as ChannelKey[]).map((ch) => (
                    <div key={ch} className="flex justify-center">
                      <Switch
                        checked={state[it.key]?.[ch] ?? false}
                        onCheckedChange={(v) => toggle(it.key, ch, v)}
                        aria-label={`${it.label} · ${ch}`}
                      />
                    </div>
                  ))}
                </li>
              ))}
            </ul>
          </div>
        ))}

        <div className="flex items-center justify-end gap-2 border-t border-border bg-muted/30 px-6 py-3.5">
          <Button
            variant="brand"
            size="sm"
            onClick={() => toast.success("Preferencias guardadas")}
          >
            <Save className="size-4" />
            Guardar preferencias
          </Button>
        </div>
      </div>
    </div>
  );
}
