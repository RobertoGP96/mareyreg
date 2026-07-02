import * as React from "react";
import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type FormSectionProps = {
  icon?: LucideIcon;
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
};

/**
 * Groups related form fields under an iconified section header.
 * Use inside a form card to create visual structure.
 */
export function FormSection({
  icon: Icon,
  title,
  description,
  children,
  className,
}: FormSectionProps) {
  return (
    <section className={cn("space-y-4", className)}>
      <header className="flex items-start gap-3 border-b border-border pb-3">
        {Icon && (
          <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-[var(--brand)]/10 ring-1 ring-inset ring-[var(--brand)]/20">
            <Icon className="h-4 w-4 text-[var(--brand)]" strokeWidth={2.2} />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h3 className="font-headline text-[0.95rem] font-semibold text-foreground">
            {title}
          </h3>
          {description && (
            <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
          )}
        </div>
      </header>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

/**
 * Wrapper for a group of form sections — card-like shell with footer.
 */
export function FormCard({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card p-5 md:p-6 shadow-panel space-y-6",
        className
      )}
    >
      {children}
    </div>
  );
}

/**
 * Footer with primary/cancel actions for forms.
 */
export function FormFooter({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-end gap-2 pt-4 border-t border-border",
        className
      )}
    >
      {children}
    </div>
  );
}
