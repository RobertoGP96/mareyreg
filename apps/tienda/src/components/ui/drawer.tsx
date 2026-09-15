"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  /** Etiqueta accesible del diálogo. Se pinta en la cabecera salvo `hideTitle`. */
  title: string;
  hideTitle?: boolean;
  className?: string;
  bodyClassName?: string;
  children: React.ReactNode;
}

/** Hoja inferior modal, sin dependencias: portal a `body` para que ninguna card
 *  con `overflow` la recorte, y foco atrapado dentro del panel mientras está
 *  abierta. El consumidor controla `open`; el panel se desmonta al cerrar. */
function Drawer({
  open,
  onClose,
  title,
  hideTitle = false,
  className,
  bodyClassName,
  children,
}: DrawerProps) {
  const panelRef = React.useRef<HTMLDivElement>(null);
  // `onClose` suele llegar como lambda nueva cada render; en ref para no
  // re-suscribir el listener del documento en cada uno.
  const onCloseRef = React.useRef(onClose);
  React.useEffect(() => {
    onCloseRef.current = onClose;
  });

  // El portal solo existe en cliente: sin este flag el árbol del servidor y el
  // de hidratación no coinciden.
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  React.useEffect(() => {
    if (!open) return;
    const opener = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab") return;
      const panel = panelRef.current;
      if (!panel) return;
      const items = panel.querySelectorAll<HTMLElement>(FOCUSABLE);
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || active === panel)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      opener?.focus?.();
    };
  }, [open]);

  if (!mounted || !open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50">
      <div
        aria-hidden="true"
        onClick={onClose}
        className="drawer-overlay absolute inset-0 bg-overlay backdrop-blur-[2px]"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={cn(
          "drawer-panel absolute inset-x-0 bottom-0 flex max-h-[92dvh] flex-col rounded-t-[24px] bg-canvas pb-[env(safe-area-inset-bottom)] shadow-pop outline-none",
          className
        )}
      >
        <div className="flex-none">
          <div className="flex justify-center pt-2.5 pb-1">
            <span aria-hidden="true" className="h-1 w-10 rounded-full bg-line" />
          </div>
          <div className="flex items-center justify-between gap-4 px-5 pb-2">
            <p
              className={cn(
                "nav-label min-w-0 flex-1 truncate text-slate-500",
                hideTitle && "sr-only"
              )}
            >
              {title}
            </p>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar"
              className="-mr-2 flex h-9 w-9 flex-none items-center justify-center rounded-full text-slate-500 transition-colors duration-150 hover:bg-hover hover:text-navy-700"
            >
              <X className="h-4 w-4" strokeWidth={2} />
            </button>
          </div>
        </div>

        <div
          className={cn(
            "min-h-0 flex-1 overflow-y-auto overscroll-contain",
            bodyClassName
          )}
        >
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
}

export { Drawer };
