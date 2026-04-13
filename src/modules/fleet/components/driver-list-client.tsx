"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
  IdCardIcon,
  IdCardLanyard,
  Pen,
  Phone,
  Search,
  Trash2,
  MoreHorizontal,
  UserPlus,
  Eye,
  Copy,
} from "lucide-react";
import { toast } from "sonner";
import {
  createDriver,
  updateDriver,
  deleteDriver,
} from "../actions/driver-actions";
import { DriverForm } from "./driver-form";
import type { Driver } from "@/types";

interface Props {
  initialDrivers: Driver[];
  vehicles: unknown[];
}

export function DriverListClient({ initialDrivers }: Props) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [driverToDelete, setDriverToDelete] = useState<number | null>(null);
  const [driverToEdit, setDriverToEdit] = useState<Driver | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const sortedDrivers = [...initialDrivers].sort((a, b) =>
    a.fullName.localeCompare(b.fullName)
  );

  const filteredDrivers = sortedDrivers.filter(
    (driver) =>
      driver.fullName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      driver.identificationNumber
        ?.toLowerCase()
        .includes(searchQuery.toLowerCase()) ||
      driver.phoneNumber
        ?.toLowerCase()
        .includes(searchQuery.toLowerCase()) ||
      driver.operativeLicense
        ?.toLowerCase()
        .includes(searchQuery.toLowerCase())
  );

  const handleCreateDriver = async (data: {
    full_name: string;
    identification_number: string;
    phone_number: string;
    operative_license?: string;
    vehicleData?: {
      name?: string;
      cuña_circulation_number?: string;
      plancha_circulation_number?: string;
      cuña_plate_number?: string;
      plancha_plate_number?: string;
    };
  }) => {
    setIsSubmitting(true);
    const result = await createDriver(data);
    setIsSubmitting(false);

    if (result.success) {
      setIsCreateDialogOpen(false);
      toast.success("Conductor creado exitosamente", {
        description: `${data.full_name} ha sido registrado en el sistema.`,
      });
      router.refresh();
    } else {
      toast.error("Error al crear el conductor", {
        description: result.error,
      });
    }
  };

  const handleUpdateDriver = async (data: {
    full_name: string;
    identification_number: string;
    phone_number: string;
    operative_license?: string;
  }) => {
    if (!driverToEdit) return;
    setIsSubmitting(true);
    const result = await updateDriver(driverToEdit.driverId, data);
    setIsSubmitting(false);

    if (result.success) {
      setDriverToEdit(null);
      toast.success("Conductor actualizado exitosamente", {
        description: `Los datos de ${data.full_name} han sido actualizados.`,
      });
      router.refresh();
    } else {
      toast.error("Error al actualizar el conductor", {
        description: result.error,
      });
    }
  };

  const handleDeleteDriver = async () => {
    if (!driverToDelete) return;
    setIsSubmitting(true);
    const result = await deleteDriver(driverToDelete);
    setIsSubmitting(false);

    if (result.success) {
      setDriverToDelete(null);
      toast.success("Conductor eliminado exitosamente");
      router.refresh();
    } else {
      toast.error("Error al eliminar el conductor", {
        description: result.error,
      });
    }
  };

  const handleCopyContactInfo = async (driver: Driver) => {
    const contactInfo =
      `Nombre: ${driver.fullName}\nTelefono: ${driver.phoneNumber}`.trim();
    try {
      await navigator.clipboard.writeText(contactInfo);
      toast.success("Informacion de contacto copiada al portapapeles");
    } catch {
      toast.error("Error al copiar al portapapeles");
    }
  };

  return (
    <>
      <div className="bg-card shadow-sm rounded-lg border">
        <div className="px-6 py-4 border-b border-border">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-medium text-foreground">
              Lista de Conductores
            </h2>
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <UserPlus className="w-4 h-4 mr-2" />
              Agregar
            </Button>
          </div>

          <div className="mt-4">
            <InputGroup>
              <InputGroupInput
                placeholder="Buscar conductores..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <InputGroupAddon>
                <Search />
              </InputGroupAddon>
              <InputGroupAddon align="inline-end">
                <Badge>{filteredDrivers.length}</Badge>
              </InputGroupAddon>
            </InputGroup>
          </div>
        </div>
        <div className="grid gap-4 p-6">
          {filteredDrivers.length > 0 ? (
            filteredDrivers.map((driver) => (
              <div
                key={driver.driverId}
                className="bg-card border border-border rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200 p-4 overflow-hidden"
              >
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                  <div className="flex items-start space-x-3 flex-1 min-w-0 overflow-hidden">
                    <Avatar className="w-10 h-10 bg-muted rounded-full flex items-center justify-center shrink-0">
                      <AvatarFallback>
                        <p className="text-lg uppercase font-semibold text-foreground truncate">
                          {driver.fullName
                            ? driver.fullName
                                .split(" ")
                                .map((name) => name.charAt(0))
                                .join("")
                                .toUpperCase()
                                .slice(0, 2)
                            : "?"}
                        </p>
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0 overflow-hidden">
                      <h3 className="text-lg font-semibold text-foreground mb-2 truncate">
                        {driver.fullName}
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-muted-foreground">
                        <div className="flex items-center space-x-2 min-w-0 overflow-hidden">
                          <IdCardIcon className="w-4 h-4 text-muted-foreground shrink-0" />
                          <span className="font-medium shrink-0">ID:</span>
                          <span className="truncate">
                            {driver.identificationNumber}
                          </span>
                        </div>
                        <div className="flex items-center space-x-2 min-w-0 overflow-hidden">
                          <Phone className="w-4 h-4 text-muted-foreground shrink-0" />
                          <span className="font-medium shrink-0">
                            Telefono:
                          </span>
                          <span className="truncate">
                            {driver.phoneNumber}
                          </span>
                        </div>
                        {driver.operativeLicense && (
                          <div className="flex items-center space-x-2 min-w-0 overflow-hidden">
                            <IdCardLanyard className="w-4 h-4 text-muted-foreground shrink-0" />
                            <span className="font-medium shrink-0">
                              Licencia:
                            </span>
                            <Badge
                              variant="secondary"
                              className="truncate max-w-full"
                            >
                              {driver.operativeLicense}
                            </Badge>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="shrink-0">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => handleCopyContactInfo(driver)}
                          className="flex items-center space-x-2"
                        >
                          <Copy className="h-4 w-4" />
                          <span>Copiar contacto</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() =>
                            router.push(`/drivers/${driver.driverId}`)
                          }
                          className="flex items-center space-x-2"
                        >
                          <Eye className="h-4 w-4" />
                          <span>Ver detalles</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => setDriverToEdit(driver)}
                          className="flex items-center space-x-2"
                        >
                          <Pen className="h-4 w-4" />
                          <span>Editar</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => setDriverToDelete(driver.driverId)}
                          className="flex items-center space-x-2 text-red-600 focus:text-red-600"
                        >
                          <Trash2 className="h-4 w-4" />
                          <span>Eliminar</span>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <EmptyState
              title="No hay conductores"
              description="No se encontraron conductores registrados."
            />
          )}
        </div>
      </div>

      <DriverForm
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onSubmit={handleCreateDriver}
        isLoading={isSubmitting}
      />

      <DriverForm
        open={!!driverToEdit}
        onOpenChange={(open) => !open && setDriverToEdit(null)}
        onSubmit={handleUpdateDriver}
        isLoading={isSubmitting}
        driver={driverToEdit}
      />

      <AlertDialog
        open={!!driverToDelete}
        onOpenChange={() => setDriverToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Estas seguro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta accion no se puede deshacer. Esto eliminara permanentemente el
              conductor y removera sus datos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteDriver}
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
