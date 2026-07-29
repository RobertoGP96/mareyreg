import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert"
import { AlertTriangle } from "lucide-react"

interface ErrorStateProps {
  title?: string
  description?: string
  className?: string
}

export function ErrorState({
  title = "Error",
  description = "Ha ocurrido un error inesperado.",
  className,
}: ErrorStateProps) {
  return (
    <Alert variant="destructive" className={className}>
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>{description}</AlertDescription>
    </Alert>
  )
}