import Image from "next/image";
import { cn } from "@/lib/utils";

type LogoFullProps = {
  size?: number;
  priority?: boolean;
  className?: string;
};

export function LogoFull({
  size = 320,
  priority = false,
  className,
}: LogoFullProps) {
  return (
    <Image
      src="/brand/gr-technology-logo.png"
      alt="GR Technology — Soluciones que avanzan contigo"
      width={size}
      height={size}
      priority={priority}
      className={cn("select-none", className)}
    />
  );
}
