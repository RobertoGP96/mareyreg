"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Route as RouteIcon,
  Plus,
  Search,
  MoreHorizontal,
  SquarePen,
  Trash2,
  MapPin,
  Gauge,
  Clock,
} from "lucide-react";
import { toast } from "sonner";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { MetricTile } from "@/components/ui/metric-tile";
import { RouteForm, type RouteForEdit } from "./route-form";
import {
  createRoute,
  updateRoute,
  deleteRoute,
} from "../actions/route-actions";
import type { RouteRow } from "../queries/route-queries";

interface Props {
  initialRoutes: RouteRow[];
}

export function RouteListClient({ initialRoutes }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [routeToEdit, setRouteToEdit] = useState<RouteForEdit | null>(null);
  const [routeToDelete, setRouteToDelete] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return initialRoutes;
    return initialRoutes.filter(
      (r) =>
        r.originProvince.toLowerCase().includes(q) ||
        r.destinationProvince.toLowerCase().includes(q) ||
        (r.description?.toLowerCase().includes(q) ?? false)
    );
  }, [initialRoutes, search]);

  const totalDistance = initialRoutes.reduce((acc, r) => acc + (r.distanceKm ?? 0), 0);
  const avgHours =
    initialRoutes.length > 0
      ? initialRoutes.reduce((acc, r) => acc + (r.estimatedHours ?? 0), 0) /
        initialRoutes.filter((r) => r.estimatedHours != null).length || 0
      : 0;
  const totalTrips = initialRoutes.reduce((acc, r) => acc + r.tripsCount, 0);

  const handleCreate = async (data: Parameters<typeof createRoute>[0]) => {
    setIsSubmitting(true);
    const r = await createRoute(data);
    setIsSubmitting(false);
    if (r.success) {
      toast.success("Ruta creada");
      setIsCreateOpen(false);
      router.refresh();
    } else toast.error(r.error);
  };

  const handleUpdate = async (data: Parameters<typeof createRoute>[0]) => {
    if (!routeToEdit) return;
    setIsSubmitting(true);
    const r = await updateRoute(routeToEdit.routeId, data);
    setIsSubmitting(false);
    if (r.success) {
      toast.success("Ruta actualizada");
      setRouteToEdit(null);
      router.refresh();
    } else toast.error(r.error);
  };

  const handleDelete = async () => {
    if (!routeToDelete) return;
    setIsSubmitting(true);
    const r = await deleteRoute(routeToDelete);
    setIsSubmitting(false);
    if (r.success) {
      toast.success("Ruta eliminada");
      setRouteToDelete(null);
      router.refresh();
    } else toast.error(r.error);
  };

  const columns: DataTableColumn<RouteRow>[] = [
    {
      key: "trayecto",
      header: "Trayecto",
      cell: (r) => (
        <div className="flex items-center gap-2 min-w-0">
          <span className="status-dot status-dot--active" aria-hidden />
          <span className="font-medium text-foreground truncate">{r.originProvince}</span>
          <span className="text-muted-foreground">→</span>
          <span className="status-dot status-dot--track" aria-hidden />
          <span className="font-medium text-foreground truncate">{r.destinationProvince}</span>
        </div>
      ),
    },
    {
      key: "distance",
      header: "Distancia",
      align: "right",
      cell: (r) =>
        r.distanceKm != null ? (
          <span className="font-mono tabular-nums text-sm">{r.distanceKm} km</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      key: "hours",
      header: "Estimado",
      align: "right",
      cell: (r) =>
        r.estimatedHours != null ? (
          <span className="font-mono tabular-nums text-sm">{r.estimatedHours} h</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      key: "trips",
      header: "Viajes",
      align: "right",
      cell: (r) => (
        <Badge variant={r.tripsCount > 0 ? "brand" : "outline"}>{r.tripsCount}</Badge>
      ),
    },
    {
      key: "description",
      header: "Notas",
      cell: (r) => (
        <span className="text-sm text-muted-foreground line-clamp-1">
          {r.description || "—"}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      width: "w-12",
      cell: (r) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="size-8">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem
              onClick={() =>
                setRouteToEdit({
                  routeId: r.routeId,
                  originProvince: r.originProvince,
                  destinationProvince: r.destinationProvince,
                  distanceKm: r.distanceKm,
                  estimatedHours: r.estimatedHours,
                  description: r.description,
                })
              }
            >
              <SquarePen className="h-4 w-4" /> Editar
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setRouteToDelete(r.routeId)}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="h-4 w-4" /> Eliminar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        icon={RouteIcon}
        title="Rutas"
        description="Catálogo de rutas operativas con distancia y duración estimada."
        badge={`${initialRoutes.length} rutas`}
      >
        <Button variant="brand" onClick={() => setIsCreateOpen(true)}>
          <Plus className="h-4 w-4" />
          Nueva ruta
        </Button>
      </PageHeader>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <MetricTile label="Rutas" value={initialRoutes.length} icon={RouteIcon} tone="active" />
        <MetricTile label="Viajes (total)" value={totalTrips} icon={MapPin} tone="track" />
        <MetricTile
          label="Distancia"
          value={`${totalDistance.toFixed(0)} km`}
          icon={Gauge}
          tone="warning"
        />
        <MetricTile
          label="Promedio"
          value={avgHours ? `${avgHours.toFixed(1)} h` : "—"}
          icon={Clock}
          tone="success"
        />
      </div>

      <DataTable
        columns={columns}
        rows={filtered}
        rowKey={(r) => r.routeId}
        toolbar={
          <div className="flex items-center gap-3">
            <InputGroup className="flex-1 min-w-[240px] max-w-md">
              <InputGroupAddon>
                <Search />
              </InputGroupAddon>
              <InputGroupInput
                placeholder="Buscar por origen, destino o descripción…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <InputGroupAddon align="inline-end">
                <Badge variant="brand">{filtered.length}</Badge>
              </InputGroupAddon>
            </InputGroup>
          </div>
        }
        emptyState={
          <EmptyState
            title="Sin rutas"
            description={search ? "No hay rutas que coincidan." : "Crea la primera ruta operativa."}
          />
        }
      />

      <RouteForm
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        onSubmit={handleCreate}
        isLoading={isSubmitting}
      />
      <RouteForm
        open={!!routeToEdit}
        onOpenChange={(open) => !open && setRouteToEdit(null)}
        onSubmit={handleUpdate}
        isLoading={isSubmitting}
        route={routeToEdit}
      />

      <AlertDialog open={!!routeToDelete} onOpenChange={() => setRouteToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar ruta?</AlertDialogTitle>
            <AlertDialogDescription>
              No se puede deshacer. Si tiene viajes asociados, deberás reasignarlos primero.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-white hover:bg-destructive/90"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Eliminando…" : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
