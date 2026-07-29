import { Truck, Package, ShoppingBag } from "lucide-react";
import { LogoFull } from "@/components/brand/logo-full";

const FEATURES = [
  { icon: Truck, label: "Logística" },
  { icon: Package, label: "Inventario" },
  { icon: ShoppingBag, label: "Ventas" },
];

export function AuthBrandPanel() {
  return (
    <div className="hidden lg:flex relative overflow-hidden lg:w-[52%] xl:w-[55%] bg-[#020617]">
      {/* Color washes */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(37,99,235,0.5),transparent_55%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,rgba(96,165,250,0.25),transparent_60%)]" />
      <div className="pointer-events-none absolute inset-0 grid-pattern opacity-15" />

      {/* Blur orbs */}
      <div className="pointer-events-none absolute -top-20 -left-20 h-80 w-80 rounded-full bg-[rgba(37,99,235,0.25)] blur-[80px]" />
      <div className="pointer-events-none absolute bottom-10 right-10 h-64 w-64 rounded-full bg-[rgba(96,165,250,0.18)] blur-[80px]" />

      <div className="relative z-10 flex w-full flex-col justify-between p-10 xl:p-14 text-white">
        {/* Logo top */}
        <div className="flex items-center">
          <LogoFull
            size={200}
            priority
            className="h-auto w-[180px] xl:w-[200px] rounded-2xl ring-1 ring-white/10 drop-shadow-[0_8px_24px_rgba(37,99,235,0.35)]"
          />
        </div>

        {/* Hero content */}
        <div className="max-w-xl space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 backdrop-blur-sm">
            <span className="relative flex size-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#60a5fa] opacity-75" />
              <span className="relative inline-flex size-1.5 rounded-full bg-[#60a5fa]" />
            </span>
            <span className="text-[0.66rem] font-semibold uppercase tracking-[0.14em] text-white/85">
              Plataforma operativa
            </span>
          </div>

          <h1 className="font-headline text-4xl xl:text-5xl font-bold leading-[1.05] tracking-tight">
            Registra cada movimiento.
            <br />
            <span className="bg-gradient-to-br from-[#60a5fa] to-[#bfdbfe] bg-clip-text text-transparent">
              Controla tu operación.
            </span>
          </h1>

          <p className="max-w-md text-base text-white/60 leading-relaxed">
            Logística, pacas, inventario y ventas — integrados en un único
            sistema diseñado para empresas que mueven volumen.
          </p>

          <div className="grid max-w-md grid-cols-3 gap-2.5">
            {FEATURES.map((f) => (
              <div
                key={f.label}
                className="rounded-xl border border-white/10 bg-white/[0.04] p-3.5 backdrop-blur-sm transition-colors hover:bg-white/[0.07] hover:border-[#60a5fa]/30"
              >
                <div className="flex size-8 items-center justify-center rounded-lg bg-[rgba(37,99,235,0.18)] ring-1 ring-inset ring-[rgba(96,165,250,0.3)] text-[#93c5fd] mb-2">
                  <f.icon className="size-3.5" />
                </div>
                <div className="text-[13px] font-semibold text-white">
                  {f.label}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.16em] text-white/40">
          <span>© {new Date().getFullYear()} GR Technology</span>
          <span>v2.0</span>
        </div>
      </div>
    </div>
  );
}
