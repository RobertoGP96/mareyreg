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
import { Search, Trash2, MoreHorizontal, Plus, Pen, Truck } from "lucide-react";
import { toast } from "sonner";
import {
  createVehicle,
  updateVehicle,
  deleteVehicle,
} from "../actions/vehicle-actions";
import { VehicleForm } from "./vehicle-form";
import type { Driver } from "@/types";

interface VehicleRow {
  vehicle_id: number;
  name: string | null;
  cuña_circulation_number: string | null;
  plancha_circulation_number: string | null;
  cuña_plate_number: string | null;
  plancha_plate_number: string | null;
  driver_id: number | null;
  driver: {
    driver_id: number;
    full_name: string;
    identification_number: string;
    phone_number: string;
    operative_license: string | null;
  } | null;
}

interface Props {
  initialVehicles: VehicleRow[];
  drivers: Driver[];
}

export function VehicleListClient({ initialVehicles, drivers }: Props) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [vehicleToEdit, setVehicleToEdit] = useState<VehicleRow | null>(null);
  const [vehicleToDelete, setVehicleToDelete] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const filteredVehicles = initialVehicles.filter(
    (v) =>
      v.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.cuña_plate_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.plancha_plate_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.driver?.full_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreateVehicle = async (data: {
    name?: string;
    cuña_circulation_number?: string;
    plancha_circulation_number?: string;
    cuña_plate_number?: string;
    plancha_plate_number?: string;
    driver_id?: number;
  }) => {
    setIsSubmitting(true);
    const result = await createVehicle(data);
    setIsSubmitting(false);

    if (result.success) {
      setIsCreateDialogOpen(false);
      toast.success("Vehiculo creado exitosamente", {
        description: `${data.name || "Vehiculo"} ha sido registrado en el sistema.`,
      });
      router.refresh();
    } else {
      toast.error("Error al crear el vehiculo", {
        description: result.error,
      });
    }
  };

  const handleUpdateVehicle = async (data: {
    name?: string;
    cuña_circulation_number?: string;
    plancha_circulation_number?: string;
    cuña_plate_number?: string;
    plancha_plate_number?: string;
    driver_id?: number;
  }) => {
    if (!vehicleToEdit) return;
    setIsSubmitting(true);
    const result = await updateVehicle(vehicleToEdit.vehicle_id, {
      ...data,
      driver_id: data.driver_id ?? null,
    });
    setIsSubmitting(false);

    if (result.success) {
      setVehicleToEdit(null);
      toast.success("Vehiculo actualizado exitosamente", {
        description: `Los datos del vehiculo han sido actualizados.`,
      });
      router.refresh();
    } else {
      toast.error("Error al actualizar el vehiculo", {
        description: result.error,
      });
    }
  };

  const handleDeleteVehicle = async () => {
    if (!vehicleToDelete) return;
    setIsSubmitting(true);
    const result = await deleteVehicle(vehicleToDelete);
    setIsSubmitting(false);

    if (result.success) {
      setVehicleToDelete(null);
      toast.success("Vehiculo eliminado exitosamente");
      router.refresh();
    } else {
      toast.error(result.error);
    }
  };

  return (
    <>
      <div className="bg-card shadow-sm rounded-lg border">
        <div className="px-4 py-3 border-b border-border">
          <div className="flex justify-between items-center">
            <h2 className="text-base font-medium text-foreground">
              Lista de Vehiculos
            </h2>
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Agregar
            </Button>
          </div>
          <div className="mt-4">
            <InputGroup>
              <InputGroupInput
                placeholder="Buscar vehiculos..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <InputGroupAddon>
                <Search />
              </InputGroupAddon>
              <InputGroupAddon align="inline-end">
                <Badge>{filteredVehicles.length}</Badge>
              </InputGroupAddon>
            </InputGroup>
          </div>
        </div>
        <div className="grid gap-4 p-4">
          {filteredVehicles.length > 0 ? (
            filteredVehicles.map((vehicle) => (
              <div
                key={vehicle.vehicle_id}
                className="bg-card border border-border rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200 p-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start space-x-3 flex-1 min-w-0">
                    <div className="p-2 rounded-xl bg-muted">
                      <Truck className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-base font-semibold text-foreground truncate">
                        {vehicle.name || `Vehiculo #${vehicle.vehicle_id}`}
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-muted-foreground mt-2">
                        {vehicle.cuña_plate_number && (
                          <div>
                            <span className="font-medium">Placa Cuna:</span>{" "}
                            {vehicle.cuña_plate_number}
                          </div>
                        )}
                        {vehicle.plancha_plate_number && (
                          <div>
                            <span className="font-medium">Placa Plancha:</span>{" "}
                            {vehicle.plancha_plate_number}
                          </div>
                        )}
                        {vehicle.driver && (
                          <div className="sm:col-span-2">
                            <span className="font-medium">Conductor:</span>{" "}
                            <Badge variant="secondary">
                              {vehicle.driver.full_name}
                            </Badge>
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
                      <DropdownMenuItem
                        onClick={() => setVehicleToEdit(vehicle)}
                        className="flex items-center space-x-2"
                      >
                        <Pen className="h-4 w-4" />
                        <span>Editar</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => setVehicleToDelete(vehicle.vehicle_id)}
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
              title="No hay vehiculos"
              description="No se encontraron vehiculos registrados."
            />
          )}
        </div>
      </div>

      <VehicleForm
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onSubmit={handleCreateVehicle}
        isLoading={isSubmitting}
        drivers={drivers}
      />

      <VehicleForm
        open={!!vehicleToEdit}
        onOpenChange={(open) => !open && setVehicleToEdit(null)}
        onSubmit={handleUpdateVehicle}
        isLoading={isSubmitting}
        vehicle={
          vehicleToEdit
            ? {
                name: vehicleToEdit.name,
                cuña_circulation_number: vehicleToEdit.cuña_circulation_number,
                plancha_circulation_number: vehicleToEdit.plancha_circulation_number,
                cuña_plate_number: vehicleToEdit.cuña_plate_number,
                plancha_plate_number: vehicleToEdit.plancha_plate_number,
                driver_id: vehicleToEdit.driver_id,
              }
            : null
        }
        drivers={drivers}
      />

      <AlertDialog
        open={!!vehicleToDelete}
        onOpenChange={() => setVehicleToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Estas seguro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta accion eliminara permanentemente el vehiculo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteVehicle}
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
