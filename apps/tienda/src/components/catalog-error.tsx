import Link from "next/link";
import { PackageSearch } from "lucide-react";

export function CatalogError({ retryHref }: { retryHref: string }) {
  return (
    <div className="anim-fade-up flex flex-1 flex-col items-center justify-center gap-3.5 p-10">
      <div className="flex h-16 w-16 items-center justify-center rounded-[20px] bg-chip text-brand">
        <PackageSearch className="h-7 w-7" />
      </div>
      <div className="text-[15px] font-semibold text-navy">
        No pudimos cargar el catálogo
      </div>
      <div className="text-center text-[13px] text-muted">
        No pudimos cargar el catálogo. Intenta de nuevo.
      </div>
      <Link
        href={retryHref}
        className="mt-1.5 rounded-xl bg-brand px-[22px] py-[11px] text-[13.5px] font-semibold text-white transition-colors hover:bg-brand-mid"
      >
        Reintentar
      </Link>
    </div>
  );
}
