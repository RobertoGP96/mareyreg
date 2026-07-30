import { cn } from "@/lib/utils";

/** La separación de la retícula son los bordes de cada celda, no un `gap`.
 *  Cada celda lleva hairline derecho e inferior; el desbordamiento de 1px de la
 *  última columna y la última fila se recorta con el `overflow-hidden` del
 *  envoltorio interno —que va SIN padding, para que el recorte caiga justo en
 *  el borde de la rejilla—. Así no hay que recalcular qué celda va sin borde en
 *  cada breakpoint: se lee continua con 1, 2, 3 o 4 columnas. */
export function ProductGrid({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="overflow-hidden">
        <div className="-mr-px -mb-px grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {children}
        </div>
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
  return (
    <div className={cn("border-r border-b border-line-soft", className)}>
      {children}
    </div>
  );
}
