import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center justify-center rounded-full border px-2 py-0.5 text-xs font-medium w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive transition-[color,box-shadow] overflow-hidden",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground [a&]:hover:bg-primary/90",
        brand:
          "border-transparent bg-[var(--brand)]/10 text-[var(--brand)] ring-1 ring-inset ring-[var(--brand)]/25 [a&]:hover:bg-[var(--brand)]/15",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground [a&]:hover:bg-secondary/90",
        destructive:
          "border-transparent bg-destructive/10 text-destructive ring-1 ring-inset ring-destructive/25 dark:bg-destructive/15 dark:text-red-300 dark:ring-destructive/30",
        success:
          "border-transparent bg-[var(--success)]/10 text-[var(--success)] ring-1 ring-inset ring-[var(--success)]/25 dark:bg-[var(--success)]/15",
        warning:
          "border-transparent bg-[var(--warning)]/10 text-[var(--warning)] ring-1 ring-inset ring-[var(--warning)]/30 dark:bg-[var(--warning)]/15",
        info:
          "border-transparent bg-[var(--info)]/10 text-[var(--info)] ring-1 ring-inset ring-[var(--info)]/25 dark:bg-[var(--info)]/15",
        outline:
          "border-border text-foreground bg-background [a&]:hover:bg-accent [a&]:hover:text-accent-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "span"

  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
