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
} from "lucide-react";
import { toast } from "sonner";
import { deleteTrip } from "../actions/trip-actions";
import type { Driver } from "@/types";

interface TripRow {
  tripId: number;
  driverId: number;
  containerNumber: string | null;
  loadDate: string | null;
  loadTime: string | null;
  tripPayment: string | null;
  province: string | null;
  product: string | null;
  driverFullName: string | null;
}

interface Props {
  initialTrips: TripRow[];
  drivers: Driver[];
}

export function TripListClient({ initialTrips }: Props) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [tripToDelete, setTripToDelete] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const filteredTrips = initialTrips.filter(
    (trip) =>
      trip.driverFullName
        ?.toLowerCase()
        .includes(searchQuery.toLowerCase()) ||
      trip.province?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      trip.product?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      trip.containerNumber?.toLowerCase().includes(searchQuery.toLowerCase())
  );

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

  return (
    <>
      <div className="bg-card shadow-sm rounded-lg border">
        <div className="px-6 py-4 border-b border-border">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-medium text-foreground">
              Lista de Viajes
            </h2>
            <Button onClick={() => toast.info("Formulario de viaje - En desarrollo")}>
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
                        {trip.containerNumber && (
                          <div>
                            <span className="font-medium">Contenedor:</span>{" "}
                            {trip.containerNumber}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem className="flex items-center space-x-2">
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

      <AlertDialog
        open={!!tripToDelete}
        onOpenChange={() => setTripToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Estas seguro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta accion eliminara permanentemente el viaje.
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
    </>
  );
}
