import { LogoGR } from "./logo-gr";
import { cn } from "@/lib/utils";

type LogoWordmarkProps = {
  size?: number;
  dark?: boolean;
  mono?: boolean;
  className?: string;
  /** Si true, envuelve el logo en un contenedor con gradient brand */
  framed?: boolean;
  /** Tagline bajo el nombre. Pasa "" para ocultarla. */
  tagline?: string;
};

export function LogoWordmark({
  size = 40,
  dark = false,
  mono = false,
  className,
  framed = false,
  tagline = "Soluciones que avanzan contigo",
}: LogoWordmarkProps) {
  const nameSize = Math.round(size * 0.46);
  const taglineSize = Math.max(10, Math.round(size * 0.22));

  return (
    <div className={cn("inline-flex items-center gap-3", className)}>
      {framed ? (
        <div
          className="relative grid place-items-center rounded-xl bg-gradient-brand shadow-[0_8px_24px_-8px_rgba(37,99,235,0.6)]"
          style={{ width: size + 12, height: size + 12 }}
        >
          <LogoGR size={size - 4} mono dark />
        </div>
      ) : (
        <LogoGR size={size} mono={mono} dark={dark} />
      )}

      <div className="leading-tight">
        <div
          className="font-headline font-bold tracking-tight"
          style={{
            fontSize: nameSize,
            color: dark ? "#f1f5f9" : "#0f172a",
            letterSpacing: "-0.01em",
          }}
        >
          GR Technology
        </div>
        {tagline && (
          <div
            className="font-medium uppercase"
            style={{
              fontSize: taglineSize,
              letterSpacing: "0.18em",
              color: dark ? "rgba(255,255,255,0.5)" : "#64748b",
              marginTop: 2,
            }}
          >
            {tagline}
          </div>
        )}
      </div>
    </div>
  );
}
