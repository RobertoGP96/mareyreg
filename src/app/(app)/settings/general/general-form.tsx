"use client";

import { useState } from "react";
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
import { Building2, MapPin, Globe, Save } from "lucide-react";
import { toast } from "sonner";

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

export function GeneralForm() {
  const [loading, setLoading] = useState(false);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setLoading(true);
        setTimeout(() => {
          setLoading(false);
          toast.success("Configuración guardada");
        }, 600);
      }}
      className="space-y-6"
    >
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
              defaultValue="GrayRegistration SA de CV"
              placeholder="Razón social"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rfc">RFC</Label>
            <Input id="rfc" placeholder="AAA000000XXX" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="phone">Teléfono</Label>
            <Input id="phone" placeholder="+52 55 0000 0000" />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="address">
              <MapPin className="size-3.5 text-muted-foreground" />
              Dirección fiscal
            </Label>
            <Textarea
              id="address"
              rows={2}
              placeholder="Calle, número, colonia, ciudad, estado, CP"
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="description">Descripción breve</Label>
            <Textarea
              id="description"
              rows={3}
              placeholder="Describe a qué se dedica la empresa"
              defaultValue="Comercializadora especializada en pacas de ropa con red de distribución nacional."
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
            <Select defaultValue="America/Mexico_City">
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
            <Select defaultValue="MXN">
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
            <Select defaultValue="es-MX">
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

      <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="ghost">
          Cancelar
        </Button>
        <Button type="submit" variant="brand" disabled={loading}>
          <Save className="size-4" />
          {loading ? "Guardando…" : "Guardar cambios"}
        </Button>
      </div>
    </form>
  );
}
