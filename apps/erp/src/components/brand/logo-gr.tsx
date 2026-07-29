import { cn } from "@/lib/utils";

export type LogoGRVariant = "v1" | "v2" | "v3" | "v4";

type LogoGRProps = {
  size?: number;
  /** kept for API compatibility (variants are not used by the SVG monogram) */
  variant?: LogoGRVariant;
  /** monochrome (white-on-transparent) — useful inside framed/gradient containers */
  mono?: boolean;
  /** dark surface variant (lighter strokes) */
  dark?: boolean;
  className?: string;
  ariaLabel?: string;
};

/**
 * GR Technology monogram — inline SVG.
 *
 * Replaces a previous reference to `/brand/gr-technology-mark.png` which was
 * missing from `public/brand/` and produced 404s. Inline SVG removes the
 * network dependency entirely and scales crisply at any size.
 */
export function LogoGR({
  size = 64,
  mono = false,
  dark = false,
  className,
  ariaLabel = "GR Technology",
}: LogoGRProps) {
  const id = "logo-gr-grad";

  // Color logic:
  //  - mono → solid white (used on dark/gradient frames)
  //  - dark surface → lighter brand
  //  - default → brand gradient
  const stroke = mono ? "#ffffff" : "url(#" + id + ")";
  const dotFill = mono ? "#ffffff" : dark ? "#60a5fa" : "#2563eb";
  const ringStroke = mono
    ? "rgba(255,255,255,0.35)"
    : dark
      ? "rgba(96,165,250,0.35)"
      : "rgba(37,99,235,0.25)";

  return (
    <svg
      role="img"
      aria-label={ariaLabel}
      width={size}
      height={size}
      viewBox="0 0 64 64"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("shrink-0", className)}
    >
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#1e3a8a" />
          <stop offset="50%" stopColor="#2563eb" />
          <stop offset="100%" stopColor="#60a5fa" />
        </linearGradient>
      </defs>

      {/* outer rounded ring */}
      <rect
        x="3"
        y="3"
        width="58"
        height="58"
        rx="14"
        ry="14"
        fill="none"
        stroke={ringStroke}
        strokeWidth="2"
      />

      {/* G — partial circle with terminal */}
      <path
        d="M28 18 A14 14 0 1 0 28 46 L28 36 L22 36"
        fill="none"
        stroke={stroke}
        strokeWidth="4.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* R — vertical, bowl, leg */}
      <path
        d="M36 46 L36 18 L44 18 A6 6 0 0 1 44 30 L36 30 M42 30 L48 46"
        fill="none"
        stroke={stroke}
        strokeWidth="4.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* accent dot */}
      <circle cx="52" cy="14" r="2.5" fill={dotFill} />
    </svg>
  );
}
