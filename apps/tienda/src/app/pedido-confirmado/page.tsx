import { ButtonLink } from "@/components/ui/button";
import { Check, Package } from "lucide-react";

export const dynamic = "force-dynamic";

interface ConfirmationPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ConfirmationPage({
  searchParams,
}: ConfirmationPageProps) {
  const params = await searchParams;
  const raw = params.no;
  const orderNo = (Array.isArray(raw) ? raw[0] : raw) ?? "";
  const rawStatus = params.status;
  const status = Array.isArray(rawStatus) ? rawStatus[0] : rawStatus;
  const isAwaitingWeighing = status === "awaiting_weighing";

  return (
    <div className="mx-auto w-full max-w-[460px] px-5 py-12 md:py-16">
      <div className="anim-fade-up rounded-lg bg-canvas p-8 text-center shadow-card">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-ok-soft text-ok">
          <Check className="h-6 w-6" strokeWidth={2} />
        </span>
        <p className="eyebrow mt-6">Pedido recibido</p>
        <h1 className="font-display mt-3 text-[26px] leading-[1.05] text-navy-900 md:text-[30px]">
          Gracias por tu compra
        </h1>

        <p className="mt-3 text-[13.5px] leading-[1.65] text-pretty text-slate-500">
          {isAwaitingWeighing
            ? "Tu pedido incluye productos de peso variable: se pesará al prepararlo y el total puede variar ligeramente."
            : "Tu pedido está en preparación. Puedes seguirlo desde tu perfil."}
        </p>

        {orderNo && (
          <div className="tabular mt-6 inline-flex items-center gap-2 rounded-full bg-page px-4 py-2 text-[14px] font-semibold text-ink">
            <Package
              className="h-4 w-4 flex-none text-slate-400"
              strokeWidth={1.8}
            />
            {orderNo}
          </div>
        )}

        <div className="mt-7 flex flex-col gap-3">
          <ButtonLink
            href="/perfil/pedidos"
            variant="solid"
            size="lg"
            className="w-full"
          >
            Ver pedido
          </ButtonLink>
          <ButtonLink href="/" className="w-full">
            Volver al inicio
          </ButtonLink>
        </div>
      </div>
    </div>
  );
}
