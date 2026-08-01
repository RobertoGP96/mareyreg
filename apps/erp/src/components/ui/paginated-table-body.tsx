"use client";

import * as React from "react";
import {
  DEFAULT_PAGE_SIZE,
  Pagination,
  usePagination,
} from "@/components/ui/pagination";
import { cn } from "@/lib/utils";

type Props = {
  /** Las `<tr>` del listado — pueden venir ya renderizadas desde un server component. */
  children: React.ReactNode;
  /** Columnas de la tabla, para que el pie ocupe el ancho completo. */
  colSpan: number;
  pageSize?: number;
  itemLabel?: string;
  className?: string;
};

/**
 * Paginación para tablas que se arman en el servidor y no pasan por
 * `ResponsiveListView`. Recorta las filas ya renderizadas y añade el control en
 * un `<tfoot>`, sin obligar a serializar los datos hacia el cliente.
 */
export function PaginatedTableBody({
  children,
  colSpan,
  pageSize = DEFAULT_PAGE_SIZE,
  itemLabel,
  className,
}: Props) {
  const rows = React.useMemo(
    () => React.Children.toArray(children),
    [children]
  );
  const { page, pageCount, pageRows, total, from, to, setPage } = usePagination(
    rows,
    pageSize
  );

  return (
    <>
      <tbody className={className}>{pageRows}</tbody>
      {pageCount > 1 && (
        <tfoot>
          <tr>
            <td
              colSpan={colSpan}
              className={cn("border-t border-border bg-muted/20 px-3 py-2")}
            >
              <Pagination
                page={page}
                pageCount={pageCount}
                total={total}
                from={from}
                to={to}
                onPageChange={setPage}
                itemLabel={itemLabel}
              />
            </td>
          </tr>
        </tfoot>
      )}
    </>
  );
}
