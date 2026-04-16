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
import {
  Search,
  Trash2,
  MoreHorizontal,
  Plus,
  SquarePen,
  Route as RouteIcon,
  Container,
  CalendarDays,
  Package,
  CircleDollarSign,
  MapPin,
  Eye,
  UserRound,
  ListFilter,
} from "lucide-react";
import { toast } from "sonner";
import { createTrip, updateTrip, deleteTrip } from "../actions/trip-actions";
import {
  createContainer,
  createContainersBulk,
  deleteContainer,
} from "../actions/container-actions";
import { TripForm } from "./trip-form";
import { ContainerForm, type ContainerSubmitPayload } from "./container-form";
import { CUBAN_PROVINCES } from "@/lib/constants";
import type { Driver, TripStatus } from "@/types";

interface ContainerRow {
  containerId: number;
  serialNumber: string;
  type: string | null;
}

interface TripRow {
  tripId: number;
  driverId: number;
  loadDate: string | null;
  loadTime: string | null;
  tripPayment: string | null;
  province: string | null;
  product: string | null;
  status: TripStatus;
  driverFullName: string | null;
  containers: ContainerRow[];
}

interface Props {
  initialTrips: TripRow[];
  drivers: Driver[];
}

type StatusVariant = "success" | "warning" | "info" | "destructive" | "outline";

const STATUS_META: Record<
  TripStatus,
  { label: string; variant: StatusVariant }
> = {
  scheduled: { label: "Programado", variant: "info" },
  in_progress: { label: "En curso", variant: "warning" },
  completed: { label: "Completado", variant: "success" },
  cancelled: { label: "Cancelado", variant: "destructive" },
};

const STATUS_OPTIONS: { value: TripStatus; label: string }[] = [
  { value: "scheduled", label: "Programado" },
  { value: "in_progress", label: "En curso" },
  { value: "completed", label: "Completado" },
  { value: "cancelled", label: "Cancelado" },
];

const ALL = "__all__";

