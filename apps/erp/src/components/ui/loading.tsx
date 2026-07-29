import { Spinner } from "@/components/ui/spinner"

interface LoadingProps {
  className?: string
}

export function Loading({ className }: LoadingProps) {
  return (
    <div className={`flex items-center justify-center py-8 ${className}`}>
      <Spinner className="size-8" />
    </div>
  )
}