import Link from "next/link";
import { CheckCircle2 } from "lucide-react";

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
    <div className="grad-confirm flex flex-1 flex-col items-center justify-center gap-4 p-10 text-center text-white">
      <div className="anim-fade-up mx-auto flex w-full max-w-md flex-col items-center gap-4">
        <div className="flex h-[76px] w-[76px] items-center justify-center rounded-full bg-brand-light">
          <CheckCircle2 className="h-9 w-9" />
        </div>
        <div className="text-[21px] font-bold [animation-delay:60ms]">
          ¡Pedido confirmado!
        </div>
        <div className="text-sm leading-[1.5] text-[#A9C4EC] [animation-delay:120ms]">
          Tu pedido <span className="font-semibold text-white">{orderNo}</span>{" "}
          está en preparación.
          <br />
          {isAwaitingWeighing
            ? "Tu pedido se pesará al prepararlo; el total puede variar ligeramente."
            : "Puedes seguirlo desde tu perfil."}
        </div>
        <div className="mt-2.5 flex gap-2.5 [animation-delay:180ms]">
          <Link
            href="/perfil/pedidos"
            className="rounded-[13px] border border-white/20 bg-white/12 px-[22px] py-[13px] text-sm font-semibold text-white transition-colors hover:bg-white/20"
          >
            Ver pedido
          </Link>
          <Link
            href="/"
            className="rounded-[13px] bg-white px-[22px] py-[13px] text-sm font-semibold text-navy transition-colors hover:bg-app"
          >
            Volver al inicio
          </Link>
        </div>
      </div>
    </div>
  );
}