export function TripListClient({ initialTrips, drivers }: Props) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [provinceFilter, setProvinceFilter] = useState<string>(ALL);
  const [driverFilter, setDriverFilter] = useState<string>(ALL);
  const [statusFilter, setStatusFilter] = useState<string>(ALL);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [tripToEdit, setTripToEdit] = useState<TripRow | null>(null);
  const [tripToDelete, setTripToDelete] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [containerTripId, setContainerTripId] = useState<number | null>(null);
  const [containerToDelete, setContainerToDelete] = useState<{
    id: number;
    serial: string;
  } | null>(null);

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
        trip.containers.some((c) =>
          c.serialNumber.toLowerCase().includes(q)
        )
      );
    });
  }, [initialTrips, searchQuery, provinceFilter, driverFilter, statusFilter]);

  const handleCreateTrip = async (data: {
    driver_id: number;
    load_date?: string;
    load_time?: string;
    trip_payment?: string;
    province?: string;
    product?: string;
  }) => {
    setIsSubmitting(true);
    const result = await createTrip(data);
    setIsSubmitting(false);
    if (result.success) {
      setIsCreateOpen(false);
      toast.success("Viaje creado exitosamente");
      router.refresh();
    } else toast.error(result.error);
  };

  const handleUpdateTrip = async (data: {
    driver_id: number;
    load_date?: string;
    load_time?: string;
    trip_payment?: string;
    province?: string;
    product?: string;
  }) => {
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
        } else {
          toast.error(result.error);
        }
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
        } else {
          toast.error(result.error);
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteContainer = async () => {
    if (!containerToDelete) return;
    setIsSubmitting(true);
    const result = await deleteContainer(containerToDelete.id);
    setIsSubmitting(false);
    if (result.success) {
      setContainerToDelete(null);
      toast.success("Contenedor eliminado exitosamente");
      router.refresh();
    } else toast.error(result.error);
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

  return (
    <div className="space-y-5">
      <PageHeader
        icon={RouteIcon}
        title="Viajes"
        description="Programación y seguimiento de viajes con conductor, destino y contenedores."
        badge={`${initialTrips.length} viajes`}
      >
        <Button variant="brand" onClick={() => setIsCreateOpen(true)}>
          <Plus className="h-4 w-4" />
          Nuevo viaje
        </Button>
      </PageHeader>

      <div className="rounded-xl border border-border bg-card shadow-panel overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-border bg-muted/30 px-4 py-3">
          <div className="flex flex-wrap items-center gap-3">
            <InputGroup className="flex-1 min-w-[240px]">
              <InputGroupAddon>
                <Search />
              </InputGroupAddon>
              <InputGroupInput
                placeholder="Buscar por conductor, provincia, producto o contenedor…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <InputGroupAddon align="inline-end">
                <Badge variant="brand">{filteredTrips.length}</Badge>
              </InputGroupAddon>
            </InputGroup>
          </div>

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
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs"
                onClick={clearFilters}
              >
                Limpiar ({activeFilters})
              </Button>
            )}
          </div>
        </div>

        <div className="divide-y divide-border/60">
          {filteredTrips.length > 0 ? (
            filteredTrips.map((trip) => {
              const meta = STATUS_META[trip.status];
              return (
                <div
                  key={trip.tripId}
                  className="group px-5 py-4 transition-colors hover:bg-[var(--brand)]/[0.04]"
                >
                  <div className="flex items-start gap-4">
                    <div className="flex size-11 items-center justify-center rounded-lg bg-gradient-to-br from-[var(--brand)]/20 to-[var(--brand)]/5 ring-1 ring-inset ring-[var(--brand)]/20 shrink-0">
                      <RouteIcon className="h-5 w-5 text-[var(--brand)]" strokeWidth={2.2} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1.5">
                        <h3 className="font-semibold text-foreground truncate">
                          {trip.driverFullName || `Viaje #${trip.tripId}`}
                        </h3>
                        <Badge variant={meta.variant} className="text-xs">
                          {meta.label}
                        </Badge>
                        {trip.province && (
                          <Badge variant="info" className="gap-1">
                            <MapPin className="h-3 w-3" />
                            {trip.province}
                          </Badge>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-x-5 gap-y-1 text-[0.82rem] text-muted-foreground">
                        {trip.loadDate && (
                          <span className="inline-flex items-center gap-1.5">
                            <CalendarDays className="h-3.5 w-3.5" />
                            {trip.loadDate}
                            {trip.loadTime && ` · ${trip.loadTime}`}
                          </span>
                        )}
                        {trip.product && (
                          <span className="inline-flex items-center gap-1.5">
                            <Package className="h-3.5 w-3.5" />
                            {trip.product}
                          </span>
                        )}
                        {trip.tripPayment && (
                          <span className="inline-flex items-center gap-1.5 text-[var(--success)]">
                            <CircleDollarSign className="h-3.5 w-3.5" />
                            {trip.tripPayment}
                          </span>
                        )}
                      </div>
                      {trip.containers.length > 0 && (
                        <div className="flex items-center gap-2 mt-3 flex-wrap">
                          <span className="inline-flex items-center gap-1 text-[0.7rem] font-semibold uppercase tracking-wider text-muted-foreground">
                            <Container className="h-3 w-3" />
                            Contenedores
                          </span>
                          {trip.containers.map((c) => (
                            <Badge
                              key={c.containerId}
                              variant="outline"
                              className="gap-1 cursor-pointer hover:bg-destructive/10 hover:border-destructive/30 hover:text-destructive transition-colors"
                              onClick={() =>
                                setContainerToDelete({
                                  id: c.containerId,
                                  serial: c.serialNumber,
                                })
                              }
                              title="Click para eliminar"
                            >
                              {c.serialNumber}
                              {c.type && <span className="opacity-60">· {c.type}</span>}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="size-8 opacity-60 group-hover:opacity-100">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem
                          onClick={() => router.push(`/trips/${trip.tripId}`)}
                        >
                          <Eye className="h-4 w-4" /> Ver detalles
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => router.push(`/drivers/${trip.driverId}`)}
                        >
                          <UserRound className="h-4 w-4" /> Ver conductor
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setContainerTripId(trip.tripId)}>
                          <Container className="h-4 w-4" /> Agregar contenedor(es)
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setTripToEdit(trip)}>
                          <SquarePen className="h-4 w-4" /> Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => setTripToDelete(trip.tripId)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" /> Eliminar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="p-8">
              <EmptyState
                title="No hay viajes"
                description={
                  searchQuery || activeFilters > 0
                    ? "No se encontraron resultados con los filtros aplicados."
                    : "Crea el primer viaje para empezar."
                }
              />
            </div>
          )}
        </div>
      </div>

      <TripForm
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        onSubmit={handleCreateTrip}
        isLoading={isSubmitting}
        drivers={drivers}
      />

      <TripForm
        open={!!tripToEdit}
        onOpenChange={(open) => !open && setTripToEdit(null)}
        onSubmit={handleUpdateTrip}
        isLoading={isSubmitting}
        drivers={drivers}
        trip={
          tripToEdit
            ? {
                tripId: tripToEdit.tripId,
                driverId: tripToEdit.driverId,
                loadDate: tripToEdit.loadDate,
                loadTime: tripToEdit.loadTime,
                tripPayment: tripToEdit.tripPayment,
                province: tripToEdit.province,
                product: tripToEdit.product,
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

      <AlertDialog open={!!containerToDelete} onOpenChange={() => setContainerToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar contenedor?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará el contenedor <span className="font-semibold text-foreground">{containerToDelete?.serial}</span> de este viaje.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteContainer}
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
