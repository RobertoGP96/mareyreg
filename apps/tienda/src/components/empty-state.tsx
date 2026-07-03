import Link from "next/link";

interface EmptyStateProps {
  icon: string;
  iconColor?: string;
  title: string;
  description: string;
  ctaLabel?: string;
  ctaHref?: string;
}

export function EmptyState({
  icon,
  iconColor = "text-brand",
  title,
  description,
  ctaLabel,
  ctaHref,
}: EmptyStateProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3.5 p-10">
      <div
        className={`flex h-16 w-16 items-center justify-center rounded-[20px] bg-chip text-[26px] ${iconColor}`}
      >
        {icon}
      </div>
      <div className="text-[15px] font-semibold text-navy">{title}</div>
      <div className="text-center text-[13px] text-muted">{description}</div>
      {ctaLabel && ctaHref && (
        <Link
          href={ctaHref}
          className="mt-1.5 rounded-xl bg-brand px-[22px] py-[11px] text-[13.5px] font-semibold text-white"
        >
          {ctaLabel}
        </Link>
      )}
    </div>
  );
}
