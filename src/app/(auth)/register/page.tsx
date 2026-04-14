import { redirect } from "next/navigation";
import { RegisterForm } from "@/modules/auth/components/register-form";
import { getUserCount } from "@/modules/auth/queries/user-queries";
import { Crown } from "lucide-react";

export default async function RegisterPage() {
  const count = await getUserCount();
  if (count > 0) {
    redirect("/login");
  }

  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex flex-col items-center gap-3 mb-6">
          <div className="relative flex size-16 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-[var(--brand)] to-amber-700 shadow-[0_12px_32px_-6px_color-mix(in_oklch,var(--brand)_55%,transparent)]">
            <img src="/truck-white.svg" alt="MAREYway" className="size-8 relative z-10" />
            <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-white/25" />
          </div>
          <div className="text-center">
            <h1 className="roadway-font text-2xl font-bold tracking-wider text-foreground">
              MAREYWAY
            </h1>
            <p className="text-[0.68rem] uppercase tracking-[0.22em] text-muted-foreground">
              Sistema de Gestión
            </p>
          </div>
        </div>

        {/* Card */}
        <div className="relative overflow-hidden rounded-2xl border border-border bg-card shadow-elevated">
          {/* Accent wash */}
          <div className="pointer-events-none absolute -top-20 -right-20 h-48 w-48 rounded-full bg-[var(--brand)]/15 blur-3xl" />

          <div className="relative p-6 md:p-8">
            <div className="mb-6">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-[var(--brand)]/10 px-2.5 py-0.5 mb-3 ring-1 ring-inset ring-[var(--brand)]/20">
                <Crown className="h-3 w-3 text-[var(--brand)]" />
                <span className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-[var(--brand)]">
                  Configuración inicial
                </span>
              </div>
              <h2 className="text-xl font-bold font-headline tracking-tight text-foreground">
                Crear administrador
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Configura el primer usuario con acceso total al sistema.
              </p>
            </div>

            <RegisterForm />
          </div>
        </div>

        <p className="mt-6 text-[0.72rem] text-center text-muted-foreground/70">
          &copy; {new Date().getFullYear()} MAREYway · Sistema de Gestión
        </p>
      </div>
    </div>
  );
}
