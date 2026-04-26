"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
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
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { MetricTile } from "@/components/ui/metric-tile";
import { StatusPill } from "@/components/ui/status-pill";
import {
  Search,
  Trash2,
  MoreHorizontal,
  Plus,
  SquarePen,
  Route as RouteIcon,
  Container as ContainerIcon,
  Package,
  CircleDollarSign,
  MapPin,
  Eye,
  UserRound,
  ListFilter,
  CalendarClock,
  Activity,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { createTrip, updateTrip, deleteTrip } from "../actions/trip-actions";
import {
  createContainer,
  createContainersBulk,
} from "../actions/container-actions";
import { TripForm, type TripFormSubmit } from "./trip-form";
import { ContainerForm, type ContainerSubmitPayload } from "./container-form";
import { CUBAN_PROVINCES } from "@/lib/constants";
import type { Driver, TripStatus } from "@/types";
import type { TripListRow } from "../queries/trip-queries";
import type { RouteOption } from "../queries/route-queries";

interface Props {
  initialTrips: TripListRow[];
  drivers: Driver[];
  routes?: RouteOption[];
}

const STATUS_OPTIONS: { value: TripStatus; label: string }[] = [
  { value: "scheduled", label: "Programado" },
  { value: "in_progress", label: "En curso" },
  { value: "completed", label: "Completado" },
  { value: "cancelled", label: "Cancelado" },
];

const ALL = "__all__";

export function TripListClient({ initialTrips, drivers, routes = [] }: Props) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [provinceFilter, setProvinceFilter] = useState<string>(ALL);
  const [driverFilter, setDriverFilter] = useState<string>(ALL);
  const [statusFilter, setStatusFilter] = useState<string>(ALL);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [tripToEdit, setTripToEdit] = useState<TripListRow | null>(null);
  const [tripToDelete, setTripToDelete] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [containerTripId, setContainerTripId] = useState<number | null>(null);

  const counts = useMemo(() => {
    const c = { scheduled: 0, in_progress: 0, completed: 0, cancelled: 0 };
    for (const t of initialTrips) c[t.status]++;
    return c;
  }, [initialTrips]);

  const filteredTrips = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return initialTrips.filter((trip) => {
      if (provinceFilter !== ALL && trip.province !== provinceFilter) return false;
      if (driverFilter !== ALL && trip.driverId.toString() !== driverFilter)
        return false;
      if (statusFilter !== ALL && trip.status !== statusFilter) return false;
      if (!q) return true;
      return (
        trip.driverFullName?.toLowerCase().includes(q) ||
        trip.province?.toLowerCase().includes(q) ||
        trip.product?.toLowerCase().includes(q) ||
        trip.route?.originProvince.toLowerCase().includes(q) ||
        trip.route?.destinationProvince.toLowerCase().includes(q) ||
        trip.containers.some((c) => c.serialNumber.toLowerCase().includes(q))
      );
    });
  }, [initialTrips, searchQuery, provinceFilter, driverFilter, statusFilter]);

  const handleCreateTrip = async (data: TripFormSubmit) => {
    setIsSubmitting(true);
    const result = await createTrip(data);
    setIsSubmitting(false);
    if (result.success) {
      setIsCreateOpen(false);
      toast.success("Viaje creado exitosamente");
      router.refresh();
    } else toast.error(result.error);
  };

  const handleUpdateTrip = async (data: TripFormSubmit) => {
    if (!tripToEdit) return;
    setIsSubmitting(true);
    const result = await updateTrip(tripToEdit.tripId, data);
    setIsSubmitting(false);
    if (result.success) {
      setTripToEdit(null);
      toast.success("Viaje actualizado exitosamente");
      router.refresh();
    } else toast.error(result.error);
  };

  const handleDeleteTrip = async () => {
    if (!tripToDelete) return;
    setIsSubmitting(true);
    const result = await deleteTrip(tripToDelete);
    setIsSubmitting(false);
    if (result.success) {
      setTripToDelete(null);
      toast.success("Viaje eliminado exitosamente");
      router.refresh();
    } else toast.error(result.error);
  };

  const handleAddContainers = async (payload: ContainerSubmitPayload) => {
    if (!containerTripId) return;
    setIsSubmitting(true);
    try {
      if (payload.mode === "single") {
        const result = await createContainer({
          trip_id: containerTripId,
          serial_number: payload.serial_number,
          type: payload.type,
        });
        if (result.success) {
          toast.success("Contenedor agregado");
          setContainerTripId(null);
          router.refresh();
        } else toast.error(result.error);
      } else {
        const result = await createContainersBulk({
          trip_id: containerTripId,
          serial_numbers: payload.serial_numbers,
          type: payload.type,
        });
        if (result.success) {
          const { created, skipped } = result.data;
          toast.success(
            `${created} contenedor${created === 1 ? "" : "es"} agregado${created === 1 ? "" : "s"}` +
              (skipped > 0 ? ` · ${skipped} duplicado${skipped === 1 ? "" : "s"} omitido${skipped === 1 ? "" : "s"}` : "")
          );
          setContainerTripId(null);
          router.refresh();
        } else toast.error(result.error);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const activeFilters =
    (provinceFilter !== ALL ? 1 : 0) +
    (driverFilter !== ALL ? 1 : 0) +
    (statusFilter !== ALL ? 1 : 0);

  const clearFilters = () => {
    setProvinceFilter(ALL);
    setDriverFilter(ALL);
    setStatusFilter(ALL);
  };

  const columns: DataTableColumn<TripListRow>[] = [
    {
      key: "trip",
      header: "Viaje",
      cell: (t) => (
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-mono tabular-nums text-xs text-muted-foreground">
              #{t.tripId}
            </span>
            <span className="font-medium text-foreground truncate">
              {t.driverFullName ?? "Sin conductor"}
            </span>
          </div>
          {t.route ? (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
              <span className="status-dot status-dot--active" aria-hidden />
              <span className="truncate">{t.route.originProvince}</span>
              <span>→</span>
              <span className="status-dot status-dot--track" aria-hidden />
              <span className="truncate">{t.route.destinationProvince}</span>
            </div>
          ) : t.province ? (
            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
              <MapPin className="h-3 w-3" />
              {t.province}
            </div>
          ) : null}
        </div>
      ),
    },
    {
      key: "status",
      header: "Estado",
      cell: (t) => <StatusPill status={t.status} size="sm" />,
    },
    {
      key: "schedule",
      header: "Programación",
      cell: (t) =>
        t.loadDate ? (
          <span className="font-mono tabular-nums text-xs">
            {t.loadDate}
            {t.loadTime ? ` · ${t.loadTime}` : ""}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      key: "product",
      header: "Producto",
      cell: (t) =>
        t.product ? (
          <Badge variant="outline" className="gap-1">
            <Package className="h-3 w-3" />
            {t.product}
          </Badge>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      key: "carga",
      header: "Carga",
      align: "right",
      cell: (t) => (
        <div className="inline-flex items-center gap-2">
          {t.containers.length > 0 && (
            <Badge variant="info" className="gap-1">
              <ContainerIcon className="h-3 w-3" />
              {t.containers.length}
            </Badge>
          )}
          {t.cargoCount > 0 && (
            <Badge variant="outline" className="gap-1">
              <Package className="h-3 w-3" />
              {t.cargoCount}
            </Badge>
          )}
          {t.containers.length === 0 && t.cargoCount === 0 && (
            <span className="text-muted-foreground">—</span>
          )}
        </div>
      ),
    },
    {
      key: "payment",
      header: "Pago",
      align: "right",
      cell: (t) =>
        t.tripPayment ? (
          <span className="inline-flex items-center gap-1 font-mono tabular-nums text-sm text-[var(--ops-success)]">
            <CircleDollarSign className="h-3.5 w-3.5" />
            {t.tripPayment}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      width: "w-12",
      cell: (t) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={() => router.push(`/trips/${t.tripId}`)}>
              <Eye className="h-4 w-4" /> Ver detalles
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => router.push(`/drivers/${t.driverId}`)}>
              <UserRound className="h-4 w-4" /> Ver conductor
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault();
                setTimeout(() => setContainerTripId(t.tripId), 0);
              }}
            >
              <ContainerIcon className="h-4 w-4" /> Agregar contenedor(es)
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault();
                setTimeout(() => setTripToEdit(t), 0);
              }}
            >
              <SquarePen className="h-4 w-4" /> Editar
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault();
                setTimeout(() => setTripToDelete(t.tripId), 0);
              }}
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
        title="Viajes"
        description="Programación y seguimiento de viajes con conductor, ruta y carga."
        badge={`${initialTrips.length} viajes`}
      >
        <Button variant="brand" onClick={() => setIsCreateOpen(true)}>
          <Plus className="h-4 w-4" />
          Nuevo viaje
        </Button>
      </PageHeader>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <MetricTile
          label="Programados"
          value={counts.scheduled}
          icon={CalendarClock}
          tone="idle"
          active={statusFilter === "scheduled"}
          onClick={() => setStatusFilter(statusFilter === "scheduled" ? ALL : "scheduled")}
        />
        <MetricTile
          label="En curso"
          value={counts.in_progress}
          icon={Activity}
          tone="active"
          active={statusFilter === "in_progress"}
          onClick={() => setStatusFilter(statusFilter === "in_progress" ? ALL : "in_progress")}
        />
        <MetricTile
          label="Completados"
          value={counts.completed}
          icon={CheckCircle2}
          tone="success"
          active={statusFilter === "completed"}
          onClick={() => setStatusFilter(statusFilter === "completed" ? ALL : "completed")}
        />
        <MetricTile
          label="Cancelados"
          value={counts.cancelled}
          icon={XCircle}
          tone="critical"
          active={statusFilter === "cancelled"}
          onClick={() => setStatusFilter(statusFilter === "cancelled" ? ALL : "cancelled")}
        />
      </div>

      <DataTable
        columns={columns}
        rows={filteredTrips}
        rowKey={(t) => t.tripId}
        onRowClick={(t) => router.push(`/trips/${t.tripId}`)}
        toolbar={
          <div className="flex flex-col gap-3">
            <InputGroup className="flex-1 min-w-[240px]">
              <InputGroupAddon>
                <Search />
              </InputGroupAddon>
              <InputGroupInput
                placeholder="Buscar por conductor, provincia, producto, ruta o contenedor…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <InputGroupAddon align="inline-end">
                <Badge variant="brand">{filteredTrips.length}</Badge>
              </InputGroupAddon>
            </InputGroup>

            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <ListFilter className="h-3.5 w-3.5" />
                Filtros
              </div>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-8 w-auto min-w-[140px] text-xs">
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Todos los estados</SelectItem>
                  {STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={provinceFilter} onValueChange={setProvinceFilter}>
                <SelectTrigger className="h-8 w-auto min-w-[160px] text-xs">
                  <SelectValue placeholder="Provincia" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Todas las provincias</SelectItem>
                  {CUBAN_PROVINCES.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={driverFilter} onValueChange={setDriverFilter}>
                <SelectTrigger className="h-8 w-auto min-w-[180px] text-xs">
                  <SelectValue placeholder="Conductor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Todos los conductores</SelectItem>
                  {drivers.map((d) => (
                    <SelectItem key={d.driverId} value={d.driverId.toString()}>
                      {d.fullName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {activeFilters > 0 && (
                <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={clearFilters}>
                  Limpiar ({activeFilters})
                </Button>
              )}
            </div>
          </div>
        }
        emptyState={
          <EmptyState
            title="No hay viajes"
            description={
              searchQuery || activeFilters > 0
                ? "No se encontraron resultados con los filtros aplicados."
                : "Crea el primer viaje para empezar."
            }
          />
        }
      />

      <TripForm
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        onSubmit={handleCreateTrip}
        isLoading={isSubmitting}
        drivers={drivers}
        routes={routes}
      />

      <TripForm
        open={!!tripToEdit}
        onOpenChange={(open) => !open && setTripToEdit(null)}
        onSubmit={handleUpdateTrip}
        isLoading={isSubmitting}
        drivers={drivers}
        routes={routes}
        trip={
          tripToEdit
            ? {
                tripId: tripToEdit.tripId,
                driverId: tripToEdit.driverId,
                routeId: tripToEdit.routeId,
                loadDate: tripToEdit.loadDate,
                loadTime: tripToEdit.loadTime,
                tripPayment: tripToEdit.tripPayment,
                province: tripToEdit.province,
                product: tripToEdit.product,
                status: tripToEdit.status,
              }
            : null
        }
      />

      <ContainerForm
        open={!!containerTripId}
        onOpenChange={(open) => !open && setContainerTripId(null)}
        onSubmit={handleAddContainers}
        isLoading={isSubmitting}
      />

      <AlertDialog open={!!tripToDelete} onOpenChange={() => setTripToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar viaje?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará permanentemente el viaje y todos sus contenedores asociados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteTrip}
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
