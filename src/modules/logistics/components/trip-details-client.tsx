"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
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
  ArrowLeft,
  Route as RouteIcon,
  CalendarDays,
  Clock,
  MapPin,
  Package,
  CircleDollarSign,
  UserRound,
  Fingerprint,
  Phone,
  Building2,
  FileBadge,
  Truck,
  SquareStack,
  Container as ContainerIcon,
  Plus,
  Trash2,
  Eye,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { ContainerForm, type ContainerSubmitPayload } from "./container-form";
import {
  createContainer,
  createContainersBulk,
  deleteContainer,
} from "../actions/container-actions";
import type { TripStatus } from "@/generated/prisma";

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

interface TripInfo {
  tripId: number;
  driverId: number;
  loadDate: string | null;
  loadTime: string | null;
  tripPayment: string | null;
  province: string | null;
  product: string | null;
  status: TripStatus;
}

interface DriverInfo {
  driverId: number;
  fullName: string;
  identificationNumber: string;
  phoneNumber: string;
  operativeLicense: string | null;
}

interface EntityInfo {
  entityId: number;
  name: string;
}

interface VehicleInfo {
  vehicleId: number;
  name: string | null;
  cunaPlateNumber: string | null;
  planchaPlateNumber: string | null;
}

interface ContainerRow {
  containerId: number;
  serialNumber: string;
  type: string | null;
}

interface Props {
  trip: TripInfo;
  driver: DriverInfo;
  entity: EntityInfo;
  vehicles: VehicleInfo[];
  containers: ContainerRow[];
}

