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
import { Search, Trash2, MoreHorizontal, Plus, SquarePen, Truck, SquareStack, UserRound, Eye } from "lucide-react";
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
      toast.success("Vehículo creado exitosamente", {
        description: `${data.name || "Vehículo"} ha sido registrado en el sistema.`,
      });
      router.refresh();
    } else toast.error("Error al crear el vehículo", { description: result.error });
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
      toast.success("Vehículo actualizado exitosamente");
      router.refresh();
    } else toast.error("Error al actualizar el vehículo", { description: result.error });
  };

  const handleDeleteVehicle = async () => {
    if (!vehicleToDelete) return;
    setIsSubmitting(true);
    const result = await deleteVehicle(vehicleToDelete);
    setIsSubmitting(false);
    if (result.success) {
      setVehicleToDelete(null);
      toast.success("Vehículo eliminado exitosamente");
      router.refresh();
    } else toast.error(result.error);
  };

  return (
    <div className="space-y-5">
      <PageHeader
        icon={Truck}
        title="Vehículos"
        description="Flota de vehículos con placas, documentación y conductores asignados."
        badge={`${initialVehicles.length} vehículos`}
        actions={
          <Button variant="brand" onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className="h-4 w-4" />
            Nuevo vehículo
          </Button>
        }
      />

      <div className="rounded-xl border border-border bg-card shadow-panel overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 border-b border-border bg-muted/30 px-4 py-3">
          <InputGroup className="flex-1 min-w-[240px]">
            <InputGroupAddon>
              <Search />
            </InputGroupAddon>
            <InputGroupInput
              placeholder="Buscar por nombre, placa o conductor…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <InputGroupAddon align="inline-end">
              <Badge variant="brand">{filteredVehicles.length}</Badge>
            </InputGroupAddon>
          </InputGroup>
        </div>

        <div className="divide-y divide-border/60">
          {filteredVehicles.length > 0 ? (
            filteredVehicles.map((vehicle) => (
              <div
                key={vehicle.vehicle_id}
                className="group flex items-start gap-4 px-5 py-4 transition-colors hover:bg-[var(--brand)]/[0.04]"
              >
                <div className="flex size-11 items-center justify-center rounded-lg bg-gradient-to-br from-[var(--brand)]/20 to-[var(--brand)]/5 ring-1 ring-inset ring-[var(--brand)]/20 shrink-0">
                  <Truck className="h-5 w-5 text-[var(--brand)]" strokeWidth={2.2} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1.5">
                    <h3 className="font-semibold text-foreground truncate">
                      {vehicle.name || `Vehículo #${vehicle.vehicle_id}`}
                    </h3>
                    {vehicle.driver && (
                      <Badge variant="info" className="gap-1">
                        <UserRound className="h-3 w-3" />
                        {vehicle.driver.full_name}
                      </Badge>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-x-5 gap-y-1 text-[0.82rem] text-muted-foreground">
                    {vehicle.cuña_plate_number && (
                      <span className="inline-flex items-center gap-1.5">
                        <SquareStack className="h-3.5 w-3.5" />
                        <span className="font-medium">Cuña:</span> {vehicle.cuña_plate_number}
                      </span>
                    )}
                    {vehicle.plancha_plate_number && (
                      <span className="inline-flex items-center gap-1.5">
                        <SquareStack className="h-3.5 w-3.5" />
                        <span className="font-medium">Plancha:</span> {vehicle.plancha_plate_number}
                      </span>
                    )}
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="size-8 opacity-60 group-hover:opacity-100">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-44">
                    <DropdownMenuItem
                      onClick={() => router.push(`/vehicles/${vehicle.vehicle_id}`)}
                    >
                      <Eye className="h-4 w-4" /> Ver detalles
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setVehicleToEdit(vehicle)}>
                      <SquarePen className="h-4 w-4" /> Editar
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => setVehicleToDelete(vehicle.vehicle_id)}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" /> Eliminar
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ))
          ) : (
            <div className="p-8">
              <EmptyState
                title="No hay vehículos"
                description={
                  searchQuery
                    ? `No se encontraron resultados para "${searchQuery}".`
                    : "Registra el primer vehículo para empezar."
                }
              />
            </div>
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

      <AlertDialog open={!!vehicleToDelete} onOpenChange={() => setVehicleToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar vehículo?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará permanentemente el vehículo y no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteVehicle}
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
