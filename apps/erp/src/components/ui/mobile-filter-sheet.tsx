"use client";

import * as React from "react";
import { ListFilter, X } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  /** Children = the filter controls (Selects, Inputs, etc.) */
  children: React.ReactNode;
  /** Number of active filters — shows a badge on the trigger when > 0. */
  activeCount?: number;
  /** Optional callback for the "Limpiar" button. */
  onClear?: () => void;
  /** Optional label override on the trigger. Default: "Filtros". */
  triggerLabel?: string;
  className?: string;
};

export function MobileFilterSheet({
  children,
  activeCount = 0,
  onClear,
  triggerLabel = "Filtros",
  className,
}: Props) {
  const [open, setOpen] = React.useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn("cursor-pointer gap-1.5 relative", className)}
        >
          <ListFilter className="h-3.5 w-3.5" />
          {triggerLabel}
          {activeCount > 0 && (
            <span className="ml-1 inline-flex items-center justify-center min-w-5 h-5 rounded-full bg-[var(--brand)] px-1.5 text-[10px] font-bold text-white tabular-nums">
              {activeCount}
            </span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        className="rounded-t-2xl max-h-[85vh] overflow-y-auto p-0 gap-0"
      >
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-border/80" />
        <SheetHeader className="px-5 pt-3 pb-2 flex-row items-start justify-between">
          <div>
            <SheetTitle className="text-base font-headline">Filtros</SheetTitle>
            <SheetDescription className="text-xs">
              Ajusta los criterios de búsqueda.
            </SheetDescription>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
            aria-label="Cerrar filtros"
          >
            <X className="h-4 w-4" />
          </button>
        </SheetHeader>

        <div className="px-5 py-4 space-y-3">{children}</div>

        <div className="px-5 py-3 border-t border-border bg-muted/20 flex items-center justify-between gap-2 sticky bottom-0">
          {onClear ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                onClear();
              }}
              className="cursor-pointer"
              disabled={activeCount === 0}
            >
              Limpiar
            </Button>
          ) : (
            <span />
          )}
          <Button
            type="button"
            size="sm"
            onClick={() => setOpen(false)}
            className="cursor-pointer flex-1 sm:flex-none"
          >
            Aplicar
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
