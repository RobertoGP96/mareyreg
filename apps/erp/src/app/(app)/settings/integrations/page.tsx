import { SettingsPageHeader } from "../_components/settings-page-header";
import { requireRole } from "@/lib/auth-guard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  type LucideIcon,
  CheckCircle2,
  Mail,
  CreditCard,
  Webhook,
  FileSpreadsheet,
  MessageCircle,
  Cloud,
} from "lucide-react";

type Integration = {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
  status: "connected" | "available";
  category: string;
};

const INTEGRATIONS: Integration[] = [
  {
    id: "stripe",
    name: "Stripe",
    description: "Procesa pagos en línea con tarjeta y links de cobro.",
    icon: CreditCard,
    status: "available",
    category: "Pagos",
  },
  {
    id: "resend",
    name: "Resend",
    description: "Envía correos transaccionales y notificaciones.",
    icon: Mail,
    status: "connected",
    category: "Correo",
  },
  {
    id: "webhooks",
    name: "Webhooks",
    description: "Recibe eventos del sistema en tu URL personalizada.",
    icon: Webhook,
    status: "available",
    category: "Desarrollador",
  },
  {
    id: "google-sheets",
    name: "Google Sheets",
    description: "Sincroniza reportes y exportaciones automáticas.",
    icon: FileSpreadsheet,
    status: "available",
    category: "Productividad",
  },
  {
    id: "whatsapp",
    name: "WhatsApp Business",
    description: "Notificaciones a clientes vía WhatsApp.",
    icon: MessageCircle,
    status: "available",
    category: "Mensajería",
  },
  {
    id: "s3",
    name: "Amazon S3",
    description: "Almacena adjuntos y respaldos en tu propio bucket.",
    icon: Cloud,
    status: "available",
    category: "Almacenamiento",
  },
];

export default async function IntegrationsPage() {
  await requireRole(["admin"]);
  const connectedCount = INTEGRATIONS.filter((i) => i.status === "connected").length;

  return (
    <>
      <SettingsPageHeader
        badge="Empresa"
        title="Integraciones"
        subtitle={`${connectedCount} conectadas · ${INTEGRATIONS.length - connectedCount} disponibles`}
        actions={
          <Button variant="secondary" size="sm">
            <Plus className="size-4" />
            Solicitar integración
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {INTEGRATIONS.map((it) => {
          const ItIcon = it.icon;
          const isConnected = it.status === "connected";
          return (
            <div
              key={it.id}
              className="group flex flex-col rounded-xl border border-border bg-card p-5 shadow-sm transition-all hover:border-[var(--brand)]/40 hover:shadow-md"
            >
              <div className="mb-3 flex items-start justify-between">
                <div className="grid size-10 place-items-center rounded-md border border-border bg-muted text-foreground">
                  <ItIcon className="size-5" />
                </div>
                {isConnected ? (
                  <Badge variant="success">
                    <CheckCircle2 className="size-3" />
                    Conectado
                  </Badge>
                ) : (
                  <Badge variant="outline">{it.category}</Badge>
                )}
              </div>
              <h3 className="font-headline text-[15px] font-semibold tracking-tight text-foreground">
                {it.name}
              </h3>
              <p className="mt-1 flex-1 text-[12.5px] leading-relaxed text-muted-foreground">
                {it.description}
              </p>
              <div className="mt-3 flex items-center gap-2">
                <Button
                  variant={isConnected ? "secondary" : "brand"}
                  size="sm"
                  className="flex-1"
                >
                  {isConnected ? "Configurar" : "Conectar"}
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
