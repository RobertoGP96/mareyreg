"use client";

import * as React from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Optional title — when omitted, falls back to a sr-only title using the children context. */
  title?: React.ReactNode;
  description?: React.ReactNode;
  /** When true, the built-in header is rendered. When false, a sr-only title is used (forms render their own FormDialogHeader). Default: false. */
  showHeader?: boolean;
  /** Accessible title used when showHeader is false. Required for a11y. */
  a11yTitle?: string;
  children: React.ReactNode;
  /** Tailwind max-width for desktop Dialog. Default sm:max-w-2xl */
  desktopMaxWidth?: string;
  /** Optional class for the body wrapper. */
  bodyClassName?: string;
};

export function ResponsiveFormDialog({
  open,
  onOpenChange,
  title,
  description,
  showHeader = false,
  a11yTitle,
  children,
  desktopMaxWidth = "sm:max-w-2xl",
  bodyClassName,
}: Props) {
  const isMobile = useIsMobile();
  const accessibleTitle = a11yTitle ?? (typeof title === "string" ? title : "Formulario");

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          showCloseButton
          className="rounded-t-2xl max-h-[92vh] overflow-y-auto p-0 gap-0"
        >
          <div className="mx-auto mt-2 mb-1 h-1 w-10 rounded-full bg-border/80" />
          {showHeader && title ? (
            <SheetHeader className="px-5 pt-2 pb-2">
              <SheetTitle className="text-base font-headline tracking-tight">
                {title}
              </SheetTitle>
              {description && (
                <SheetDescription className="text-xs">
                  {description}
                </SheetDescription>
              )}
            </SheetHeader>
          ) : (
            <SheetHeader className="sr-only">
              <SheetTitle>{accessibleTitle}</SheetTitle>
              {description && <SheetDescription>{description}</SheetDescription>}
            </SheetHeader>
          )}
          <div className={cn("px-5 pb-6 pt-2", bodyClassName)}>{children}</div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn(desktopMaxWidth)}>
        {showHeader && title ? (
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {description && <DialogDescription>{description}</DialogDescription>}
          </DialogHeader>
        ) : (
          <DialogHeader className="sr-only">
            <DialogTitle>{accessibleTitle}</DialogTitle>
            {description && <DialogDescription>{description}</DialogDescription>}
          </DialogHeader>
        )}
        <div className={bodyClassName}>{children}</div>
      </DialogContent>
    </Dialog>
  );
}
