"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, IdCardIcon, Phone, IdCardLanyard, Truck, RouteIcon } from "lucide-react";
import type { Driver, Vehicle, Trip } from "@/types";

interface Props {
  driver: Driver;
  vehicles: Vehicle[];
  trips: Trip[];
}

export function DriverDetailsClient({ driver, vehicles, trips }: Props) {
  const vehicle = vehicles[0]; // Primary vehicle

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/drivers">
          <Button variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver
          </Button>
        </Link>
        <h1 className="text-2xl font-bold">{driver.fullName}</h1>
      </div>

      {/* Driver Info */}
      <div className="bg-card p-6 rounded-lg shadow-sm border">
        <h2 className="text-lg font-semibold mb-4">Informacion del Conductor</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
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
        <div className="bg-card p-6 rounded-lg shadow-sm border">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
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
      <div className="bg-card p-6 rounded-lg shadow-sm border">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
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
                {trip.containerNumber && (
                  <p className="text-muted-foreground mt-1">
                    Contenedor: {trip.containerNumber}
                  </p>
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
