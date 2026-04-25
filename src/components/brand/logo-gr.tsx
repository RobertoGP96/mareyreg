"use client";

import { useId } from "react";
import { cn } from "@/lib/utils";

export type LogoGRVariant = "v1" | "v2" | "v3" | "v4";

type LogoGRProps = {
  size?: number;
  variant?: LogoGRVariant;
  mono?: boolean;
  dark?: boolean;
  className?: string;
  ariaLabel?: string;
};

type Stop = { o: number; c: string };

function getStops(mono: boolean, dark: boolean): Stop[] {
  if (mono) {
    const c = dark ? "#f1f5f9" : "#0f172a";
    return [
      { o: 0, c },
      { o: 1, c },
    ];
  }
  return [
    { o: 0, c: "#1e3a8a" },
    { o: 0.5, c: "#2563eb" },
    { o: 1, c: "#60a5fa" },
  ];
}

function V1({ gradId }: { gradId: string }) {
  const stroke = `url(#${gradId})`;
  return (
    <>
      {/* G */}
      <path
        d="M 38 22 L 18 22 Q 10 22 10 30 L 10 70 Q 10 78 18 78 L 38 78 Q 46 78 46 70 L 46 52 L 28 52"
        stroke={stroke}
        strokeWidth="9"
        strokeLinecap="square"
        strokeLinejoin="miter"
      />
      <path
        d="M 35 12 L 45 22 L 35 32"
        stroke={stroke}
        strokeWidth="9"
        strokeLinecap="square"
        fill="none"
      />
      {/* R */}
      <path
        d="M 56 78 L 56 22 L 78 22 Q 90 22 90 35 Q 90 48 78 48 L 56 48"
        stroke={stroke}
        strokeWidth="9"
        strokeLinecap="square"
        strokeLinejoin="miter"
      />
      <path
        d="M 70 48 L 90 78"
        stroke={stroke}
        strokeWidth="9"
        strokeLinecap="square"
      />
      <path
        d="M 80 70 L 92 80 L 80 90"
        stroke={stroke}
        strokeWidth="9"
        strokeLinecap="square"
        fill="none"
      />
    </>
  );
}

function V2({ gradId }: { gradId: string }) {
  const fill = `url(#${gradId})`;
  return (
    <>
      {/* G — solid silhouette */}
      <path
        fill={fill}
        d="M10 28 Q10 16 22 16 L42 16 L42 28 L22 28 L22 72 L36 72 L36 56 L28 56 L28 46 L46 46 L46 84 L22 84 Q10 84 10 72 Z"
      />
      {/* G arrow */}
      <path fill={fill} d="M44 16 L52 16 L52 8 L66 22 L52 36 L52 28 L44 28 Z" />
      {/* R */}
      <path
        fill={fill}
        d="M56 16 L78 16 Q92 16 92 32 Q92 44 80 48 L92 84 L80 84 L70 52 L66 52 L66 84 L56 84 Z M66 28 L66 42 L76 42 Q80 42 80 35 Q80 28 76 28 Z"
        fillRule="evenodd"
      />
      {/* R arrow */}
      <path fill={fill} d="M82 76 L90 76 L90 68 L100 82 L90 96 L90 88 L82 88 Z" />
    </>
  );
}

function V3({ gradId }: { gradId: string }) {
  const stroke = `url(#${gradId})`;
  return (
    <>
      {/* G */}
      <path
        d="M 42 22 L 22 22 Q 12 22 12 32 L 12 68 Q 12 78 22 78 L 36 78 Q 46 78 46 68 L 46 50 L 30 50"
        stroke={stroke}
        strokeWidth="10"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M 40 44 L 56 50 L 40 56"
        stroke={stroke}
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      {/* R */}
      <path
        d="M 60 78 L 60 22 L 80 22 Q 90 22 90 32 Q 90 42 80 42 L 60 42 M 78 42 L 90 78"
        stroke={stroke}
        strokeWidth="10"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M 84 70 L 96 82 L 84 94"
        stroke={stroke}
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </>
  );
}

function V4({ gradId }: { gradId: string }) {
  const stroke = `url(#${gradId})`;
  return (
    <g transform="skewX(-10)">
      {/* G */}
      <path
        d="M 50 22 L 28 22 Q 18 22 18 32 L 18 68 Q 18 78 28 78 L 42 78 Q 52 78 52 68 L 52 52 L 36 52"
        stroke={stroke}
        strokeWidth="9"
        strokeLinecap="square"
        strokeLinejoin="miter"
      />
      <path d="M 48 22 L 70 22" stroke={stroke} strokeWidth="9" strokeLinecap="square" />
      <path
        d="M 64 14 L 74 22 L 64 30"
        stroke={stroke}
        strokeWidth="9"
        strokeLinecap="square"
        fill="none"
      />
      {/* R */}
      <path
        d="M 60 78 L 60 22 L 78 22 Q 88 22 88 35 Q 88 48 78 48 L 60 48 M 76 48 L 88 78"
        stroke={stroke}
        strokeWidth="9"
        strokeLinecap="square"
        strokeLinejoin="miter"
      />
      <path d="M 82 70 L 96 84" stroke={stroke} strokeWidth="9" strokeLinecap="square" />
      <path
        d="M 88 86 L 98 86 L 98 76"
        stroke={stroke}
        strokeWidth="9"
        strokeLinecap="square"
        fill="none"
      />
    </g>
  );
}

export function LogoGR({
  size = 64,
  variant = "v1",
  mono = false,
  dark = false,
  className,
  ariaLabel = "GrayRegistration",
}: LogoGRProps) {
  const reactId = useId();
  const gradId = `lg-gr-${variant}-${reactId.replace(/:/g, "")}`;
  const stops = getStops(mono, dark);

  const Variant = { v1: V1, v2: V2, v3: V3, v4: V4 }[variant];

  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      fill="none"
      role="img"
      aria-label={ariaLabel}
      className={cn("shrink-0", className)}
    >
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
          {stops.map((s, i) => (
            <stop key={i} offset={`${s.o * 100}%`} stopColor={s.c} />
          ))}
        </linearGradient>
      </defs>
      <Variant gradId={gradId} />
    </svg>
  );
}
