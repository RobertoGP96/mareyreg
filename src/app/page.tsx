export const dynamic = "force-dynamic";

import Link from "next/link";
import { Users, Truck, ClipboardList, RouteIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getDrivers } from "@/modules/fleet/queries/driver-queries";
import { getVehicles } from "@/modules/fleet/queries/vehicle-queries";
import { getTrips } from "@/modules/logistics/queries/trip-queries";

export default async function Home() {
  const [driversData, vehiclesData, tripsData] = await Promise.all([
    getDrivers(),
    getVehicles(),
    getTrips(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <div className="w-full flex justify-center items-center">
          <div>
            <div className="w-35 rounded-xl">
              <img
                className="w-full h-auto"
                src="/truck.svg"
                alt=""
                width="140"
                height="140"
              />
            </div>
            <p className="roadway-font text-5xl font-bold">MAREYreg</p>
          </div>
        </div>
        <h1 className="text-3xl font-bold text-gray-900">Inicio</h1>
        <p className="text-gray-600 mt-2">Bienvenido al Registro de Viajes</p>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center flex-row gap-2">
            <div className="p-2 rounded-xl bg-gray-200">
              <Users className="h-8 w-8 text-gray-600" />
            </div>
            <div className="flex flex-row justify-between w-full">
              <h2 className="text-xl font-semibold text-gray-900">
                Conductores
              </h2>
              <p className="text-2xl font-bold text-gray-600">
                {driversData.length}
              </p>
            </div>
          </div>
          <p className="text-gray-600 mt-2">Conductores registrados</p>
          <Link href="/drivers">
            <Button className="mt-4 w-full">
              <ClipboardList className="h-4 w-4 mr-2" />
              Gestionar Conductores
            </Button>
          </Link>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center flex-row gap-2">
            <div className="p-2 rounded-xl bg-gray-200">
              <RouteIcon className="h-8 w-8 text-gray-600" />
            </div>
            <div className="flex flex-row justify-between w-full">
              <h2 className="text-xl font-semibold text-gray-900">Viajes</h2>
              <p className="text-2xl font-bold text-gray-600">
                {tripsData.length}
              </p>
            </div>
          </div>
          <p className="text-gray-600 mt-2">Viajes registrados</p>
          <Link href="/trips">
            <Button className="mt-4 w-full">
              <ClipboardList className="h-4 w-4 mr-2" />
              Gestionar Viajes
            </Button>
          </Link>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center flex-row gap-2">
            <div className="p-2 rounded-xl bg-gray-200">
              <Truck className="h-8 w-8 text-gray-600" />
            </div>
            <div className="flex flex-row justify-between w-full">
              <h2 className="text-xl font-semibold text-gray-900">
                Vehiculos
              </h2>
              <p className="text-2xl font-bold text-gray-600">
                {vehiclesData.length}
              </p>
            </div>
          </div>
          <p className="text-gray-600 mt-2">Vehiculos en flota</p>
          <Link href="/vehicles">
            <Button className="mt-4 w-full">
              <ClipboardList className="h-4 w-4 mr-2" />
              Gestionar Vehiculos
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
