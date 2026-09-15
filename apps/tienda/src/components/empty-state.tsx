import type { LucideIcon } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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
  iconColor = "text-navy-700",
  eyebrow,
  title,
  description,
  ctaLabel,
  ctaHref,
}: EmptyStateProps) {
  return (
    <div className="anim-fade-up flex flex-1 flex-col items-center justify-center px-5 py-20 text-center md:px-10">
      <span className="flex h-[52px] w-[52px] items-center justify-center rounded-full bg-tint">
        <Icon className={cn("h-[22px] w-[22px]", iconColor)} strokeWidth={1.8} />
      </span>
      {eyebrow && <p className="eyebrow mt-5">{eyebrow}</p>}
      <p className="font-display mt-3.5 text-[22px] leading-tight text-navy-900">
        {title}
      </p>
      <p className="mt-3 max-w-[380px] text-[13.5px] leading-[1.65] text-pretty text-slate-500">
        {description}
      </p>
      {ctaLabel && ctaHref && (
        <ButtonLink href={ctaHref} variant="solid" className="mt-6">
          {ctaLabel}
        </ButtonLink>
      )}
    </div>
  );
}
