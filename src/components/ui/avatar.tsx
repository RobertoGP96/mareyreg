import * as React from "react"
import * as AvatarPrimitive from "@radix-ui/react-avatar"

import { cn } from "@/lib/utils"

function Avatar({
  className,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Root>) {
  return (
    <AvatarPrimitive.Root
      data-slot="avatar"
      className={cn(
        "relative flex size-8 shrink-0 overflow-hidden rounded-full",
        className
      )}
      {...props}
    />
  )
}

function AvatarImage({
  className,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Image>) {
  return (
    <AvatarPrimitive.Image
      data-slot="avatar-image"
      className={cn("aspect-square size-full", className)}
      {...props}
    />
  )
}

function AvatarFallback({
  className,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Fallback>) {
  return (
    <AvatarPrimitive.Fallback
      data-slot="avatar-fallback"
      className={cn(
        "bg-muted flex size-full items-center justify-center rounded-full",
        className
      )}
      {...props}
    />
  )
}

function getInitials(name: string, max = 2): string {
  if (!name) return "··";
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, max)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

type AvatarInitialsProps = {
  name: string;
  size?: number;
  className?: string;
  /** Visual variant. "brand" uses the GR gradient. */
  variant?: "brand" | "muted";
};

function AvatarInitials({
  name,
  size = 32,
  className,
  variant = "brand",
}: AvatarInitialsProps) {
  const initials = getInitials(name);
  const fontSize = Math.max(10, Math.round(size * 0.36));
  return (
    <div
      data-slot="avatar-initials"
      className={cn(
        "grid place-items-center rounded-full font-semibold tracking-tight text-white shrink-0",
        variant === "brand"
          ? "bg-[linear-gradient(135deg,#1e3a8a_0%,#2563eb_50%,#60a5fa_100%)]"
          : "bg-muted text-foreground",
        className
      )}
      style={{ width: size, height: size, fontSize }}
      aria-label={name}
    >
      {initials}
    </div>
  );
}

export { Avatar, AvatarImage, AvatarFallback, AvatarInitials, getInitials }
