import { useId } from "react";
import { cn } from "@/lib/utils";

type SparkProps = {
  data: number[];
  /** Stroke and gradient color. Use a CSS color or var(--token). */
  color?: string;
  height?: number;
  strokeWidth?: number;
  className?: string;
  /** If true, fills the area below the line with a soft gradient. */
  filled?: boolean;
};

export function Spark({
  data,
  color = "var(--brand)",
  height = 36,
  strokeWidth = 1.5,
  className,
  filled = true,
}: SparkProps) {
  const id = useId().replace(/:/g, "");

  if (!data.length) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const w = 100;
  const h = height;
  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * w;
      const y = h - ((v - min) / range) * h;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      className={cn("block w-full", className)}
      style={{ height }}
      aria-hidden
    >
      {filled && (
        <defs>
          <linearGradient id={`sp-${id}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.25" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
      )}
      {filled && (
        <polyline
          points={`0,${h} ${points} ${w},${h}`}
          fill={`url(#sp-${id})`}
          stroke="none"
        />
      )}
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
