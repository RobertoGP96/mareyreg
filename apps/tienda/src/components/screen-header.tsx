import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronLeft } from "lucide-react";

interface ScreenHeaderProps {
  title: string;
  eyebrow?: string;
  backHref?: string;
  children?: ReactNode;
}

export function ScreenHeader({
  title,
  eyebrow,
  backHref,
  children,
}: ScreenHeaderProps) {
  return (
    <div className="border-b border-line bg-canvas px-5 pt-10 pb-8 md:px-10">
      {backHref && (
        <Link
          href={backHref}
          className="nav-label -ml-0.5 inline-flex items-center gap-1 text-slate-400 transition-colors duration-150 hover:text-navy-900"
        >
          <ChevronLeft className="h-4 w-4" strokeWidth={1.6} />
          Volver
        </Link>
      )}

      <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between md:gap-8">
        <div className={backHref ? "mt-5" : undefined}>
          {eyebrow && <p className="eyebrow">{eyebrow}</p>}
          <h1
            className={`font-display text-[32px] leading-none text-navy-900 md:text-[42px] ${
              eyebrow ? "mt-4" : ""
            }`}
          >
            {title}
          </h1>
        </div>
        {children && (
          <div className="flex flex-wrap items-center gap-5 md:justify-end">
            {children}
          </div>
        )}
      </div>
    </div>
  );
}
