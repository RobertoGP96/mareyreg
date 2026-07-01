"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  KeyRound,
  ShieldCheck,
  Smartphone,
  Monitor,
  X,
  Save,
  AlertTriangle,
  Eye,
  EyeOff,
} from "lucide-react";
import { toast } from "sonner";
import { updateUserPassword } from "@/modules/auth/actions/auth-actions";

type Session = {
  id: string;
  device: string;
  location: string;
  lastActive: string;
  current: boolean;
};

const MOCK_SESSIONS: Session[] = [
  {
    id: "1",
    device: "Chrome · Windows 11",
    location: "Ciudad de México · MX",
    lastActive: "Hace 2 minutos",
    current: true,
  },
  {
    id: "2",
    device: "Safari · iPhone 15",
    location: "Querétaro · MX",
    lastActive: "Ayer, 22:14",
    current: false,
  },
  {
    id: "3",
    device: "Firefox · macOS 14",
    location: "Ciudad de México · MX",
    lastActive: "Hace 3 días",
    current: false,
  },
];

type PasswordFieldName = "current" | "new" | "confirm";

const getPasswordStrength = (password: string) => {
  let score = 0;
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;
  return Math.min(score, 4);
};

const STRENGTH_LABEL: Record<number, string> = {
  0: "Débil",
  1: "Débil",
  2: "Media",
  3: "Media",
  4: "Fuerte",
};

const STRENGTH_BADGE_VARIANT: Record<number, "warning" | "success"> = {
  0: "warning",
  1: "warning",
  2: "warning",
  3: "warning",
  4: "success",
};

