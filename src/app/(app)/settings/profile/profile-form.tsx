"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AvatarInitials } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Camera, AtSign, UserRound, Save, ShieldCheck } from "lucide-react";
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
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <div className="relative">
            <AvatarInitials name={fullName || "··"} size={72} />
            <button
              type="button"
              className="absolute -bottom-0.5 -right-0.5 grid size-7 place-items-center rounded-full border-2 border-background bg-foreground text-background transition-colors hover:bg-foreground/90"
              title="Cambiar foto"
              aria-label="Cambiar foto"
            >
              <Camera className="size-3.5" />
            </button>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-headline text-xl font-bold tracking-tight text-foreground">
                {fullName}
              </h2>
              <Badge variant="brand">
                <ShieldCheck className="size-3" />
                {ROLE_LABEL[user.role] ?? user.role}
              </Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{user.email}</p>
            <p className="mt-2 text-[12px] text-muted-foreground">
              Miembro desde {since}
            </p>
          </div>
        </div>
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

        <div className="flex items-center justify-end gap-2 border-t border-border bg-muted/30 px-6 py-3.5">
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
