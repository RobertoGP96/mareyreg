import Link from "next/link";
import type { ReactNode } from "react";

interface ScreenHeaderProps {
  title: string;
  backHref?: string;
  children?: ReactNode;
}

export function ScreenHeader({ title, backHref, children }: ScreenHeaderProps) {
  return (
    <div className="grad-header rounded-b-[22px] px-5 py-[18px] text-white">
      <div className="flex items-center gap-3">
        {backHref && (
          <Link href={backHref} aria-label="Volver" className="text-base">
            ←
          </Link>
        )}
        <div className="text-[17px] font-bold">{title}</div>
      </div>
      {children}
    </div>
  );
}