export function SecurityClient() {
  const [twoFactor, setTwoFactor] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);
  const [sessions, setSessions] = useState(MOCK_SESSIONS);
  const [newPasswordValue, setNewPasswordValue] = useState("");
  const [visibleFields, setVisibleFields] = useState<
    Record<PasswordFieldName, boolean>
  >({
    current: false,
    new: false,
    confirm: false,
  });

  const toggleVisibility = (field: PasswordFieldName) => {
    setVisibleFields((prev) => ({ ...prev, [field]: !prev[field] }));
  };

  const strength = getPasswordStrength(newPasswordValue);

  const handlePassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const currentPassword = fd.get("current") as string;
    const newPassword = fd.get("new") as string;
    const confirm = fd.get("confirm") as string;

    if (newPassword !== confirm) {
      toast.error("La confirmación no coincide con la nueva contraseña");
      return;
    }

    setPwLoading(true);
    const result = await updateUserPassword({ currentPassword, newPassword });
    setPwLoading(false);

    if (result.success) {
      toast.success("Contraseña actualizada");
      form.reset();
      setNewPasswordValue("");
    } else {
      toast.error(result.error);
    }
  };

  const revokeSession = (id: string) => {
    setSessions((s) => s.filter((x) => x.id !== id));
    toast.success("Sesión cerrada");
  };

  return (
    <div className="space-y-6">
      {/* Password */}
      <form
        onSubmit={handlePassword}
        className="rounded-xl border border-border bg-card shadow-sm"
      >
        <div className="border-b border-border p-6">
          <h3 className="flex items-center gap-2 font-headline text-base font-semibold text-foreground">
            <KeyRound className="size-4 text-muted-foreground" />
            Contraseña
          </h3>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Usa al menos 8 caracteres con una mezcla de mayúsculas, minúsculas,
            números y símbolos.
          </p>
        </div>

        <div className="grid gap-4 p-6 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="current">Contraseña actual</Label>
            <div className="relative">
              <Input
                id="current"
                name="current"
                type={visibleFields.current ? "text" : "password"}
                required
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => toggleVisibility("current")}
                aria-label={
                  visibleFields.current
                    ? "Ocultar contraseña actual"
                    : "Mostrar contraseña actual"
                }
                className="absolute inset-y-0 right-0 grid w-10 place-items-center text-muted-foreground transition-colors hover:text-foreground"
              >
                {visibleFields.current ? (
                  <EyeOff className="size-4" />
                ) : (
                  <Eye className="size-4" />
                )}
              </button>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new">Nueva contraseña</Label>
            <div className="relative">
              <Input
                id="new"
                name="new"
                type={visibleFields.new ? "text" : "password"}
                required
                minLength={8}
                value={newPasswordValue}
                onChange={(e) => setNewPasswordValue(e.target.value)}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => toggleVisibility("new")}
                aria-label={
                  visibleFields.new
                    ? "Ocultar nueva contraseña"
                    : "Mostrar nueva contraseña"
                }
                className="absolute inset-y-0 right-0 grid w-10 place-items-center text-muted-foreground transition-colors hover:text-foreground"
              >
                {visibleFields.new ? (
                  <EyeOff className="size-4" />
                ) : (
                  <Eye className="size-4" />
                )}
              </button>
            </div>
            {newPasswordValue.length > 0 && (
              <div className="space-y-1.5 pt-1">
                <div className="flex gap-1">
                  {[0, 1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className={`h-1.5 flex-1 rounded-full transition-colors ${
                        i < strength
                          ? strength === 4
                            ? "bg-[var(--success)]"
                            : "bg-[var(--warning)]"
                          : "bg-muted"
                      }`}
                    />
                  ))}
                </div>
                <Badge variant={STRENGTH_BADGE_VARIANT[strength]}>
                  {STRENGTH_LABEL[strength]}
                </Badge>
              </div>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirm">Confirmar nueva</Label>
            <div className="relative">
              <Input
                id="confirm"
                name="confirm"
                type={visibleFields.confirm ? "text" : "password"}
                required
                minLength={8}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => toggleVisibility("confirm")}
                aria-label={
                  visibleFields.confirm
                    ? "Ocultar confirmación de contraseña"
                    : "Mostrar confirmación de contraseña"
                }
                className="absolute inset-y-0 right-0 grid w-10 place-items-center text-muted-foreground transition-colors hover:text-foreground"
              >
                {visibleFields.confirm ? (
                  <EyeOff className="size-4" />
                ) : (
                  <Eye className="size-4" />
                )}
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border bg-muted/30 px-6 py-3.5">
          <Button type="submit" variant="brand" size="sm" disabled={pwLoading}>
            <Save className="size-4" />
            {pwLoading ? "Actualizando…" : "Actualizar contraseña"}
          </Button>
        </div>
      </form>

      {/* 2FA */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="grid size-10 place-items-center rounded-md bg-[var(--accent)] text-[var(--accent-foreground)]">
              <ShieldCheck className="size-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-headline text-base font-semibold text-foreground">
                  Autenticación de dos factores
                </h3>
                <Badge variant="secondary">Demo</Badge>
              </div>
              <p className="mt-1 max-w-xl text-[13px] text-muted-foreground">
                Añade una capa extra de seguridad pidiendo un código generado en
                tu dispositivo móvil al iniciar sesión.
              </p>
              {twoFactor && (
                <Badge variant="success" className="mt-2.5">
                  Activado
                </Badge>
              )}
            </div>
          </div>
          <Switch
            checked={twoFactor}
            onCheckedChange={(v) => {
              setTwoFactor(v);
              toast.success(v ? "2FA activado" : "2FA desactivado");
            }}
            aria-label="Activar 2FA"
          />
        </div>

        {!twoFactor && (
          <div className="mt-4 flex items-start gap-2.5 rounded-md border border-[var(--warning)]/30 bg-[var(--warning)]/8 p-3 text-[12.5px] text-[var(--warning)]">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <span>
              Te recomendamos activar 2FA. Las cuentas con permisos
              administrativos requerirán este factor próximamente.
            </span>
          </div>
        )}
      </div>

      {/* Sessions */}
      <div className="rounded-xl border border-border bg-card shadow-sm">
        <div className="border-b border-border p-6">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-headline text-base font-semibold text-foreground">
              Sesiones activas
            </h3>
            <Badge variant="secondary">Demo</Badge>
          </div>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Dispositivos donde tu cuenta está iniciada actualmente.
          </p>
        </div>

        <ul className="divide-y divide-border">
          {sessions.map((s) => {
            const isMobile = s.device.toLowerCase().includes("iphone");
            const Icon = isMobile ? Smartphone : Monitor;
            return (
              <li
                key={s.id}
                className="flex items-center justify-between gap-3 px-6 py-4"
              >
                <div className="flex items-center gap-3">
                  <div className="grid size-9 place-items-center rounded-md bg-muted text-muted-foreground">
                    <Icon className="size-[18px]" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[13.5px] font-semibold text-foreground">
                        {s.device}
                      </span>
                      {s.current && (
                        <Badge variant="success" className="text-[10px]">
                          Esta sesión
                        </Badge>
                      )}
                    </div>
                    <div className="text-[12px] text-muted-foreground">
                      {s.location} · {s.lastActive}
                    </div>
                  </div>
                </div>
                {!s.current && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => revokeSession(s.id)}
                  >
                    <X className="size-4" />
                    Cerrar
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
