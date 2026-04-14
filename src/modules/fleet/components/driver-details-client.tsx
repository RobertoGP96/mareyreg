"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, IdCardIcon, Phone, IdCardLanyard, Truck, RouteIcon, Building2, Box } from "lucide-react";
import type { Vehicle, Entity, Trip, Container } from "@/types";

interface DriverInfo {
  driverId: number;
  fullName: string;
  identificationNumber: string;
  phoneNumber: string;
  operativeLicense: string | null;
  entity: Entity;
}

type TripWithContainers = Trip & { containers: Container[] };

interface Props {
  driver: DriverInfo;
  vehicles: Vehicle[];
  trips: TripWithContainers[];
}

export function DriverDetailsClient({ driver, vehicles, trips }: Props) {
  const vehicle = vehicles[0];

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
            <IdCardIcon className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">ID:</span>
            <span>{driver.identificationNumber}</span>
          </div>
          <div className="flex items-center gap-2">
            <Phone className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">Telefono:</span>
            <span>{driver.phoneNumber}</span>
          </div>
          {driver.operativeLicense && (
            <div className="flex items-center gap-2">
              <IdCardLanyard className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">Licencia:</span>
              <Badge variant="secondary">{driver.operativeLicense}</Badge>
            </div>
          )}
        </div>
      </div>

      {/* Vehicle */}
      {vehicle && (
        <div className="bg-card p-4 rounded-lg border">
          <h2 className="text-base font-semibold mb-4 flex items-center gap-2">
            <Truck className="h-5 w-5" />
            Vehiculo Asignado
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            {vehicle.name && (
              <div>
                <span className="font-medium">Nombre:</span> {vehicle.name}
              </div>
            )}
            {vehicle.cunaPlateNumber && (
              <div>
                <span className="font-medium">Placa Cuna:</span>{" "}
                {vehicle.cunaPlateNumber}
              </div>
            )}
            {vehicle.planchaPlateNumber && (
              <div>
                <span className="font-medium">Placa Plancha:</span>{" "}
                {vehicle.planchaPlateNumber}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Trips */}
      <div className="bg-card p-4 rounded-lg border">
        <h2 className="text-base font-semibold mb-4 flex items-center gap-2">
          <RouteIcon className="h-5 w-5" />
          Viajes ({trips.length})
        </h2>
        {trips.length > 0 ? (
          <div className="space-y-3">
            {trips.map((trip) => (
              <div
                key={trip.tripId}
                className="border rounded-lg p-3 text-sm"
              >
                <div className="flex justify-between items-center">
                  <div className="flex gap-4">
                    {trip.loadDate && <span>{trip.loadDate}</span>}
                    {trip.province && (
                      <Badge variant="outline">{trip.province}</Badge>
                    )}
                    {trip.product && <span>{trip.product}</span>}
                  </div>
                  {trip.tripPayment && (
                    <span className="font-semibold">${trip.tripPayment}</span>
                  )}
                </div>
                {trip.containers.length > 0 && (
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <Box className="h-3.5 w-3.5 text-muted-foreground" />
                    {trip.containers.map((c) => (
                      <Badge key={c.containerId} variant="outline" className="text-xs">
                        {c.serialNumber}
                        {c.type && ` (${c.type})`}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground">No hay viajes registrados.</p>
        )}
      </div>
    </div>
  );
}
