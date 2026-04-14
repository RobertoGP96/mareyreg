"use client";

import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Package } from "lucide-react";

interface CategoryAvailability {
  name: string;
  categoryId: number;
  available: number;
  reserved: number;
  sold: number;
  total: number;
}

interface ClassificationGroup {
  classification: string;
  classificationId: number;
  categories: CategoryAvailability[];
}

interface Props {
  data: ClassificationGroup[];
}

export function AvailabilityView({ data }: Props) {
  if (data.length === 0) {
    return (
      <EmptyState
        title="No hay datos"
        description="No se encontraron clasificaciones o categorias configuradas."
      />
    );
  }

  const totalAvailable = data.reduce(
    (sum, cls) => sum + cls.categories.reduce((s, c) => s + c.available, 0),
    0
  );
  const totalReserved = data.reduce(
    (sum, cls) => sum + cls.categories.reduce((s, c) => s + c.reserved, 0),
    0
  );
  const totalAll = data.reduce(
    (sum, cls) => sum + cls.categories.reduce((s, c) => s + c.total, 0),
    0
  );

  return (
    <div className="space-y-4">
      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-card border rounded-lg p-4 text-center">
          <p className="text-2xl font-semibold text-green-600">{totalAvailable}</p>
          <p className="text-sm text-muted-foreground uppercase tracking-wider mt-1">
            Disponibles
          </p>
        </div>
        <div className="bg-card border rounded-lg p-4 text-center">
          <p className="text-2xl font-semibold text-blue-600">{totalReserved}</p>
          <p className="text-sm text-muted-foreground uppercase tracking-wider mt-1">
            Reservadas
          </p>
        </div>
        <div className="bg-card border rounded-lg p-4 text-center">
          <p className="text-2xl font-semibold">{totalAll}</p>
          <p className="text-sm text-muted-foreground uppercase tracking-wider mt-1">
            Total
          </p>
        </div>
      </div>

      {/* Grouped by classification */}
      {data.map((group) => {
        const groupAvailable = group.categories.reduce((s, c) => s + c.available, 0);

        return (
          <div key={group.classificationId} className="bg-card border rounded-xl overflow-hidden">
            {/* Classification header */}
            <div className="bg-primary/5 border-b px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-1.5 rounded-md bg-primary/10">
                  <Package className="h-4 w-4 text-primary" />
                </div>
                <h3 className="font-semibold text-base uppercase tracking-wider">
                  {group.classification}
                </h3>
              </div>
              <Badge variant="secondary" className="text-sm">
                {groupAvailable} disponibles
              </Badge>
            </div>

            {/* Categories table */}
            <div className="divide-y">
              {/* Table header */}
              <div className="grid grid-cols-12 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground bg-muted/50">
                <div className="col-span-5">Categoria</div>
                <div className="col-span-2 text-center">Disponible</div>
                <div className="col-span-2 text-center">Reservada</div>
                <div className="col-span-1 text-center">Vendida</div>
                <div className="col-span-2 text-right">Total</div>
              </div>

              {group.categories.map((cat) => (
                <div
                  key={cat.categoryId}
                  className="grid grid-cols-12 px-4 py-3 items-center hover:bg-muted/30 transition-colors"
                >
                  <div className="col-span-5 font-medium">{cat.name}</div>
                  <div className="col-span-2 text-center">
                    <Badge
                      className={
                        cat.available > 0
                          ? "bg-green-100 text-green-800"
                          : "bg-red-100 text-red-800"
                      }
                    >
                      {cat.available}
                    </Badge>
                  </div>
                  <div className="col-span-2 text-center">
                    {cat.reserved > 0 ? (
                      <Badge className="bg-blue-100 text-blue-800">
                        {cat.reserved}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">0</span>
                    )}
                  </div>
                  <div className="col-span-1 text-center text-muted-foreground">
                    {cat.sold}
                  </div>
                  <div className="col-span-2 text-right font-semibold">
                    {cat.total}
                  </div>
                </div>
              ))}

              {group.categories.length === 0 && (
                <div className="px-4 py-4 text-center text-muted-foreground">
                  Sin categorias
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
