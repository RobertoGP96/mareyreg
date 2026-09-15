import { PackageSearch } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";

export function CatalogError({ retryHref }: { retryHref: string }) {
  return (
    <div className="anim-fade-up flex flex-1 flex-col items-center justify-center px-5 py-20 text-center md:px-10">
      <span className="flex h-[52px] w-[52px] items-center justify-center rounded-full bg-danger-soft text-danger">
        <PackageSearch className="h-[22px] w-[22px]" strokeWidth={1.8} />
      </span>
      <p className="eyebrow mt-5">Error de conexión</p>
      <p className="font-display mt-3.5 text-[22px] leading-tight text-navy-900">
        No pudimos cargar el catálogo
      </p>
      <p className="mt-3 max-w-[380px] text-[13.5px] leading-[1.65] text-pretty text-slate-500">
        Algo falló al pedir los productos. Intenta de nuevo en unos segundos.
      </p>
      <ButtonLink href={retryHref} variant="outline" className="mt-6">
        Reintentar
      </ButtonLink>
    </div>
  );
}
