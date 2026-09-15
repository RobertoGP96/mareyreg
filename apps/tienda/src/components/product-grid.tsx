import { cn } from "@/lib/utils";

/** Retícula de cards elevadas: dos columnas ya en móvil (la card se compacta
 *  sola por debajo de `sm`), tres en tablet y cuatro en desktop. */
export function ProductGrid({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
        {children}
      </div>
    </div>
  );
}

export function ProductGridCell({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn("min-w-0", className)}>{children}</div>;
}
