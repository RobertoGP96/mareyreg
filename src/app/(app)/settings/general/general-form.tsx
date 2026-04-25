"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Building2, MapPin, Globe, Save, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { updateCompany } from "@/modules/settings/actions/company-actions";
import type { CompanyData } from "@/modules/settings/queries/company-queries";

const TIMEZONES = [
  { value: "America/Mexico_City", label: "Ciudad de México (UTC-6)" },
  { value: "America/Monterrey", label: "Monterrey (UTC-6)" },
  { value: "America/Tijuana", label: "Tijuana (UTC-8)" },
  { value: "America/Cancun", label: "Cancún (UTC-5)" },
  { value: "America/Guatemala", label: "Guatemala (UTC-6)" },
];

const CURRENCIES = [
  { value: "MXN", label: "MXN · Peso mexicano" },
  { value: "USD", label: "USD · Dólar estadounidense" },
  { value: "EUR", label: "EUR · Euro" },
];

const LANGUAGES = [
  { value: "es-MX", label: "Español (México)" },
  { value: "es-ES", label: "Español (España)" },
  { value: "en-US", label: "English (US)" },
];

type Props = {
  initial: CompanyData;
  canEdit: boolean;
};

export function GeneralForm({ initial, canEdit }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: initial.name,
    rfc: initial.rfc ?? "",
    phone: initial.phone ?? "",
    address: initial.address ?? "",
    description: initial.description ?? "",
    timezone: initial.timezone,
    currency: initial.currency,
    language: initial.language,
  });

  const update = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setForm((s) => ({ ...s, [key]: value }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const result = await updateCompany({
      name: form.name,
      rfc: form.rfc,
      phone: form.phone,
      address: form.address,
      description: form.description,
      timezone: form.timezone,
      currency: form.currency,
      language: form.language,
    });
    setLoading(false);
    if (result.success) {
      toast.success("Configuración guardada");
      router.refresh();
    } else {
      toast.error(result.error);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {!canEdit && (
        <div className="rounded-md border border-[var(--warning)]/30 bg-[var(--warning)]/8 px-4 py-2.5 text-[12.5px] text-[var(--warning)]">
          Solo administradores pueden modificar la configuración general. Los
          campos están en modo lectura.
        </div>
      )}

      {/* Empresa */}
      <section className="rounded-xl border border-border bg-card shadow-sm">
        <div className="border-b border-border p-6">
          <h3 className="flex items-center gap-2 font-headline text-base font-semibold text-foreground">
            <Building2 className="size-4 text-muted-foreground" />
            Datos de la empresa
          </h3>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Aparecen en facturas, reportes y comunicaciones.
          </p>
        </div>

        <div className="grid gap-5 p-6 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="companyName">Nombre comercial</Label>
            <Input
              id="companyName"
              value={form.name}
              onChange={(e) => update("name", e.target.value)}
              placeholder="Razón social"
              disabled={!canEdit}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rfc">RFC</Label>
            <Input
              id="rfc"
              value={form.rfc}
              onChange={(e) => update("rfc", e.target.value)}
              placeholder="AAA000000XXX"
              disabled={!canEdit}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="phone">Teléfono</Label>
            <Input
              id="phone"
              value={form.phone}
              onChange={(e) => update("phone", e.target.value)}
              placeholder="+52 55 0000 0000"
              disabled={!canEdit}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="address">
              <MapPin className="size-3.5 text-muted-foreground" />
              Dirección fiscal
            </Label>
            <Textarea
              id="address"
              rows={2}
              value={form.address}
              onChange={(e) => update("address", e.target.value)}
              placeholder="Calle, número, colonia, ciudad, estado, CP"
              disabled={!canEdit}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="description">Descripción breve</Label>
            <Textarea
              id="description"
              rows={3}
              value={form.description}
              onChange={(e) => update("description", e.target.value)}
              placeholder="Describe a qué se dedica la empresa"
              disabled={!canEdit}
            />
          </div>
        </div>
      </section>

      {/* Regional */}
      <section className="rounded-xl border border-border bg-card shadow-sm">
        <div className="border-b border-border p-6">
          <h3 className="flex items-center gap-2 font-headline text-base font-semibold text-foreground">
            <Globe className="size-4 text-muted-foreground" />
            Regional y formato
          </h3>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Zona horaria, idioma y moneda usados en todo el sistema.
          </p>
        </div>

        <div className="grid gap-5 p-6 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label>Zona horaria</Label>
            <Select
              value={form.timezone}
              onValueChange={(v) => update("timezone", v)}
              disabled={!canEdit}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIMEZONES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Moneda principal</Label>
            <Select
              value={form.currency}
              onValueChange={(v) => update("currency", v)}
              disabled={!canEdit}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CURRENCIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Idioma</Label>
            <Select
              value={form.language}
              onValueChange={(v) => update("language", v)}
              disabled={!canEdit}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LANGUAGES.map((l) => (
                  <SelectItem key={l.value} value={l.value}>
                    {l.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </section>

      {canEdit && (
        <div className="flex items-center justify-end gap-2">
          <Button type="button" variant="ghost" disabled={loading}>
            Cancelar
          </Button>
          <Button type="submit" variant="brand" disabled={loading}>
            {loading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Save className="size-4" />
            )}
            {loading ? "Guardando…" : "Guardar cambios"}
          </Button>
        </div>
      )}
    </form>
  );
}
