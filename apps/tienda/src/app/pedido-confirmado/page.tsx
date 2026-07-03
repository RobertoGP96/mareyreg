import Link from "next/link";

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

  return (
    <div className="grad-confirm flex flex-1 flex-col items-center justify-center gap-4 p-10 text-center text-white">
      <div className="flex h-[76px] w-[76px] items-center justify-center rounded-full bg-brand-light text-[32px]">
        ✓
      </div>
      <div className="text-[21px] font-bold">¡Pedido confirmado!</div>
      <div className="text-sm leading-[1.5] text-[#A9C4EC]">
        Tu pedido <span className="font-semibold text-white">{orderNo}</span>{" "}
        está en preparación.
        <br />
        Puedes seguirlo desde tu perfil.
      </div>
      <div className="mt-2.5 flex gap-2.5">
        <Link
          href="/perfil/pedidos"
          className="rounded-[13px] border border-white/20 bg-white/12 px-[22px] py-[13px] text-sm font-semibold text-white"
        >
          Ver pedido
        </Link>
        <Link
          href="/"
          className="rounded-[13px] bg-white px-[22px] py-[13px] text-sm font-semibold text-navy"
        >
          Volver al inicio
        </Link>
      </div>
    </div>
  );
}
