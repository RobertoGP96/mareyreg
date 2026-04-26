import { Suspense } from "react";
import { LoginForm } from "@/modules/auth/components/login-form";
import { AuthBrandPanel } from "../_components/auth-brand-panel";
import { LogoFull } from "@/components/brand/logo-full";
import { ShieldCheck } from "lucide-react";
import { isGoogleAuthEnabled } from "@/lib/auth";

export default function LoginPage() {
  return (
    <div className="flex flex-1 items-stretch min-h-screen w-full">
      <AuthBrandPanel />

      {/* Right · form */}
      <div className="flex flex-1 flex-col items-center justify-center p-6 md:p-10">
        {/* Mobile logo */}
        <div className="lg:hidden mb-8">
          <LogoFull size={180} priority className="h-auto w-[160px] rounded-2xl" />
        </div>

        <div className="w-full max-w-[380px]">
          <div className="mb-7">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-[var(--accent)] px-2.5 py-0.5 mb-3.5 ring-1 ring-inset ring-[var(--brand)]/20">
              <ShieldCheck className="h-3 w-3 text-[var(--accent-foreground)]" />
              <span className="text-[0.66rem] font-semibold uppercase tracking-[0.12em] text-[var(--accent-foreground)]">
                Acceso seguro
              </span>
            </div>
            <h2 className="font-headline text-[28px] font-bold leading-[1.1] tracking-tight text-foreground">
              Iniciar sesión
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Ingresa tus credenciales para continuar.
            </p>
          </div>

          <Suspense>
            <LoginForm googleEnabled={isGoogleAuthEnabled} />
          </Suspense>

          <p className="mt-6 text-[0.78rem] text-center text-muted-foreground">
            ¿Necesitas acceso?{" "}
            <a
              href="#"
              className="font-semibold text-[var(--brand)] hover:underline"
            >
              Contacta al administrador
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
