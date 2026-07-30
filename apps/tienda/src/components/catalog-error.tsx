import { PackageSearch } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";

export function CatalogError({ retryHref }: { retryHref: string }) {
  return (
    <div className="anim-fade-up flex flex-1 flex-col items-center justify-center px-5 py-24 text-center md:px-10">
      <PackageSearch className="h-5 w-5 text-slate-400" strokeWidth={1.6} />
      <p className="eyebrow mt-6">Error de conexión</p>
      <p className="font-display mt-4 text-[26px] leading-none text-navy-900">
        No pudimos cargar el catálogo
      </p>
      <p className="mt-4 max-w-[380px] text-[13.5px] leading-[1.65] text-pretty text-slate-500">
        Algo falló al pedir los productos. Intenta de nuevo en unos segundos.
      </p>
      <ButtonLink href={retryHref} variant="outline" className="mt-7">
        Reintentar
      </ButtonLink>
    </div>
  );
}
