import { SettingsPageHeader } from "../_components/settings-page-header";
import { requireRole } from "@/lib/auth-guard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CreditCard,
  Download,
  Sparkles,
  CheckCircle2,
  ArrowUpRight,
} from "lucide-react";

const PLAN = {
  name: "Profesional",
  description: "Hasta 25 usuarios · módulos ilimitados",
  monthlyPrice: 1499,
  cycle: "mensual",
  renewsOn: "12 mayo 2026",
  features: [
    "Usuarios ilimitados",
    "Módulos completos (logística, pacas, ventas, reportes)",
    "Auditoría y exportaciones avanzadas",
    "Soporte prioritario por correo y chat",
  ],
};

const INVOICES = [
  { id: "FAC-0148", date: "12 abr 2026", amount: 1499, status: "Pagada" },
  { id: "FAC-0142", date: "12 mar 2026", amount: 1499, status: "Pagada" },
  { id: "FAC-0136", date: "12 feb 2026", amount: 1499, status: "Pagada" },
  { id: "FAC-0131", date: "12 ene 2026", amount: 1499, status: "Pagada" },
];

const fmt = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  maximumFractionDigits: 0,
});

export default async function BillingPage() {
  await requireRole(["admin"]);

  return (
    <>
      <SettingsPageHeader
        badge="Empresa"
        title="Facturación"
        subtitle="Plan, método de pago e historial de facturas."
      />

      {/* Plan card */}
      <div className="mb-6 overflow-hidden rounded-xl border border-border shadow-sm bg-[linear-gradient(135deg,#1e3a8a_0%,#2563eb_50%,#3b82f6_100%)] text-white relative">
        <div
          className="absolute inset-0 grid-pattern opacity-15 pointer-events-none"
          aria-hidden
        />
        <div className="absolute -top-12 -right-12 h-48 w-48 rounded-full bg-white/10 blur-3xl pointer-events-none" />

        <div className="relative grid gap-6 p-6 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <div className="mb-1 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.12em] backdrop-blur-sm">
              <Sparkles className="size-3" />
              Plan actual
            </div>
            <h2 className="font-headline text-2xl font-bold tracking-tight">
              {PLAN.name}
            </h2>
            <p className="mt-1 text-[13.5px] text-white/75">
              {PLAN.description} · Renueva el {PLAN.renewsOn}
            </p>
            <ul className="mt-4 grid gap-1.5 text-[13px] sm:grid-cols-2">
              {PLAN.features.map((f) => (
                <li key={f} className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-[#bfdbfe]" />
                  <span className="text-white/85">{f}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-lg bg-white/10 p-4 backdrop-blur-sm">
            <div className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-white/65">
              Total
            </div>
            <div className="font-headline text-3xl font-bold">
              {fmt.format(PLAN.monthlyPrice)}
              <span className="ml-1 text-sm font-medium text-white/65">
                / {PLAN.cycle}
              </span>
            </div>
            <Button
              variant="secondary"
              size="sm"
              className="mt-3 w-full bg-white text-[#1e3a8a] hover:bg-white/90"
            >
              Cambiar plan
              <ArrowUpRight className="size-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Payment method */}
      <div className="mb-6 rounded-xl border border-border bg-card p-5 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="grid size-11 place-items-center rounded-md bg-foreground text-background">
            <CreditCard className="size-5" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="text-[13.5px] font-semibold text-foreground">
                Visa terminada en 4242
              </span>
              <Badge variant="secondary">Predeterminada</Badge>
            </div>
            <div className="text-[12px] text-muted-foreground">
              Vence 09/2027
            </div>
          </div>
          <Button variant="ghost" size="sm">
            Actualizar método
          </Button>
        </div>
      </div>

      {/* Invoices */}
      <div className="rounded-xl border border-border bg-card shadow-sm">
        <div className="flex items-center justify-between border-b border-border p-5">
          <div>
            <h3 className="font-headline text-base font-semibold text-foreground">
              Historial de facturas
            </h3>
            <p className="mt-1 text-[12.5px] text-muted-foreground">
              Últimos 12 meses · descarga el PDF de cada factura.
            </p>
          </div>
          <Button variant="secondary" size="sm">
            <Download className="size-4" />
            Descargar todo
          </Button>
        </div>
        <table className="w-full text-[13px]">
          <thead>
            <tr className="bg-muted/50 text-left">
              {["Folio", "Fecha", "Monto", "Estado", ""].map((h) => (
                <th
                  key={h}
                  className="px-5 py-2.5 text-[10.5px] font-bold uppercase tracking-[0.1em] text-muted-foreground"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {INVOICES.map((inv) => (
              <tr key={inv.id} className="border-t border-border hover:bg-muted/30">
                <td className="px-5 py-3 font-mono text-[12px] text-foreground">
                  {inv.id}
                </td>
                <td className="px-5 py-3 text-muted-foreground">{inv.date}</td>
                <td className="px-5 py-3 font-semibold tabular-nums text-foreground">
                  {fmt.format(inv.amount)}
                </td>
                <td className="px-5 py-3">
                  <Badge variant="success">{inv.status}</Badge>
                </td>
                <td className="px-5 py-3 text-right">
                  <Button variant="ghost" size="sm">
                    <Download className="size-4" />
                    PDF
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
