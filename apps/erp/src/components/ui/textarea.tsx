import * as React from "react"

import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-20 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none transition-all",
        "placeholder:text-muted-foreground/70",
        "hover:border-border/80",
        "focus-visible:border-[var(--brand)] focus-visible:ring-[3px] focus-visible:ring-[var(--brand)]/15",
        "disabled:cursor-not-allowed disabled:opacity-60 disabled:bg-muted/50",
        "aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40",
        "dark:bg-input/30 dark:hover:bg-input/50",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
