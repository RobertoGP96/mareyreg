"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
  Building2,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import {
  createDriver,
  updateDriver,
  deleteDriver,
} from "../actions/driver-actions";
import { DriverForm } from "./driver-form";
import type { DriverWithEntity, Entity } from "@/types";

interface Props {
  initialDrivers: DriverWithEntity[];
  vehicles: unknown[];
  entities: Entity[];
}

export function DriverListClient({ initialDrivers, entities }: Props) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [driverToDelete, setDriverToDelete] = useState<number | null>(null);
  const [driverToEdit, setDriverToEdit] = useState<DriverWithEntity | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const sortedDrivers = [...initialDrivers].sort((a, b) =>
    a.fullName.localeCompare(b.fullName)
  );

  const filteredDrivers = sortedDrivers.filter(
    (driver) =>
      driver.fullName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      driver.identificationNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      driver.phoneNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      driver.operativeLicense?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      driver.entity.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreateDriver = async (data: {
    entity_id: number;
    full_name: string;
    identification_number: string;
    phone_number: string;
    operative_license?: string;
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
      toast.error("Error al crear el conductor", { description: result.error });
    }
  };

  const handleUpdateDriver = async (data: {
    entity_id: number;
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
      toast.error("Error al actualizar el conductor", { description: result.error });
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
      toast.error("Error al eliminar el conductor", { description: result.error });
    }
  };

  const handleCopyContactInfo = async (driver: DriverWithEntity) => {
    const contactInfo =
      `Nombre: ${driver.fullName}\nTelefono: ${driver.phoneNumber}`.trim();
    try {
      await navigator.clipboard.writeText(contactInfo);
      toast.success("Información de contacto copiada al portapapeles");
    } catch {
      toast.error("Error al copiar al portapapeles");
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        icon={Users}
        title="Conductores"
        description="Gestiona los conductores asignados a tu flota y sus datos de contacto."
        badge={`${initialDrivers.length} registrados`}
      >
        <Button variant="brand" onClick={() => setIsCreateDialogOpen(true)}>
          <UserPlus className="h-4 w-4" />
          Agregar conductor
        </Button>
      </PageHeader>

      <div className="rounded-xl border border-border bg-card shadow-panel overflow-hidden">
        {/* Filter bar */}
        <div className="flex flex-wrap items-center gap-3 border-b border-border bg-muted/30 px-4 py-3">
          <InputGroup className="flex-1 min-w-[240px]">
            <InputGroupAddon>
              <Search />
            </InputGroupAddon>
            <InputGroupInput
              placeholder="Buscar por nombre, ID, teléfono…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <InputGroupAddon align="inline-end">
              <Badge variant="brand">{filteredDrivers.length}</Badge>
            </InputGroupAddon>
          </InputGroup>
        </div>

        {/* List */}
        <div className="divide-y divide-border/60">
          {filteredDrivers.length > 0 ? (
            filteredDrivers.map((driver) => (
              <div
                key={driver.driverId}
                className="group flex items-start gap-4 px-5 py-4 transition-colors hover:bg-[var(--brand)]/[0.04]"
              >
                <Avatar className="size-11 bg-gradient-to-br from-[var(--brand)]/20 to-[var(--brand)]/5 ring-1 ring-inset ring-[var(--brand)]/20 shrink-0">
                  <AvatarFallback className="bg-transparent text-[var(--brand)] font-bold text-sm">
                    {driver.fullName
                      ? driver.fullName
                          .split(" ")
                          .map((n) => n.charAt(0))
                          .join("")
                          .toUpperCase()
                          .slice(0, 2)
                      : "?"}
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1.5">
                    <h3 className="font-semibold text-foreground truncate">
                      {driver.fullName}
                    </h3>
                    <Badge variant="outline" className="gap-1">
                      <Building2 className="h-3 w-3" />
                      {driver.entity.name}
                    </Badge>
                    {driver.operativeLicense && (
                      <Badge variant="info" className="gap-1">
                        <IdCardLanyard className="h-3 w-3" />
                        {driver.operativeLicense}
                      </Badge>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-x-5 gap-y-1 text-[0.82rem] text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      <IdCardIcon className="h-3.5 w-3.5" />
                      {driver.identificationNumber}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Phone className="h-3.5 w-3.5" />
                      {driver.phoneNumber}
                    </span>
                  </div>
                </div>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="size-8 opacity-60 group-hover:opacity-100">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem onClick={() => handleCopyContactInfo(driver)}>
                      <Copy className="h-4 w-4" /> Copiar contacto
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => router.push(`/drivers/${driver.driverId}`)}>
                      <Eye className="h-4 w-4" /> Ver detalles
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setDriverToEdit(driver)}>
                      <Pen className="h-4 w-4" /> Editar
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => setDriverToDelete(driver.driverId)}
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
                title="No hay conductores"
                description={
                  searchQuery
                    ? `No se encontraron resultados para "${searchQuery}".`
                    : "Aún no hay conductores registrados. Crea el primero para comenzar."
                }
              />
            </div>
          )}
        </div>
      </div>

      <DriverForm
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onSubmit={handleCreateDriver}
        isLoading={isSubmitting}
        entities={entities}
      />

      <DriverForm
        open={!!driverToEdit}
        onOpenChange={(open) => !open && setDriverToEdit(null)}
        onSubmit={handleUpdateDriver}
        isLoading={isSubmitting}
        driver={driverToEdit}
        entities={entities}
      />

      <AlertDialog open={!!driverToDelete} onOpenChange={() => setDriverToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar conductor?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminará permanentemente el conductor y todos sus datos asociados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteDriver}
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
