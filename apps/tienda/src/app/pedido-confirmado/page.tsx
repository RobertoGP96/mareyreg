import { ButtonLink } from "@/components/ui/button";
import { Check } from "lucide-react";

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
    <div className="flex flex-1 flex-col items-center justify-center px-5 py-24 text-center md:px-10">
      <div className="anim-fade-up w-full max-w-[460px]">
        <p className="eyebrow">Pedido recibido</p>
        <h1 className="font-display mt-5 text-[42px] leading-none text-navy-900 md:text-[52px]">
          Gracias por tu compra
        </h1>

        {orderNo && (
          <div className="mt-9 flex items-center justify-center gap-2.5 border-y border-line py-4">
            <Check className="h-5 w-5 flex-none text-ok" strokeWidth={1.6} />
            <span className="tabular text-[15px] font-semibold text-ink">
              {orderNo}
            </span>
          </div>
        )}

        <p className="mt-7 text-[13.5px] leading-[1.65] text-pretty text-slate-500">
          {isAwaitingWeighing
            ? "Tu pedido incluye productos de peso variable: se pesará al prepararlo y el total puede variar ligeramente."
            : "Tu pedido está en preparación. Puedes seguirlo desde tu perfil."}
        </p>

        <div className="mt-10 flex flex-col items-center gap-6 sm:flex-row sm:justify-center sm:gap-9">
          <ButtonLink
            href="/perfil/pedidos"
            variant="solid"
            size="lg"
            className="w-full sm:w-auto"
          >
            Ver pedido
          </ButtonLink>
          <ButtonLink href="/">Volver al inicio</ButtonLink>
        </div>
      </div>
    </div>
  );
}
