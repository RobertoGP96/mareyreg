"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
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
      trip.driverFullName
        ?.toLowerCase()
        .includes(searchQuery.toLowerCase()) ||
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
    } else {
      toast.error(result.error);
    }
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
    } else {
      toast.error(result.error);
    }
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
    } else {
      toast.error(result.error);
    }
  };

  const handleAddContainer = async (data: {
    serial_number: string;
    type?: string;
  }) => {
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
    } else {
      toast.error(result.error);
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
    } else {
      toast.error(result.error);
    }
  };

  return (
    <>
      <div className="bg-card shadow-sm rounded-lg border">
        <div className="px-6 py-4 border-b border-border">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-medium text-foreground">
              Lista de Viajes
            </h2>
            <Button onClick={() => setIsCreateOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Agregar
            </Button>
          </div>
          <div className="mt-4">
            <InputGroup>
              <InputGroupInput
                placeholder="Buscar viajes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <InputGroupAddon>
                <Search />
              </InputGroupAddon>
              <InputGroupAddon align="inline-end">
                <Badge>{filteredTrips.length}</Badge>
              </InputGroupAddon>
            </InputGroup>
          </div>
        </div>
        <div className="grid gap-4 p-6">
          {filteredTrips.length > 0 ? (
            filteredTrips.map((trip) => (
              <div
                key={trip.tripId}
                className="bg-card border border-border rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200 p-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start space-x-3 flex-1 min-w-0">
                    <div className="p-2 rounded-xl bg-muted">
                      <RouteIcon className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-lg font-semibold text-foreground truncate">
                          {trip.driverFullName || `Viaje #${trip.tripId}`}
                        </h3>
                        {trip.province && (
                          <Badge variant="outline">{trip.province}</Badge>
                        )}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm text-muted-foreground">
                        {trip.loadDate && (
                          <div>
                            <span className="font-medium">Fecha:</span>{" "}
                            {trip.loadDate}
                          </div>
                        )}
                        {trip.product && (
                          <div>
                            <span className="font-medium">Producto:</span>{" "}
                            {trip.product}
                          </div>
                        )}
                        {trip.tripPayment && (
                          <div>
                            <span className="font-medium">Pago:</span> $
                            {trip.tripPayment}
                          </div>
                        )}
                      </div>
                      {trip.containers.length > 0 && (
                        <div className="flex items-center gap-2 mt-3 flex-wrap">
                          <Box className="h-4 w-4 text-muted-foreground shrink-0" />
                          <span className="text-sm font-medium text-muted-foreground">
                            Contenedores:
                          </span>
                          {trip.containers.map((c) => (
                            <Badge
                              key={c.containerId}
                              variant="secondary"
                              className="text-xs cursor-pointer hover:bg-destructive/10"
                              onClick={() =>
                                setContainerToDelete({
                                  id: c.containerId,
                                  serial: c.serialNumber,
                                })
                              }
                            >
                              {c.serialNumber}
                              {c.type && ` (${c.type})`}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => setContainerTripId(trip.tripId)}
                        className="flex items-center space-x-2"
                      >
                        <Box className="h-4 w-4" />
                        <span>Agregar contenedor</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => setTripToEdit(trip)}
                        className="flex items-center space-x-2"
                      >
                        <Pen className="h-4 w-4" />
                        <span>Editar</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => setTripToDelete(trip.tripId)}
                        className="flex items-center space-x-2 text-red-600 focus:text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                        <span>Eliminar</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            ))
          ) : (
            <EmptyState
              title="No hay viajes"
              description="No se encontraron viajes registrados."
            />
          )}
        </div>
      </div>

      {/* Create Trip Dialog */}
      <TripForm
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        onSubmit={handleCreateTrip}
        isLoading={isSubmitting}
        drivers={drivers}
      />

      {/* Edit Trip Dialog */}
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

      {/* Container Form Dialog */}
      <ContainerForm
        open={!!containerTripId}
        onOpenChange={(open) => !open && setContainerTripId(null)}
        onSubmit={handleAddContainer}
        isLoading={isSubmitting}
      />

      {/* Delete Trip Dialog */}
      <AlertDialog
        open={!!tripToDelete}
        onOpenChange={() => setTripToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Estas seguro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta accion eliminara permanentemente el viaje y todos sus
              contenedores asociados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteTrip}
              className="bg-red-600 hover:bg-red-700"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Eliminando..." : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Container Dialog */}
      <AlertDialog
        open={!!containerToDelete}
        onOpenChange={() => setContainerToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar contenedor?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminara el contenedor {containerToDelete?.serial} de este
              viaje.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteContainer}
              className="bg-red-600 hover:bg-red-700"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Eliminando..." : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
