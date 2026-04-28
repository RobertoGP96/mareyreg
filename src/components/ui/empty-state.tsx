import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { FileX } from "lucide-react"

interface EmptyStateProps {
  title?: string
  description?: string
  icon?: React.ReactNode
  className?: string
  children?: React.ReactNode
}

export function EmptyState({
  title = "No hay datos",
  description = "No se encontraron elementos para mostrar.",
  icon,
  className,
  children,
}: EmptyStateProps) {
  return (
    <Empty className={className}>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          {icon || <FileX className="size-10" />}
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
      {children ? <EmptyContent>{children}</EmptyContent> : null}
    </Empty>
  )
}