import { useState, useEffect, useCallback } from "react"
import { useNavigate, useParams } from "react-router-dom"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { getDriverWithDetails } from "@/services/driverService"
import type { Driver, Vehicle, Trip } from "@/types/types"
import { Truck, User, MapPin, Calendar, Clock, DollarSign, FileText, ArrowLeft } from "lucide-react"

interface DriverDetailsProps {
  driverId?: number | null
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

interface DriverDetailsData {
  driver: Driver
  vehicle?: Vehicle
  trips: Trip[]
}

export function DriverDetails({ driverId: propDriverId, open, onOpenChange }: DriverDetailsProps) {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const driverId = propDriverId || (id ? parseInt(id) : null)
  const [data, setData] = useState<DriverDetailsData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadDriverDetails = useCallback(async () => {
    if (!driverId) return

    setLoading(true)
    setError(null)

    try {
      const details = await getDriverWithDetails(driverId)
      setData(details)
    } catch (err) {
      setError("Error al cargar los detalles del conductor")
      console.error("Error loading driver details:", err)
    } finally {
      setLoading(false)
    }
  }, [driverId])

  useEffect(() => {
    if (driverId) {
      loadDriverDetails()
    }
  }, [driverId, loadDriverDetails])

  const formatDate = (date: Date | string | undefined) => {
    if (!date) return "No especificada"
    const d = typeof date === 'string' ? new Date(date) : date
    return d.toLocaleDateString('es-ES')
  }

  const formatTime = (time: string | undefined) => {
    if (!time) return "No especificada"
    return time
  }

  const formatCurrency = (amount: string | undefined) => {
    if (!amount) return "No especificado"
    return `$${parseFloat(amount).toFixed(2)}`
  }

  const handleGoBack = () => {
    if (onOpenChange) {
      onOpenChange(false)
    } else {
      navigate('/drivers')
    }
  }

  // Si es usado como dialog
  if (open !== undefined) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Detalles del Conductor
            </DialogTitle>
            <DialogDescription>
              Información completa del conductor, su vehículo asignado y viajes realizados.
            </DialogDescription>
          </DialogHeader>

          {loading && (
            <div className="space-y-4">
              <Skeleton className="h-8 w-3/4" />
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-48 w-full" />
            </div>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {data && !loading && (
            <div className="space-y-6">
              {/* Información del Conductor */}
              <div className="border rounded-lg p-6 bg-white shadow-sm">
                <div className="mb-4">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <User className="h-5 w-5" />
                    Información del Conductor
                  </h3>
                </div>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-500">Nombre Completo</label>
                      <p className="text-sm">{data.driver.full_name}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Número de Identificación</label>
                      <p className="text-sm">{data.driver.identification_number}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Número de Teléfono</label>
                      <p className="text-sm">{data.driver.phone_number}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Licencia Operativa</label>
                      <p className="text-sm">{data.driver.operative_license || "No especificada"}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Información del Vehículo */}
              <div className="border rounded-lg p-6 bg-white shadow-sm">
                <div className="mb-4">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Truck className="h-5 w-5" />
                    Vehículo Asignado
                  </h3>
                </div>
                <div>
                  {data.vehicle ? (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-sm font-medium text-gray-500">Número de Circulación Cuña</label>
                          <p className="text-sm">{data.vehicle.cuña_circulation_number || "No especificado"}</p>
                        </div>
                        <div>
                          <label className="text-sm font-medium text-gray-500">Número de Circulación Plancha</label>
                          <p className="text-sm">{data.vehicle.plancha_circulation_number || "No especificado"}</p>
                        </div>
                        <div>
                          <label className="text-sm font-medium text-gray-500">Número de Placa Cuña</label>
                          <p className="text-sm">{data.vehicle.cuña_plate_number || "No especificado"}</p>
                        </div>
                        <div>
                          <label className="text-sm font-medium text-gray-500">Número de Placa Plancha</label>
                          <p className="text-sm">{data.vehicle.plancha_plate_number || "No especificado"}</p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">No hay vehículo asignado a este conductor.</p>
                  )}
                </div>
              </div>

              {/* Viajes Realizados */}
              <div className="border rounded-lg p-6 bg-white shadow-sm">
                <div className="mb-4">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <MapPin className="h-5 w-5" />
                    Viajes Realizados ({data.trips.length})
                  </h3>
                </div>
                <div>
                  {data.trips.length > 0 ? (
                    <div className="space-y-4">
                      {data.trips.map((trip) => (
                        <div key={trip.trip_id} className="border rounded-lg p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <FileText className="h-4 w-4" />
                              <span className="font-medium">Viaje #{trip.trip_id}</span>
                            </div>
                            <Badge variant="outline">
                              {trip.province || "Provincia no especificada"}
                            </Badge>
                          </div>

                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                              <label className="text-xs font-medium text-gray-500 flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                Fecha de Carga
                              </label>
                              <p>{formatDate(trip.load_date)}</p>
                            </div>
                            <div>
                              <label className="text-xs font-medium text-gray-500 flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                Hora de Carga
                              </label>
                              <p>{formatTime(trip.load_time)}</p>
                            </div>
                            <div>
                              <label className="text-xs font-medium text-gray-500 flex items-center gap-1">
                                <FileText className="h-3 w-3" />
                                Contenedor
                              </label>
                              <p>{trip.container_number || "No especificado"}</p>
                            </div>
                            <div>
                              <label className="text-xs font-medium text-gray-500 flex items-center gap-1">
                                <DollarSign className="h-3 w-3" />
                                Pago
                              </label>
                              <p>{formatCurrency(trip.trip_payment)}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">Este conductor no ha realizado viajes aún.</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    )
  }

  // Si es usado como página
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" onClick={handleGoBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Volver
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Detalles del Conductor</h1>
          <p className="text-gray-600 mt-2">Información completa del conductor, su vehículo asignado y viajes realizados.</p>
        </div>
      </div>

      {loading && (
        <div className="space-y-4">
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {data && !loading && (
        <div className="space-y-6">
          {/* Información del Conductor */}
          <div className="border rounded-lg p-6 bg-white shadow-sm">
            <div className="mb-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <User className="h-5 w-5" />
                Información del Conductor
              </h3>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">Nombre Completo</label>
                  <p className="text-sm">{data.driver.full_name}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Número de Identificación</label>
                  <p className="text-sm">{data.driver.identification_number}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Número de Teléfono</label>
                  <p className="text-sm">{data.driver.phone_number}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Licencia Operativa</label>
                  <p className="text-sm">{data.driver.operative_license || "No especificada"}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Información del Vehículo */}
          <div className="border rounded-lg p-6 bg-white shadow-sm">
            <div className="mb-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Truck className="h-5 w-5" />
                Vehículo Asignado
              </h3>
            </div>
            <div>
              {data.vehicle ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-500">Número de Circulación Cuña</label>
                      <p className="text-sm">{data.vehicle.cuña_circulation_number || "No especificado"}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Número de Circulación Plancha</label>
                      <p className="text-sm">{data.vehicle.plancha_circulation_number || "No especificado"}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Número de Placa Cuña</label>
                      <p className="text-sm">{data.vehicle.cuña_plate_number || "No especificado"}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Número de Placa Plancha</label>
                      <p className="text-sm">{data.vehicle.plancha_plate_number || "No especificado"}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-500">No hay vehículo asignado a este conductor.</p>
              )}
            </div>
          </div>

          {/* Viajes Realizados */}
          <div className="border rounded-lg p-6 bg-white shadow-sm">
            <div className="mb-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Viajes Realizados ({data.trips.length})
              </h3>
            </div>
            <div>
              {data.trips.length > 0 ? (
                <div className="space-y-4">
                  {data.trips.map((trip) => (
                    <div key={trip.trip_id} className="border rounded-lg p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4" />
                          <span className="font-medium">Viaje #{trip.trip_id}</span>
                        </div>
                        <Badge variant="outline">
                          {trip.province || "Provincia no especificada"}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <label className="text-xs font-medium text-gray-500 flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            Fecha de Carga
                          </label>
                          <p>{formatDate(trip.load_date)}</p>
                        </div>
                        <div>
                          <label className="text-xs font-medium text-gray-500 flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            Hora de Carga
                          </label>
                          <p>{formatTime(trip.load_time)}</p>
                        </div>
                        <div>
                          <label className="text-xs font-medium text-gray-500 flex items-center gap-1">
                            <FileText className="h-3 w-3" />
                            Contenedor
                          </label>
                          <p>{trip.container_number || "No especificado"}</p>
                        </div>
                        <div>
                          <label className="text-xs font-medium text-gray-500 flex items-center gap-1">
                            <DollarSign className="h-3 w-3" />
                            Pago
                          </label>
                          <p>{formatCurrency(trip.trip_payment)}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">Este conductor no ha realizado viajes aún.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}