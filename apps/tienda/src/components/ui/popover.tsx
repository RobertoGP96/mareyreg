"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface PopoverProps extends React.ComponentProps<"div"> {
  open: boolean;
  onClose: () => void;
}

/** Capa flotante mínima, sin dependencias: disparador y panel viven en el mismo
 *  contenedor `relative`, así el cierre por clic fuera se resuelve con un único
 *  `contains` y el clic sobre el propio disparador no cierra y reabre en el
 *  mismo gesto. El panel se monta condicionalmente desde el consumidor. */
function Popover({
  open,
  onClose,
  className,
  children,
  ...props
}: PopoverProps) {
  const rootRef = React.useRef<HTMLDivElement>(null);
  // `onClose` casi siempre llega como lambda nueva en cada render del padre;
  // guardarla en ref evita re-suscribir los listeners del documento por render.
  const onCloseRef = React.useRef(onClose);
  React.useEffect(() => {
    onCloseRef.current = onClose;
  });

  React.useEffect(() => {
    if (!open) return;
    const handlePointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) onCloseRef.current();
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseRef.current();
    };
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div
      ref={rootRef}
      data-slot="popover"
      className={cn("relative", className)}
      {...props}
    >
      {children}
    </div>
  );
}

const ALIGN = {
  start: "left-0",
  end: "right-0",
  center: "left-1/2 -translate-x-1/2",
} as const;

interface PopoverPanelProps extends React.ComponentProps<"div"> {
  align?: keyof typeof ALIGN;
}

function PopoverPanel({
  align = "start",
  className,
  ...props
}: PopoverPanelProps) {
  return (
    <div
      data-slot="popover-panel"
      className={cn(
        "absolute top-full z-50 mt-3 border border-line bg-canvas shadow-pop",
        ALIGN[align],
        className
      )}
      {...props}
    />
  );
}

export { Popover, PopoverPanel };
