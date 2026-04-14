import { Suspense } from "react";
import { LoginForm } from "@/modules/auth/components/login-form";
import { ShieldCheck, Truck, Package, Route as RouteIcon, CheckCircle2 } from "lucide-react";

export default function LoginPage() {
  return (
    <div className="flex-1 flex items-stretch min-h-screen">
      {/* ========== LEFT · Brand hero (hidden en móvil) ========== */}
      <div className="hidden lg:flex lg:w-[52%] xl:w-[55%] relative overflow-hidden">
        {/* Background oscuro */}
        <div className="absolute inset-0 bg-[var(--sidebar)]" />

        {/* Color washes */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,color-mix(in_oklch,var(--brand)_35%,transparent),transparent_55%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,color-mix(in_oklch,#2563eb_20%,transparent),transparent_60%)]" />
        <div className="absolute inset-0 grid-pattern opacity-20" />

        {/* Orbs */}
        <div className="absolute -top-20 -left-20 h-80 w-80 rounded-full bg-[var(--brand)]/20 blur-3xl" />
        <div className="absolute bottom-10 right-10 h-64 w-64 rounded-full bg-blue-500/15 blur-3xl" />

        <div className="relative z-10 flex flex-col justify-between p-10 xl:p-14 text-white w-full">
          {/* Logo top */}
          <div className="flex items-center gap-3">
            <div className="relative flex size-11 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-[var(--brand)] to-amber-700 shadow-[0_8px_24px_-4px_color-mix(in_oklch,var(--brand)_50%,transparent)]">
              <img src="/truck-white.svg" alt="MAREYreg" className="size-6 relative z-10" />
              <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-white/25" />
            </div>
            <div>
              <div className="roadway-font text-xl font-bold tracking-wider">MAREYREG</div>
              <div className="text-[0.62rem] uppercase tracking-[0.22em] text-white/50">
                Sistema de Gestión
              </div>
            </div>
          </div>

          {/* Center content */}
          <div className="space-y-8 max-w-xl">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 backdrop-blur-sm">
                <span className="relative flex size-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--brand)] opacity-75" />
                  <span className="relative inline-flex size-1.5 rounded-full bg-[var(--brand)]" />
                </span>
                <span className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-white/80">
                  Plataforma logística
                </span>
              </div>

              <h1 className="text-4xl xl:text-5xl font-bold font-headline leading-[1.1] tracking-tight">
                Control total de tu
                <br />
                <span className="text-gradient-brand">operación diaria.</span>
              </h1>

              <p className="text-base xl:text-lg text-white/60 leading-relaxed max-w-lg">
                Flota, inventario, pacas y logística — integrados en un solo sistema hecho para mover tu negocio.
              </p>
            </div>

            {/* Feature highlights */}
            <div className="grid grid-cols-3 gap-3 max-w-lg">
              {[
                { icon: Truck,    label: "Flota" },
                { icon: Package,  label: "Inventario" },
                { icon: RouteIcon, label: "Logística" },
              ].map((f) => (
                <div
                  key={f.label}
                  className="flex flex-col items-start gap-2 rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm transition-colors hover:border-[var(--brand)]/40 hover:bg-white/[0.07]"
                >
                  <div className="flex size-9 items-center justify-center rounded-lg bg-[var(--brand)]/15 ring-1 ring-inset ring-[var(--brand)]/25">
                    <f.icon className="h-4 w-4 text-[var(--brand)]" />
                  </div>
                  <div className="text-sm font-semibold text-white/90">{f.label}</div>
                </div>
              ))}
            </div>

            {/* Bullets */}
            <ul className="space-y-2">
              {[
                "Trazabilidad en tiempo real",
                "Control granular de usuarios y roles",
                "Reportes operacionales centralizados",
              ].map((b) => (
                <li key={b} className="flex items-center gap-2.5 text-sm text-white/70">
                  <CheckCircle2 className="h-4 w-4 text-[var(--brand)] shrink-0" />
                  {b}
                </li>
              ))}
            </ul>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between text-[0.72rem] text-white/40">
            <span className="uppercase tracking-[0.16em]">
              &copy; {new Date().getFullYear()} MAREYreg
            </span>
            <span className="uppercase tracking-[0.16em]">v1.0</span>
          </div>
        </div>
      </div>

      {/* ========== RIGHT · Form ========== */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 md:p-10">
        {/* Logo mobile */}
        <div className="lg:hidden mb-8 flex flex-col items-center gap-3">
          <div className="relative flex size-14 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-[var(--brand)] to-amber-700 shadow-[0_8px_24px_-4px_color-mix(in_oklch,var(--brand)_50%,transparent)]">
            <img src="/truck-white.svg" alt="MAREYreg" className="size-7 relative z-10" />
            <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-white/25" />
          </div>
          <div className="text-center">
            <h1 className="roadway-font text-2xl font-bold tracking-wider text-foreground">
              MAREYREG
            </h1>
            <p className="text-[0.68rem] uppercase tracking-[0.22em] text-muted-foreground">
              Sistema de Gestión
            </p>
          </div>
        </div>

        <div className="w-full max-w-sm">
          <div className="mb-6">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-[var(--brand)]/10 px-2.5 py-0.5 mb-3 ring-1 ring-inset ring-[var(--brand)]/20">
              <ShieldCheck className="h-3 w-3 text-[var(--brand)]" />
              <span className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-[var(--brand)]">
                Acceso seguro
              </span>
            </div>
            <h2 className="text-2xl font-bold font-headline tracking-tight text-foreground">
              Iniciar sesión
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Ingresa tus credenciales para continuar.
            </p>
          </div>

          <Suspense>
            <LoginForm />
          </Suspense>

          <p className="mt-8 text-[0.72rem] text-center text-muted-foreground/70 leading-relaxed">
            El acceso no autorizado es estrictamente monitoreado y registrado.
          </p>
        </div>
      </div>
    </div>
  );
}
