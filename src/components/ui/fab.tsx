"use client";

import * as React from "react";
import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  icon: LucideIcon;
  label: string;
  onClick?: () => void;
  /** Hide on md+ by default — set to false to keep visible. */
  mobileOnly?: boolean;
  className?: string;
};

export function Fab({
  icon: Icon,
  label,
  onClick,
  mobileOnly = true,
  className,
}: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={cn(
        "fixed right-5 z-40 grid place-items-center size-14 rounded-full",
        "bottom-[calc(var(--mobile-nav-h)+env(safe-area-inset-bottom)+0.75rem)] md:bottom-5",
        "bg-[linear-gradient(135deg,#1e3a8a_0%,#2563eb_50%,#60a5fa_100%)] text-white",
        "shadow-[0_12px_32px_-8px_rgba(37,99,235,0.55)] ring-1 ring-inset ring-white/15",
        "transition-all duration-200 hover:brightness-[1.05] hover:shadow-[0_16px_40px_-8px_rgba(37,99,235,0.65)]",
        "active:scale-[0.96] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--brand)]/30",
        "cursor-pointer",
        mobileOnly && "md:hidden",
        className
      )}
    >
      <Icon className="h-6 w-6" strokeWidth={2.4} />
      <span className="sr-only">{label}</span>
    </button>
  );
}
