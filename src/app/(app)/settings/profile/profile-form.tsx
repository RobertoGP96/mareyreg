"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AvatarInitials } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Camera,
  AtSign,
  UserRound,
  Save,
  ShieldCheck,
  Clock,
} from "lucide-react";
import { toast } from "sonner";
import { updateUserProfile } from "@/modules/auth/actions/auth-actions";

const ROLE_LABEL: Record<string, string> = {
  admin: "Administrador",
  dispatcher: "Despachador",
  viewer: "Observador",
};

type ProfileUser = {
  fullName: string;
  email: string;
  role: string;
  createdAt: string;
  lastLoginAt: string | null;
};

export function ProfileForm({ user }: { user: ProfileUser }) {
  const router = useRouter();
  const [fullName, setFullName] = useState(user.fullName);
  const [isLoading, setIsLoading] = useState(false);

  const dirty = fullName.trim() !== user.fullName.trim();

  const since = new Date(user.createdAt).toLocaleDateString("es-MX", {
    month: "long",
    year: "numeric",
  });

  const lastLogin = user.lastLoginAt
    ? new Date(user.lastLoginAt).toLocaleString("es-MX", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "Sin registro";

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!dirty) return;
    setIsLoading(true);
    const result = await updateUserProfile({ fullName });
    setIsLoading(false);
    if (result.success) {
      toast.success("Perfil actualizado");
      router.refresh();
    } else {
      toast.error(result.error);
    }
  };

  return (
    <div className="space-y-6">
      {/* Hero card with avatar + identity */}
      <div className="rounded-xl border border-border bg-gradient-to-br from-card to-muted/30 p-5 shadow-sm sm:p-6">
        <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:items-center sm:text-left sm:gap-5">
          <div className="relative shrink-0">
            <AvatarInitials name={fullName || "··"} size={72} />
            <button
              type="button"
              disabled
              title="Próximamente"
              aria-label="Cambiar foto (próximamente)"
              className="absolute -bottom-0.5 -right-0.5 grid size-7 cursor-not-allowed place-items-center rounded-full border-2 border-background bg-foreground/60 text-background opacity-70"
            >
              <Camera className="size-3.5" />
            </button>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
              <h2 className="font-headline text-xl font-bold tracking-tight text-foreground break-words">
                {fullName}
              </h2>
              <Badge variant="brand">
                <ShieldCheck className="size-3" />
                {ROLE_LABEL[user.role] ?? user.role}
              </Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground break-all">
              {user.email}
            </p>
            <p className="mt-2 text-[12px] text-muted-foreground">
              Miembro desde {since}
            </p>
          </div>
        </div>
      </div>

      {/* Account details (read-only) */}
      <div className="rounded-xl border border-border bg-card shadow-sm">
        <div className="border-b border-border p-6">
          <h3 className="font-headline text-base font-semibold text-foreground">
            Detalles de la cuenta
          </h3>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Información de solo lectura sobre tu cuenta.
          </p>
        </div>
        <dl className="divide-y divide-border">
          <div className="flex flex-col gap-1 px-6 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <dt className="text-[13px] text-muted-foreground">Rol</dt>
            <dd className="text-sm font-medium text-foreground">
              {ROLE_LABEL[user.role] ?? user.role}
            </dd>
          </div>
          <div className="flex flex-col gap-1 px-6 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <dt className="text-[13px] text-muted-foreground">Correo</dt>
            <dd className="text-sm font-medium text-foreground break-all sm:text-right">
              {user.email}
            </dd>
          </div>
          <div className="flex flex-col gap-1 px-6 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <dt className="text-[13px] text-muted-foreground">
              Miembro desde
            </dt>
            <dd className="text-sm font-medium text-foreground">{since}</dd>
          </div>
          <div className="flex flex-col gap-1 px-6 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <dt className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
              <Clock className="size-3.5" />
              Último acceso
            </dt>
            <dd className="text-sm font-medium text-foreground">
              {lastLogin}
            </dd>
          </div>
        </dl>
      </div>

      {/* Form */}
      <form
        onSubmit={handleSubmit}
        className="rounded-xl border border-border bg-card shadow-sm"
      >
        <div className="border-b border-border p-6">
          <h3 className="font-headline text-base font-semibold text-foreground">
            Información personal
          </h3>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Esta información aparece en tu perfil dentro del sistema.
          </p>
        </div>

        <div className="grid gap-5 p-6 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="fullName">
              <UserRound className="size-3.5 text-muted-foreground" />
              Nombre completo
            </Label>
            <Input
              id="fullName"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Tu nombre completo"
            />
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="email">
              <AtSign className="size-3.5 text-muted-foreground" />
              Correo electrónico
            </Label>
            <Input id="email" value={user.email} disabled />
            <p className="text-[11.5px] text-muted-foreground">
              El correo no se puede cambiar. Contacta a un administrador si
              necesitas migrar la cuenta.
            </p>
          </div>
        </div>

        <div
          className={`flex items-center justify-end gap-2 border-t border-border bg-muted/30 px-6 py-3.5 transition-colors md:static md:bg-muted/30 ${
            dirty ? "sticky bottom-0 bg-card md:bg-muted/30" : ""
          }`}
        >
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={!dirty || isLoading}
            onClick={() => setFullName(user.fullName)}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            variant="brand"
            size="sm"
            disabled={!dirty || isLoading}
          >
            <Save className="size-4" />
            {isLoading ? "Guardando…" : "Guardar cambios"}
          </Button>
        </div>
      </form>
    </div>
  );
}
