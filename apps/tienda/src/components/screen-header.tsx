import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";

interface ScreenHeaderProps {
  title: string;
  eyebrow?: string;
  backHref?: string;
  children?: ReactNode;
}

/** Cabecera de pantalla interior. Va dentro del ancho de página (1120px) y
 *  sin fondo propio: la página es crema y las cards blancas ponen el contraste. */
export function ScreenHeader({
  title,
  eyebrow,
  backHref,
  children,
}: ScreenHeaderProps) {
  return (
    <div className="mx-auto w-full max-w-[1120px] px-5 pt-7 pb-5 md:px-6 md:pt-9 md:pb-6">
      {backHref && (
        <Link
          href={backHref}
          className="nav-label -ml-1 inline-flex items-center gap-0.5 text-slate-500 transition-colors duration-150 hover:text-navy-700"
        >
          <ChevronLeft className="h-4 w-4" strokeWidth={2} />
          Volver
        </Link>
      )}

      <div
        className={cn(
          "flex flex-col gap-4 md:flex-row md:items-end md:justify-between md:gap-8",
          backHref && "mt-4"
        )}
      >
        <div className="min-w-0">
          {eyebrow && <p className="eyebrow">{eyebrow}</p>}
          <h1
            className={cn(
              "font-display text-[26px] leading-[1.05] text-navy-900 md:text-[32px]",
              eyebrow && "mt-2"
            )}
          >
            {title}
          </h1>
        </div>
        {children && (
          <div className="flex flex-wrap items-center gap-3 md:justify-end">
            {children}
          </div>
        )}
      </div>
    </div>
  );
}
