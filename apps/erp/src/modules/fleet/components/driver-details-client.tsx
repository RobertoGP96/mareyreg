"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import {
  ArrowLeft,
  Fingerprint,
  Phone,
  FileBadge,
  Truck,
  Route as RouteIcon,
  Building2,
  Container as ContainerIcon,
  SquareStack,
  Eye,
  MapPin,
  CalendarDays,
  Package,
  CircleDollarSign,
} from "lucide-react";
import type { Vehicle, Entity, Trip, Container, TripStatus } from "@/types";

interface DriverInfo {
  driverId: number;
  fullName: string;
  identificationNumber: string;
  phoneNumber: string;
  operativeLicense: string | null;
  entity: Entity;
}

type TripWithContainers = Trip & { containers: Container[] };

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

interface Props {
  driver: DriverInfo;
  vehicles: Vehicle[];
  trips: TripWithContainers[];
}

export function DriverDetailsClient({ driver, vehicles, trips }: Props) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <Link href="/drivers">
          <Button variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver
          </Button>
        </Link>
        <h1 className="text-xl font-semibold">{driver.fullName}</h1>
      </div>

      {/* Driver Info */}
      <div className="bg-card p-4 rounded-lg border">
        <h2 className="text-base font-semibold mb-4">Informacion del Conductor</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">Entidad:</span>
            <Badge variant="secondary">{driver.entity.name}</Badge>
          </div>
          <div className="flex items-center gap-2">
            <Fingerprint className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">ID:</span>
            <span>{driver.identificationNumber}</span>
          </div>
          <div className="flex items-center gap-2">
            <Phone className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">Telefono:</span>
            <a
              href={`tel:${driver.phoneNumber}`}
              className="hover:text-[var(--brand)] transition-colors"
            >
              {driver.phoneNumber}
            </a>
          </div>
          {driver.operativeLicense && (
            <div className="flex items-center gap-2">
              <FileBadge className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">Licencia:</span>
              <Badge variant="secondary">{driver.operativeLicense}</Badge>
            </div>
          )}
        </div>
      </div>

      {/* Vehicles */}
      <div className="bg-card p-4 rounded-lg border">
        <h2 className="text-base font-semibold mb-4 flex items-center gap-2">
          <Truck className="h-5 w-5" />
          Vehiculos ({vehicles.length})
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

      {/* Trips */}
      <div className="bg-card p-4 rounded-lg border">
        <h2 className="text-base font-semibold mb-4 flex items-center gap-2">
          <RouteIcon className="h-5 w-5" />
          Viajes ({trips.length})
        </h2>
        {trips.length > 0 ? (
          <div className="space-y-2">
            {trips.map((trip) => {
              const meta = TRIP_STATUS_META[trip.status];
              return (
                <Link
                  key={trip.tripId}
                  href={`/trips/${trip.tripId}`}
                  className="group block rounded-lg border border-border bg-background p-3 text-sm transition-colors hover:border-[var(--brand)]/40 hover:bg-[var(--brand)]/[0.04]"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">Viaje #{trip.tripId}</span>
                      <Badge variant={meta.variant} className="text-xs">
                        {meta.label}
                      </Badge>
                      {trip.province && (
                        <Badge variant="info" className="gap-1 text-xs">
                          <MapPin className="h-3 w-3" />
                          {trip.province}
                        </Badge>
                      )}
                    </div>
                    {trip.tripPayment && (
                      <span className="text-[var(--success)] font-semibold">
                        ${trip.tripPayment}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                    {trip.loadDate && (
                      <span className="inline-flex items-center gap-1">
                        <CalendarDays className="h-3 w-3" />
                        {trip.loadDate}
                        {trip.loadTime && ` · ${trip.loadTime}`}
                      </span>
                    )}
                    {trip.product && (
                      <span className="inline-flex items-center gap-1">
                        <Package className="h-3 w-3" />
                        {trip.product}
                      </span>
                    )}
                    {trip.tripPayment && (
                      <span className="inline-flex items-center gap-1 text-[var(--success)] sm:hidden">
                        <CircleDollarSign className="h-3 w-3" />${trip.tripPayment}
                      </span>
                    )}
                  </div>
                  {trip.containers.length > 0 && (
                    <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                      <ContainerIcon className="h-3 w-3 text-muted-foreground" />
                      {trip.containers.map((c) => (
                        <Badge
                          key={c.containerId}
                          variant="outline"
                          className="text-xs font-mono"
                        >
                          {c.serialNumber}
                          {c.type && (
                            <span className="opacity-60 ml-1">· {c.type}</span>
                          )}
                        </Badge>
                      ))}
                    </div>
                  )}
                </Link>
              );
            })}
          </div>
        ) : (
          <EmptyState
            title="Sin viajes"
            description="Este conductor aun no tiene viajes registrados."
          />
        )}
      </div>
    </div>
  );
}
