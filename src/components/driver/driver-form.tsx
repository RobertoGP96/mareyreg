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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import type { Driver, CreateDriverWithVehicle } from "@/types/types"
import { Loader2, Plus, Save } from "lucide-react"

const driverSchema = z.object({
  full_name: z.string().min(1, "El nombre completo es requerido"),
  identification_number: z.string().min(1, "El número de identificación es requerido"),
  phone_number: z.string().min(1, "El número de teléfono es requerido"),
  operative_license: z.string().optional(),
  vehicleOption: z.enum(["none", "new"]),
  vehicleData: z.object({
    cuña_circulation_number: z.string().optional(),
    plancha_circulation_number: z.string().optional(),
    cuña_plate_number: z.string().optional(),
    plancha_plate_number: z.string().optional(),
  }).optional(),
}).refine((data) => {
  if (data.vehicleOption === "new") {
    return data.vehicleData !== undefined;
  }
  return true;
}, {
  message: "Debe proporcionar datos para crear un vehículo nuevo",
  path: ["vehicleData"],
});

type DriverFormData = z.infer<typeof driverSchema>

interface DriverFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  driver?: Driver | null
  onSubmit: (data: CreateDriverWithVehicle) => void
  isLoading?: boolean
}

export function DriverForm({
  open,
  onOpenChange,
  driver,
  onSubmit,
  isLoading = false,
}: DriverFormProps) {
  const form = useForm<DriverFormData>({
    resolver: zodResolver(driverSchema),
    defaultValues: {
      full_name: driver?.full_name || "",
      identification_number: driver?.identification_number || "",
      phone_number: driver?.phone_number || "",
      operative_license: driver?.operative_license || "",
      vehicleOption: "none",
      vehicleData: {
        cuña_circulation_number: "",
        plancha_circulation_number: "",
        cuña_plate_number: "",
        plancha_plate_number: "",
      },
    },
  })

  useEffect(() => {
    if (driver) {
      form.reset({
        full_name: driver.full_name || "",
        identification_number: driver.identification_number || "",
        phone_number: driver.phone_number || "",
        operative_license: driver.operative_license || "",
        vehicleOption: "none",
        vehicleData: {
          cuña_circulation_number: "",
          plancha_circulation_number: "",
          cuña_plate_number: "",
          plancha_plate_number: "",
        },
      })
    } else {
      form.reset({
        full_name: "",
        identification_number: "",
        phone_number: "",
        operative_license: "",
        vehicleOption: "none",
        vehicleData: {
          cuña_circulation_number: "",
          plancha_circulation_number: "",
          cuña_plate_number: "",
          plancha_plate_number: "",
        },
      })
    }
  }, [driver, form])

  const handleSubmit = (data: DriverFormData) => {
    const submitData: CreateDriverWithVehicle = {
      full_name: data.full_name,
      identification_number: data.identification_number,
      phone_number: data.phone_number,
      operative_license: data.operative_license,
      createVehicle: data.vehicleOption === "new",
      vehicleData: data.vehicleOption === "new" ? data.vehicleData : undefined,
    }
    onSubmit(submitData)
  }

  const isEditing = !!driver

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Editar Conductor" : "Crear Conductor"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Modifica los datos del conductor seleccionado."
              : "Ingresa los datos del nuevo conductor."}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="full_name"
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
              name="identification_number"
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
            <FormField
              control={form.control}
              name="phone_number"
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
              name="operative_license"
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

            <Separator />

            <div className="space-y-4">
              <FormField
                control={form.control}
                name="vehicleOption"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Vehículo</FormLabel>
                    <FormControl>
                      <RadioGroup
                        onValueChange={field.onChange}
                        value={field.value}
                        className="flex flex-col space-y-2"
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="none" id="none-vehicle" />
                          <Label htmlFor="none-vehicle">Sin vehículo asignado</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="new" id="new-vehicle" />
                          <Label htmlFor="new-vehicle">Crear nuevo vehículo</Label>
                        </div>
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {form.watch("vehicleOption") === "new" && (
                <div className="space-y-4 p-4 border rounded-lg bg-gray-50">
                  <h4 className="font-medium">Datos del Nuevo Vehículo</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="vehicleData.cuña_circulation_number"
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
                      name="vehicleData.plancha_circulation_number"
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
                      name="vehicleData.cuña_plate_number"
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
                      name="vehicleData.plancha_plate_number"
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