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
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { useDrivers } from "@/hooks/hooks"
import type { Vehicle, CreateVehicleWithDriver } from "@/types/types"
import { Loader2, Plus, Save } from "lucide-react"

const vehicleSchema = z.object({
  cuña_circulation_number: z.string().optional(),
  plancha_circulation_number: z.string().optional(),
  cuña_plate_number: z.string().optional(),
  plancha_plate_number: z.string().optional(),
  driverOption: z.enum(["existing", "new", "none"]),
  driver_id: z.number().optional(),
  driverData: z.object({
    full_name: z.string().min(1, "El nombre completo es requerido"),
    identification_number: z.string().min(1, "El número de identificación es requerido"),
    phone_number: z.string().min(1, "El número de teléfono es requerido"),
    operative_license: z.string().optional(),
  }).optional(),
}).refine((data) => {
  if (data.driverOption === "existing") {
    return data.driver_id !== undefined;
  }
  if (data.driverOption === "new") {
    return data.driverData !== undefined;
  }
  return true;
}, {
  message: "Debe seleccionar un conductor existente o proporcionar datos para crear uno nuevo",
  path: ["driver_id"],
});

type VehicleFormData = z.infer<typeof vehicleSchema>

interface VehicleFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  vehicle?: Vehicle | null
  onSubmit: (data: CreateVehicleWithDriver) => void
  isLoading?: boolean
}

export function VehicleForm({
  open,
  onOpenChange,
  vehicle,
  onSubmit,
  isLoading = false,
}: VehicleFormProps) {
  const { data: drivers } = useDrivers();
  const form = useForm<VehicleFormData>({
    resolver: zodResolver(vehicleSchema),
    defaultValues: {
      cuña_circulation_number: vehicle?.cuña_circulation_number || "",
      plancha_circulation_number: vehicle?.plancha_circulation_number || "",
      cuña_plate_number: vehicle?.cuña_plate_number || "",
      plancha_plate_number: vehicle?.plancha_plate_number || "",
      driverOption: vehicle?.driver_id ? "existing" : "none",
      driver_id: vehicle?.driver_id,
      driverData: {
        full_name: "",
        identification_number: "",
        phone_number: "",
        operative_license: "",
      },
    },
  })

  useEffect(() => {
    if (vehicle) {
      form.reset({
        cuña_circulation_number: vehicle.cuña_circulation_number || "",
        plancha_circulation_number: vehicle.plancha_circulation_number || "",
        cuña_plate_number: vehicle.cuña_plate_number || "",
        plancha_plate_number: vehicle.plancha_plate_number || "",
        driverOption: vehicle.driver_id ? "existing" : "none",
        driver_id: vehicle.driver_id,
        driverData: {
          full_name: "",
          identification_number: "",
          phone_number: "",
          operative_license: "",
        },
      })
    } else {
      form.reset({
        cuña_circulation_number: "",
        plancha_circulation_number: "",
        cuña_plate_number: "",
        plancha_plate_number: "",
        driverOption: "none",
        driver_id: undefined,
        driverData: {
          full_name: "",
          identification_number: "",
          phone_number: "",
          operative_license: "",
        },
      })
    }
  }, [vehicle, form])

  const handleSubmit = (data: VehicleFormData) => {
    const submitData: CreateVehicleWithDriver = {
      cuña_circulation_number: data.cuña_circulation_number || undefined,
      plancha_circulation_number: data.plancha_circulation_number || undefined,
      cuña_plate_number: data.cuña_plate_number || undefined,
      plancha_plate_number: data.plancha_plate_number || undefined,
      driver_id: data.driverOption === "existing" ? data.driver_id : undefined,
      createDriver: data.driverOption === "new",
      driverData: data.driverOption === "new" ? data.driverData : undefined,
    }
    onSubmit(submitData)
  }

  const isEditing = !!vehicle

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Editar Vehículo" : "Crear Vehículo"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Modifica los datos del vehículo seleccionado."
              : "Ingresa los datos del nuevo vehículo."}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="cuña_circulation_number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Número de Circulación Cuña (Opcional)</FormLabel>
                    <FormControl>
                      <Input placeholder="ABC123456" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="plancha_circulation_number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Número de Circulación Plancha (Opcional)</FormLabel>
                    <FormControl>
                      <Input placeholder="DEF789012" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="cuña_plate_number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Número de Placa Cuña (Opcional)</FormLabel>
                    <FormControl>
                      <Input placeholder="CUÑA-001" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="plancha_plate_number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Número de Placa Plancha (Opcional)</FormLabel>
                    <FormControl>
                      <Input placeholder="PLANCH-001" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <Separator />

            <div className="space-y-4">
              <FormField
                control={form.control}
                name="driverOption"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Conductor</FormLabel>
                    <FormControl>
                      <RadioGroup
                        onValueChange={field.onChange}
                        value={field.value}
                        className="flex flex-col space-y-2"
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="none" id="none" />
                          <Label htmlFor="none">Sin conductor asignado</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="existing" id="existing" />
                          <Label htmlFor="existing">Seleccionar conductor existente</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="new" id="new" />
                          <Label htmlFor="new">Crear nuevo conductor</Label>
                        </div>
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {form.watch("driverOption") === "existing" && (
                <FormField
                  control={form.control}
                  name="driver_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Seleccionar Conductor</FormLabel>
                      <Select onValueChange={(value) => field.onChange(Number(value))} value={field.value?.toString()}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccione un conductor" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {drivers?.map((driver) => (
                            <SelectItem key={driver.driver_id} value={driver.driver_id.toString()}>
                              {driver.full_name} - {driver.identification_number}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {form.watch("driverOption") === "new" && (
                <div className="space-y-4 p-4 border rounded-lg bg-gray-50">
                  <h4 className="font-medium">Datos del Nuevo Conductor</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="driverData.full_name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nombre Completo</FormLabel>
                          <FormControl>
                            <Input placeholder="Juan Pérez" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="driverData.identification_number"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Número de Identificación</FormLabel>
                          <FormControl>
                            <Input placeholder="123456789" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="driverData.phone_number"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Número de Teléfono</FormLabel>
                          <FormControl>
                            <Input placeholder="+1234567890" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="driverData.operative_license"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Licencia Operativa (Opcional)</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Detalles de la licencia operativa..."
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              )}
            </div>

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