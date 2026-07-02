import { redirect } from "next/navigation";
import { RegisterForm } from "@/modules/auth/components/register-form";
import { getUserCount } from "@/modules/auth/queries/user-queries";
import { AuthBrandPanel } from "../_components/auth-brand-panel";
import { LogoFull } from "@/components/brand/logo-full";
import { Crown } from "lucide-react";

export default async function RegisterPage() {
  const count = await getUserCount();
  if (count > 0) {
    redirect("/login");
  }

  return (
    <div className="flex flex-1 items-stretch min-h-screen w-full">
      <AuthBrandPanel />

      {/* Right · form */}
      <div className="flex flex-1 flex-col items-center justify-center p-6 md:p-10">
        {/* Mobile logo */}
        <div className="lg:hidden mb-8">
          <LogoFull size={180} priority className="h-auto w-[160px] rounded-2xl" />
        </div>

        <div className="w-full max-w-[420px]">
          <div className="mb-6">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-[var(--accent)] px-2.5 py-0.5 mb-3.5 ring-1 ring-inset ring-[var(--brand)]/20">
              <Crown className="h-3 w-3 text-[var(--accent-foreground)]" />
              <span className="text-[0.66rem] font-semibold uppercase tracking-[0.12em] text-[var(--accent-foreground)]">
                Configuración inicial
              </span>
            </div>
            <h2 className="font-headline text-[28px] font-bold leading-[1.1] tracking-tight text-foreground">
              Crear cuenta
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Completa los datos para activar el primer acceso administrador.
            </p>
          </div>

          <RegisterForm />

          <p className="mt-5 text-[0.78rem] text-center text-muted-foreground">
            ¿Ya tienes cuenta?{" "}
            <a
              href="/login"
              className="font-semibold text-[var(--brand)] hover:underline"
            >
              Iniciar sesión
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
