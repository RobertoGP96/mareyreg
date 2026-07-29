"use client";

import type { ReactNode } from "react";

// Bloques para descripciones JSX de toasts (se renderizan dentro de
// [data-sileo-description]). Sileo aplica su propia tipografía, por eso
// los overrides llevan el modificador "!" de Tailwind. El pill usa la
// superficie popover del tema (globals.css): el énfasis va con
// text-foreground y lo secundario hereda el muted-foreground que
// globals.css fija para la descripción. Mantener el contenido corto:
// el toast colapsa a pill y expande unos segundos.

export function ToastLines({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-1">{children}</div>;
}

export function ToastDetail({
  label,
  value,
  mono = false,
}: {
  label: ReactNode;
  value: ReactNode;
  mono?: boolean;
}) {
  return (
    <span className="flex items-baseline justify-between gap-3 text-xs!">
      <span>{label}</span>
      <span
        className={
          mono ? "font-mono tabular-nums text-foreground!" : "text-foreground!"
        }
      >
        {value}
      </span>
    </span>
  );
}

export function ToastDelta({ from, to }: { from: string; to: string }) {
  return (
    <span className="flex items-center gap-1.5 font-mono tabular-nums text-xs!">
      <span className="line-through">{from}</span>
      <span aria-hidden>→</span>
      <span className="font-semibold text-foreground!">{to}</span>
    </span>
  );
}

export function ToastNote({ children }: { children: ReactNode }) {
  return <span className="text-xs!">{children}</span>;
}
