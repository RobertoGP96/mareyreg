/** Con las cards elevadas la separación ya no puede ser el hairline compartido
 *  entre celdas: una retícula a tope recorta la sombra de las vecinas. Ahora la
 *  retícula da aire (`gap`) y cada card dibuja su propio canto. */
export function ProductGrid({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
  return <div className={className}>{children}</div>;
}
