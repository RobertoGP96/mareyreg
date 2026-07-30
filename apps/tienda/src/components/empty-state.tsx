import type { LucideIcon } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";

interface EmptyStateProps {
  icon: LucideIcon;
  iconColor?: string;
  eyebrow?: string;
  title: string;
  description: string;
  ctaLabel?: string;
  ctaHref?: string;
}

export function EmptyState({
  icon: Icon,
  iconColor = "text-slate-400",
  eyebrow,
  title,
  description,
  ctaLabel,
  ctaHref,
}: EmptyStateProps) {
  return (
    <div className="anim-fade-up flex flex-1 flex-col items-center justify-center px-5 py-24 text-center md:px-10">
      <Icon className={`h-5 w-5 ${iconColor}`} strokeWidth={1.6} />
      {eyebrow && <p className="eyebrow mt-6">{eyebrow}</p>}
      <p className="font-display mt-4 text-[26px] leading-none text-navy-900">
        {title}
      </p>
      <p className="mt-4 max-w-[380px] text-[13.5px] leading-[1.65] text-pretty text-slate-500">
        {description}
      </p>
      {ctaLabel && ctaHref && (
        <ButtonLink href={ctaHref} className="mt-7">
          {ctaLabel}
        </ButtonLink>
      )}
    </div>
  );
}
