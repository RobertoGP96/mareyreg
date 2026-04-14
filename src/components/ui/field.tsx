import * as React from "react";
import { AlertCircle, type LucideIcon } from "lucide-react";
import { Label } from "@/components/ui/label";
import { DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type FieldProps = {
  id?: string;
  label?: React.ReactNode;
  icon?: LucideIcon;
  error?: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
};

/**
 * Form field wrapper — label + input + error, with optional icon.
 * Keeps spacing and error styling consistent across all forms.
 */
export function Field({
  id,
  label,
  icon: Icon,
  error,
  hint,
  required,
  children,
  className,
}: FieldProps) {
  return (
    <div className={cn("space-y-1.5", className)}>
      {label && (
        <Label htmlFor={id}>
          {Icon && <Icon className="h-3.5 w-3.5 text-muted-foreground" />}
          <span>
            {label}
            {required && <span className="text-[var(--brand)] ml-0.5">*</span>}
          </span>
        </Label>
      )}
      {children}
      {error ? (
        <p className="flex items-center gap-1 text-[0.78rem] text-destructive">
          <AlertCircle className="h-3 w-3 shrink-0" />
          {error}
        </p>
      ) : hint ? (
        <p className="text-[0.78rem] text-muted-foreground/80">{hint}</p>
      ) : null}
    </div>
  );
}

/**
 * Premium header block for form modals.
 *
 * Renders the Radix DialogTitle/DialogDescription directly (for proper a11y),
 * alongside a gradient icon. Use it as a *direct child* of <DialogHeader>,
 * **without** `asChild`:
 *
 *   <DialogHeader>
 *     <FormDialogHeader icon={User} title="Nuevo conductor" description="..." />
 *   </DialogHeader>
 */
export function FormDialogHeader({
  icon: Icon,
  title,
  description,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
}) {
  return (
    <div className="flex items-start gap-3 pb-1">
      {Icon && (
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[var(--brand)]/20 via-[var(--brand)]/10 to-transparent ring-1 ring-inset ring-[var(--brand)]/25">
          <Icon className="h-5 w-5 text-[var(--brand)]" strokeWidth={2.2} />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <DialogTitle className="font-headline text-lg font-semibold tracking-tight text-foreground">
          {title}
        </DialogTitle>
        {description && (
          <DialogDescription className="text-sm text-muted-foreground mt-0.5">
            {description}
          </DialogDescription>
        )}
      </div>
    </div>
  );
}
