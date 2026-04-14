"use client";

import { useState } from "react";
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
  Pen,
  RouteIcon,
  Box,
  Calendar,
  Package,
  DollarSign,
  MapPin,
} from "lucide-react";
import { toast } from "sonner";
import { createTrip, updateTrip, deleteTrip } from "../actions/trip-actions";
import { createContainer, deleteContainer } from "../actions/container-actions";
import { TripForm } from "./trip-form";
import { ContainerForm } from "./container-form";
import type { Driver } from "@/types";

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
  driverFullName: string | null;
  containers: ContainerRow[];
}

interface Props {
  initialTrips: TripRow[];
  drivers: Driver[];
}

export function TripListClient({ initialTrips, drivers }: Props) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [tripToEdit, setTripToEdit] = useState<TripRow | null>(null);
  const [tripToDelete, setTripToDelete] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [containerTripId, setContainerTripId] = useState<number | null>(null);
  const [containerToDelete, setContainerToDelete] = useState<{
    id: number;
    serial: string;
  } | null>(null);

  const filteredTrips = initialTrips.filter(
    (trip) =>
      trip.driverFullName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      trip.province?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      trip.product?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      trip.containers.some((c) =>
        c.serialNumber.toLowerCase().includes(searchQuery.toLowerCase())
      )
  );

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

  const handleAddContainer = async (data: { serial_number: string; type?: string }) => {
    if (!containerTripId) return;
    setIsSubmitting(true);
    const result = await createContainer({
      trip_id: containerTripId,
      serial_number: data.serial_number,
      type: data.type,
    });
    setIsSubmitting(false);
    if (result.success) {
      setContainerTripId(null);
      toast.success("Contenedor agregado exitosamente");
      router.refresh();
    } else toast.error(result.error);
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
        <div className="flex flex-wrap items-center gap-3 border-b border-border bg-muted/30 px-4 py-3">
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

        <div className="divide-y divide-border/60">
          {filteredTrips.length > 0 ? (
            filteredTrips.map((trip) => (
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
                          <Calendar className="h-3.5 w-3.5" />
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
                          <DollarSign className="h-3.5 w-3.5" />
                          {trip.tripPayment}
                        </span>
                      )}
                    </div>
                    {trip.containers.length > 0 && (
                      <div className="flex items-center gap-2 mt-3 flex-wrap">
                        <span className="inline-flex items-center gap-1 text-[0.7rem] font-semibold uppercase tracking-wider text-muted-foreground">
                          <Box className="h-3 w-3" />
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
                      <DropdownMenuItem onClick={() => setContainerTripId(trip.tripId)}>
                        <Box className="h-4 w-4" /> Agregar contenedor
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setTripToEdit(trip)}>
                        <Pen className="h-4 w-4" /> Editar
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
            ))
          ) : (
            <div className="p-8">
              <EmptyState
                title="No hay viajes"
                description={
                  searchQuery
                    ? `No se encontraron resultados para "${searchQuery}".`
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
        onSubmit={handleAddContainer}
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
