"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { MetricTile } from "@/components/ui/metric-tile";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  PackageCheck,
  Search,
  ListFilter,
  CircleCheck,
  Bookmark,
  Package2,
  ChevronRight,
} from "lucide-react";
import { AvailabilitySharePopover } from "./availability-share-popover";
import { MobileFilterSheet } from "@/components/ui/mobile-filter-sheet";

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

const ALL = "__all__";

export function AvailabilityView({ data }: Props) {
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState<string>(ALL);
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return data
      .filter((g) => classFilter === ALL || g.classification === classFilter)
      .map((g) => ({
        ...g,
        categories: g.categories.filter(
          (c) => !q || c.name.toLowerCase().includes(q)
        ),
      }))
      .filter((g) => g.categories.length > 0);
  }, [data, search, classFilter]);

  const totalAvailable = filtered.reduce(
    (sum, cls) => sum + cls.categories.reduce((s, c) => s + c.available, 0),
    0
  );
  const totalReserved = filtered.reduce(
    (sum, cls) => sum + cls.categories.reduce((s, c) => s + c.reserved, 0),
    0
  );
  const totalAll = filtered.reduce(
    (sum, cls) => sum + cls.categories.reduce((s, c) => s + c.total, 0),
    0
  );

  const toggleGroup = (id: number) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-5">
      <PageHeader
        icon={PackageCheck}
        title="Disponibilidad"
        description="Stock disponible agrupado por clasificación. Solo categorías con disponibilidad &gt; 0."
        badge={`${filtered.length} clasificaciones`}
        actions={data.length > 0 ? <AvailabilitySharePopover data={data} /> : undefined}
      />

      <div className="grid grid-cols-3 gap-2">
        <MetricTile label="Disponibles" value={totalAvailable} icon={CircleCheck} tone="success" />
        <MetricTile label="Reservadas" value={totalReserved} icon={Bookmark} tone="active" />
        <MetricTile label="Total stock" value={totalAll} icon={Package2} tone="track" />
      </div>

      <div className="cockpit-panel p-3 flex flex-col gap-3">
        <InputGroup className="flex-1 min-w-[240px]">
          <InputGroupAddon>
            <Search />
          </InputGroupAddon>
          <InputGroupInput
            placeholder="Buscar categoría…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </InputGroup>
        <div className="hidden md:flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <ListFilter className="h-3.5 w-3.5" />
            Filtros
          </div>
          <Select value={classFilter} onValueChange={setClassFilter}>
            <SelectTrigger className="h-8 w-auto min-w-[180px] text-xs">
              <SelectValue placeholder="Clasificación" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todas</SelectItem>
              {data.map((g) => (
                <SelectItem key={g.classificationId} value={g.classification}>
                  {g.classification}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {classFilter !== ALL && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs"
              onClick={() => setClassFilter(ALL)}
            >
              Limpiar
            </Button>
          )}
        </div>
        <div className="md:hidden">
          <MobileFilterSheet
            activeCount={classFilter !== ALL ? 1 : 0}
            onClear={() => setClassFilter(ALL)}
          >
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-muted-foreground">
                Clasificación
              </label>
              <Select value={classFilter} onValueChange={setClassFilter}>
                <SelectTrigger className="h-10 w-full text-sm">
                  <SelectValue placeholder="Clasificación" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Todas</SelectItem>
                  {data.map((g) => (
                    <SelectItem key={g.classificationId} value={g.classification}>
                      {g.classification}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </MobileFilterSheet>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="Sin disponibilidad"
          description={
            search || classFilter !== ALL
              ? "No hay coincidencias con los filtros."
              : "No se encontraron clasificaciones o categorias con stock."
          }
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((group) => {
            const groupAvailable = group.categories.reduce((s, c) => s + c.available, 0);
            const isCollapsed = collapsed.has(group.classificationId);
            return (
              <div key={group.classificationId} className="cockpit-panel overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggleGroup(group.classificationId)}
                  className="w-full bg-[var(--ops-active)]/5 border-b border-border px-4 py-2.5 flex items-center justify-between cursor-pointer hover:bg-[var(--ops-active)]/8 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <ChevronRight
                      className={`h-4 w-4 text-muted-foreground transition-transform ${isCollapsed ? "" : "rotate-90"}`}
                    />
                    <div className="grid size-7 place-items-center rounded-md bg-[var(--ops-active)]/10">
                      <PackageCheck className="h-4 w-4 text-[var(--ops-active)]" />
                    </div>
                    <h3 className="font-headline font-semibold text-sm uppercase tracking-wider">
                      {group.classification}
                    </h3>
                    <Badge variant="outline" className="text-xs">
                      {group.categories.length} cat.
                    </Badge>
                  </div>
                  <Badge variant="success" className="font-mono tabular-nums">
                    {groupAvailable} disp.
                  </Badge>
                </button>
                {!isCollapsed && (
                  <>
                    <div className="hidden md:block overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/40 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                          <tr>
                            <th className="px-4 py-2 text-left">Categoría</th>
                            <th className="px-3 py-2 text-center">Disponible</th>
                            <th className="px-3 py-2 text-center">Reserv.</th>
                            <th className="px-3 py-2 text-center">Vendida</th>
                            <th className="px-4 py-2 text-right">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {group.categories.map((cat) => (
                            <tr
                              key={cat.categoryId}
                              className="border-b border-border/60 last:border-0 hover:bg-muted/40 transition-colors"
                            >
                              <td className="px-4 py-2.5 font-medium">{cat.name}</td>
                              <td className="px-3 py-2.5 text-center">
                                <Badge
                                  variant={cat.available > 0 ? "success" : "destructive"}
                                  className="font-mono tabular-nums"
                                >
                                  {cat.available}
                                </Badge>
                              </td>
                              <td className="px-3 py-2.5 text-center">
                                {cat.reserved > 0 ? (
                                  <Badge variant="info" className="font-mono tabular-nums">
                                    {cat.reserved}
                                  </Badge>
                                ) : (
                                  <span className="text-muted-foreground tabular-nums">0</span>
                                )}
                              </td>
                              <td className="px-3 py-2.5 text-center text-muted-foreground tabular-nums text-sm">
                                {cat.sold}
                              </td>
                              <td className="px-4 py-2.5 text-right font-mono tabular-nums font-semibold">
                                {cat.total}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="md:hidden divide-y divide-border/60">
                      {group.categories.map((cat) => (
                        <div
                          key={cat.categoryId}
                          className="flex items-start justify-between gap-3 px-4 py-3"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-medium text-foreground truncate">
                              {cat.name}
                            </div>
                            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                              <Badge
                                variant={cat.available > 0 ? "success" : "destructive"}
                                className="font-mono tabular-nums text-[10px]"
                              >
                                {cat.available} disp.
                              </Badge>
                              {cat.reserved > 0 && (
                                <Badge variant="info" className="font-mono tabular-nums text-[10px]">
                                  {cat.reserved} reserv.
                                </Badge>
                              )}
                              {cat.sold > 0 && (
                                <Badge variant="outline" className="font-mono tabular-nums text-[10px]">
                                  {cat.sold} vend.
                                </Badge>
                              )}
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                              Total
                            </div>
                            <div className="font-mono tabular-nums font-semibold text-foreground">
                              {cat.total}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
