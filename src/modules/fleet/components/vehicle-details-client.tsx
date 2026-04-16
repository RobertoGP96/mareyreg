"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import {
  ArrowLeft,
  Truck,
  SquareStack,
  FileText,
  UserRound,
  Fingerprint,
  Phone,
  Building2,
  FileBadge,
  Route as RouteIcon,
  CalendarDays,
  MapPin,
  Package,
  CircleDollarSign,
  Container as ContainerIcon,
  Eye,
} from "lucide-react";
import type { TripStatus, VehicleStatus } from "@/generated/prisma";

type StatusVariant = "success" | "warning" | "info" | "destructive" | "outline";

const TRIP_STATUS_META: Record<
  TripStatus,
  { label: string; variant: StatusVariant }
> = {
  scheduled: { label: "Programado", variant: "info" },
  in_progress: { label: "En curso", variant: "warning" },
  completed: { label: "Completado", variant: "success" },
  cancelled: { label: "Cancelado", variant: "destructive" },
};

const VEHICLE_STATUS_META: Record<
  VehicleStatus,
  { label: string; variant: StatusVariant }
> = {
  active: { label: "Activo", variant: "success" },
  maintenance: { label: "Mantenimiento", variant: "warning" },
  inactive: { label: "Inactivo", variant: "outline" },
};

interface VehicleInfo {
  vehicleId: number;
  name: string | null;
  cunaPlateNumber: string | null;
  planchaPlateNumber: string | null;
  cunaCirculationNumber: string | null;
  planchaCirculationNumber: string | null;
  status: VehicleStatus;
  driverId: number | null;
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

interface TripRow {
  tripId: number;
  loadDate: string | null;
  loadTime: string | null;
  tripPayment: string | null;
  province: string | null;
  product: string | null;
  status: TripStatus;
  containers: { containerId: number; serialNumber: string }[];
}

interface Props {
  vehicle: VehicleInfo;
  driver: DriverInfo | null;
  entity: EntityInfo | null;
  trips: TripRow[];
}

export function VehicleDetailsClient({
  vehicle,
  driver,
  entity,
  trips,
}: Props) {
  const statusMeta = VEHICLE_STATUS_META[vehicle.status];

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/vehicles">
          <Button variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver
          </Button>
        </Link>
      </div>

      <PageHeader
        icon={Truck}
        title={vehicle.name || `Vehiculo #${vehicle.vehicleId}`}
        description={driver ? `Conductor: ${driver.fullName}` : "Sin conductor asignado"}
        badge={statusMeta.label}
      >
        <Badge variant={statusMeta.variant} className="h-7 px-3">
          {statusMeta.label}
        </Badge>
      </PageHeader>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Informacion del vehiculo */}
        <div className="lg:col-span-2 rounded-xl border border-border bg-card shadow-panel p-5">
          <h2 className="font-headline text-base font-semibold mb-4 flex items-center gap-2">
            <Truck className="h-4 w-4 text-[var(--brand)]" />
            Informacion del vehiculo
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <InfoRow
              icon={SquareStack}
              label="Placa Cuna"
              value={vehicle.cunaPlateNumber || "—"}
            />
            <InfoRow
              icon={SquareStack}
              label="Placa Plancha"
              value={vehicle.planchaPlateNumber || "—"}
            />
            <InfoRow
              icon={FileText}
              label="Circulacion Cuna"
              value={vehicle.cunaCirculationNumber || "—"}
            />
            <InfoRow
              icon={FileText}
              label="Circulacion Plancha"
              value={vehicle.planchaCirculationNumber || "—"}
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
            {driver && (
              <Link href={`/drivers/${driver.driverId}`}>
                <Button variant="ghost" size="sm">
                  <Eye className="h-3.5 w-3.5" />
                  Ver
                </Button>
              </Link>
            )}
          </div>
          {driver && entity ? (
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
          ) : (
            <EmptyState
              title="Sin conductor"
              description="Este vehiculo aun no tiene conductor asignado."
            />
          )}
        </div>
      </div>

      {/* Viajes */}
      <div className="rounded-xl border border-border bg-card shadow-panel overflow-hidden">
        <div className="flex items-center justify-between border-b border-border bg-muted/30 px-5 py-3">
          <h2 className="font-headline text-base font-semibold flex items-center gap-2">
            <RouteIcon className="h-4 w-4 text-[var(--brand)]" />
            Viajes del conductor
            <Badge variant="brand">{trips.length}</Badge>
          </h2>
        </div>
        {trips.length > 0 ? (
          <ul className="divide-y divide-border/60">
            {trips.map((t) => {
              const tMeta = TRIP_STATUS_META[t.status];
              return (
                <li
                  key={t.tripId}
                  className="group px-5 py-3 transition-colors hover:bg-[var(--brand)]/[0.04]"
                >
                  <Link
                    href={`/trips/${t.tripId}`}
                    className="flex items-center gap-3"
                  >
                    <div className="flex size-10 items-center justify-center rounded-lg bg-gradient-to-br from-[var(--brand)]/20 to-[var(--brand)]/5 ring-1 ring-inset ring-[var(--brand)]/20 shrink-0">
                      <RouteIcon
                        className="h-4 w-4 text-[var(--brand)]"
                        strokeWidth={2.2}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="font-semibold">Viaje #{t.tripId}</span>
                        <Badge variant={tMeta.variant} className="text-xs">
                          {tMeta.label}
                        </Badge>
                        {t.province && (
                          <Badge variant="info" className="gap-1 text-xs">
                            <MapPin className="h-3 w-3" />
                            {t.province}
                          </Badge>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                        {t.loadDate && (
                          <span className="inline-flex items-center gap-1">
                            <CalendarDays className="h-3 w-3" />
                            {t.loadDate}
                            {t.loadTime && ` · ${t.loadTime}`}
                          </span>
                        )}
                        {t.product && (
                          <span className="inline-flex items-center gap-1">
                            <Package className="h-3 w-3" />
                            {t.product}
                          </span>
                        )}
                        {t.tripPayment && (
                          <span className="inline-flex items-center gap-1 text-[var(--success)]">
                            <CircleDollarSign className="h-3 w-3" />${t.tripPayment}
                          </span>
                        )}
                        {t.containers.length > 0 && (
                          <span className="inline-flex items-center gap-1">
                            <ContainerIcon className="h-3 w-3" />
                            {t.containers.length} contenedor
                            {t.containers.length === 1 ? "" : "es"}
                          </span>
                        )}
                      </div>
                    </div>
                    <Eye className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="p-8">
            <EmptyState
              title="Sin viajes"
              description={
                driver
                  ? "El conductor aun no tiene viajes registrados."
                  : "Asigna un conductor a este vehiculo para ver viajes."
              }
            />
          </div>
        )}
      </div>
    </div>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof SquareStack;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
      <div className="min-w-0">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-sm mt-0.5">{value}</div>
      </div>
    </div>
  );
}
