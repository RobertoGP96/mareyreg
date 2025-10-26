import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { Trip, CreateTrip, Driver } from "@/types/types"
import { Loader2, Plus, Save } from "lucide-react"

const CUBAN_PROVINCES = [
  "Pinar del Río",
  "Artemisa",
  "La Habana",
  "Mayabeque",
  "Matanzas",
  "Cienfuegos",
  "Villa Clara",
  "Sancti Spíritus",
  "Ciego de Ávila",
  "Camagüey",
  "Las Tunas",
  "Granma",
  "Holguín",
  "Santiago de Cuba",
  "Guantánamo",
  "Isla de la Juventud"
] as const

const tripSchema = z.object({
  driver_id: z.number().min(1, "Debe seleccionar un conductor"),
  container_number: z.string().optional(),
  load_date: z.string().optional(),
  load_time: z.string().optional(),
  trip_payment: z.number().optional(),
  province: z.string().optional().refine(
    (val) => !val || CUBAN_PROVINCES.includes(val as typeof CUBAN_PROVINCES[number]),
    "Provincia no válida"
  ),
})

type TripFormData = z.infer<typeof tripSchema>

interface TripFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  trip?: Trip | null
  drivers: Driver[]
  onSubmit: (data: CreateTrip) => void
  isLoading?: boolean
}

export function TripForm({
  open,
  onOpenChange,
  trip,
  drivers,
  onSubmit,
  isLoading = false,
}: TripFormProps) {
  const form = useForm<TripFormData>({
    resolver: zodResolver(tripSchema),
    defaultValues: {
      driver_id: trip?.driver_id || 0,
      container_number: trip?.container_number || "",
      load_date: trip?.load_date ? new Date(trip.load_date).toISOString().split('T')[0] : "",
      load_time: trip?.load_time || "",
      trip_payment: trip?.trip_payment ? Number(trip.trip_payment) : undefined,
      province: trip?.province || "",
    },
  })

  useEffect(() => {
    if (trip) {
      form.reset({
        driver_id: trip.driver_id || 0,
        container_number: trip.container_number || "",
        load_date: trip.load_date ? new Date(trip.load_date).toISOString().split('T')[0] : "",
        load_time: trip.load_time || "",
        trip_payment: trip.trip_payment ? Number(trip.trip_payment) : undefined,
        province: trip.province || "",
      })
    } else {
      form.reset({
        driver_id: 0,
        container_number: "",
        load_date: "",
        load_time: "",
        trip_payment: undefined,
        province: "",
      })
    }
  }, [trip, form])

  const handleSubmit = (data: TripFormData) => {
    // Convertir trip_payment a string si viene como number (o dejar undefined)
    // Convertir load_date de string a Date si existe
    const submitData: CreateTrip = {
      ...data,
      trip_payment: data.trip_payment !== undefined ? String(data.trip_payment) : undefined,
      load_date: data.load_date ? new Date(data.load_date) : undefined,
    }
    onSubmit(submitData)
  }

  const isEditing = !!trip

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Editar Viaje" : "Crear Viaje"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Modifica los datos del viaje seleccionado."
              : "Ingresa los datos del nuevo viaje."}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="driver_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Conductor</FormLabel>
                  <Select
                    onValueChange={(value) => field.onChange(Number(value))}
                    defaultValue={field.value?.toString()}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona un conductor" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {drivers.map((driver) => (
                        <SelectItem
                          key={driver.driver_id}
                          value={driver.driver_id.toString()}
                        >
                          {driver.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="container_number"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Número de Contenedor (Opcional)</FormLabel>
                  <FormControl>
                    <Input placeholder="CONT123456" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="load_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fecha de Carga (Opcional)</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="load_time"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Hora de Carga (Opcional)</FormLabel>
                    <FormControl>
                      <Input type="time" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="trip_payment"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Pago del Viaje (Opcional)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      {...field}
                      onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="province"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Provincia (Opcional)</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona una provincia" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {CUBAN_PROVINCES.map((province) => (
                        <SelectItem key={province} value={province}>
                          {province}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isLoading}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isLoading}>
                
                {isLoading ? <Loader2 className="spin" /> : isEditing ? <Save/> : <Plus/>}
                {isLoading ? "Guardando..." : isEditing ? "Actualizar" : "Crear"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}