export function TripDetailsClient({
  trip,
  driver,
  entity,
  vehicles,
  containers,
}: Props) {
  const router = useRouter();
  const [isContainerFormOpen, setIsContainerFormOpen] = useState(false);
  const [containerToDelete, setContainerToDelete] = useState<{
    id: number;
    serial: string;
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const statusMeta = STATUS_META[trip.status];

  const handleAddContainers = async (payload: ContainerSubmitPayload) => {
    setIsSubmitting(true);
    try {
      if (payload.mode === "single") {
        const result = await createContainer({
          trip_id: trip.tripId,
          serial_number: payload.serial_number,
          type: payload.type,
        });
        if (result.success) {
          toast.success("Contenedor agregado");
          setIsContainerFormOpen(false);
          router.refresh();
        } else {
          toast.error(result.error);
        }
      } else {
        const result = await createContainersBulk({
          trip_id: trip.tripId,
          serial_numbers: payload.serial_numbers,
          type: payload.type,
        });
        if (result.success) {
          const { created, skipped } = result.data;
          toast.success(
            `${created} contenedor${created === 1 ? "" : "es"} agregado${created === 1 ? "" : "s"}` +
              (skipped > 0 ? ` · ${skipped} duplicado${skipped === 1 ? "" : "s"} omitido${skipped === 1 ? "" : "s"}` : "")
          );
          setIsContainerFormOpen(false);
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
      toast.success("Contenedor eliminado");
      setContainerToDelete(null);
      router.refresh();
    } else {
      toast.error(result.error);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/trips">
          <Button variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver
          </Button>
        </Link>
      </div>

      <PageHeader
        icon={RouteIcon}
        title={`Viaje #${trip.tripId}`}
        description={driver.fullName}
        badge={statusMeta.label}
        meta={
          <Badge variant={statusMeta.variant} className="h-7 px-3">
            {statusMeta.label}
          </Badge>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Informacion del viaje */}
        <div className="lg:col-span-2 rounded-xl border border-border bg-card shadow-panel p-5">
          <h2 className="font-headline text-base font-semibold mb-4 flex items-center gap-2">
            <RouteIcon className="h-4 w-4 text-[var(--brand)]" />
            Informacion del viaje
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <InfoRow
              icon={CalendarDays}
              label="Fecha de carga"
              value={trip.loadDate || "—"}
            />
            <InfoRow
              icon={Clock}
              label="Hora de carga"
              value={trip.loadTime || "—"}
            />
            <InfoRow
              icon={MapPin}
              label="Provincia"
              value={trip.province || "—"}
            />
            <InfoRow
              icon={Package}
              label="Producto"
              value={trip.product || "—"}
            />
            <InfoRow
              icon={CircleDollarSign}
              label="Pago"
              value={trip.tripPayment ? `$${trip.tripPayment}` : "—"}
              valueClass={trip.tripPayment ? "text-[var(--success)] font-semibold" : ""}
            />
          </div>
        </div>

        {/* Conductor */}
        <div className="rounded-xl border border-border bg-card shadow-panel p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-headline text-base font-semibold flex items-center gap-2">
              <UserRound className="h-4 w-4 text-[var(--brand)]" />
              Conductor
            </h2>
            <Link href={`/drivers/${driver.driverId}`}>
              <Button variant="ghost" size="sm">
                <Eye className="h-3.5 w-3.5" />
                Ver
              </Button>
            </Link>
          </div>
          <div className="space-y-2.5 text-sm">
            <div className="font-semibold text-foreground">{driver.fullName}</div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Building2 className="h-3.5 w-3.5" />
              <Badge variant="outline" className="text-xs">
                {entity.name}
              </Badge>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Fingerprint className="h-3.5 w-3.5" />
              <span>{driver.identificationNumber}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Phone className="h-3.5 w-3.5" />
              <a
                href={`tel:${driver.phoneNumber}`}
                className="hover:text-[var(--brand)] transition-colors"
              >
                {driver.phoneNumber}
              </a>
            </div>
            {driver.operativeLicense && (
              <div className="flex items-center gap-2">
                <FileBadge className="h-3.5 w-3.5 text-muted-foreground" />
                <Badge variant="info" className="text-xs">
                  {driver.operativeLicense}
                </Badge>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Vehiculos */}
      <div className="rounded-xl border border-border bg-card shadow-panel p-5">
        <h2 className="font-headline text-base font-semibold mb-4 flex items-center gap-2">
          <Truck className="h-4 w-4 text-[var(--brand)]" />
          Vehiculos del conductor ({vehicles.length})
        </h2>
        {vehicles.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {vehicles.map((v) => (
              <Link
                key={v.vehicleId}
                href={`/vehicles/${v.vehicleId}`}
                className="group flex items-start gap-3 rounded-lg border border-border bg-background p-3 transition-colors hover:border-[var(--brand)]/40 hover:bg-[var(--brand)]/[0.04]"
              >
                <div className="flex size-10 items-center justify-center rounded-lg bg-gradient-to-br from-[var(--brand)]/20 to-[var(--brand)]/5 ring-1 ring-inset ring-[var(--brand)]/20 shrink-0">
                  <Truck className="h-4 w-4 text-[var(--brand)]" strokeWidth={2.2} />
                </div>
                <div className="flex-1 min-w-0 text-sm">
                  <div className="font-semibold truncate">
                    {v.name || `Vehiculo #${v.vehicleId}`}
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground mt-1">
                    {v.cunaPlateNumber && (
                      <span className="inline-flex items-center gap-1">
                        <SquareStack className="h-3 w-3" />
                        Cuna: {v.cunaPlateNumber}
                      </span>
                    )}
                    {v.planchaPlateNumber && (
                      <span className="inline-flex items-center gap-1">
                        <SquareStack className="h-3 w-3" />
                        Plancha: {v.planchaPlateNumber}
                      </span>
                    )}
                  </div>
                </div>
                <Eye className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-1" />
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState
            title="Sin vehiculos"
            description="Este conductor aun no tiene vehiculos asignados."
          />
        )}
      </div>

      {/* Contenedores */}
      <div className="rounded-xl border border-border bg-card shadow-panel overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-muted/30 px-5 py-3">
          <h2 className="font-headline text-base font-semibold flex items-center gap-2">
            <ContainerIcon className="h-4 w-4 text-[var(--brand)]" />
            Contenedores
            <Badge variant="brand">{containers.length}</Badge>
          </h2>
          <Button
            variant="brand"
            size="sm"
            onClick={() => setIsContainerFormOpen(true)}
          >
            <Plus className="h-4 w-4" />
            Agregar contenedor(es)
          </Button>
        </div>
        {containers.length > 0 ? (
          <ul className="divide-y divide-border/60">
            {containers.map((c) => (
              <li
                key={c.containerId}
                className="group flex items-center gap-3 px-5 py-3"
              >
                <div className="flex size-9 items-center justify-center rounded-md bg-muted/60 shrink-0">
                  <ContainerIcon className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-mono text-sm font-medium">
                    {c.serialNumber}
                  </div>
                  {c.type && (
                    <div className="text-xs text-muted-foreground">
                      Tipo: {c.type}
                    </div>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 text-muted-foreground opacity-60 group-hover:opacity-100 hover:text-destructive"
                  onClick={() =>
                    setContainerToDelete({
                      id: c.containerId,
                      serial: c.serialNumber,
                    })
                  }
                  aria-label="Eliminar contenedor"
                >
                  <X className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="p-8">
            <EmptyState
              title="Sin contenedores"
              description="Agrega los contenedores de este viaje. Puedes cargar varios a la vez."
            />
          </div>
        )}
      </div>

      <ContainerForm
        open={isContainerFormOpen}
        onOpenChange={setIsContainerFormOpen}
        onSubmit={handleAddContainers}
        isLoading={isSubmitting}
      />

      <AlertDialog
        open={!!containerToDelete}
        onOpenChange={() => setContainerToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar contenedor</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminara el contenedor{" "}
              <span className="font-semibold text-foreground">
                {containerToDelete?.serial}
              </span>{" "}
              de este viaje.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteContainer}
              className="bg-destructive text-white hover:bg-destructive/90"
              disabled={isSubmitting}
            >
              <Trash2 className="h-4 w-4" />
              {isSubmitting ? "Eliminando..." : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
  valueClass,
}: {
  icon: typeof CalendarDays;
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
      <div className="min-w-0">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className={`text-sm mt-0.5 ${valueClass || ""}`}>{value}</div>
      </div>
    </div>
  );
}
