import { Button } from '../ui/button';
import { Loading } from '../ui/loading';
import { EmptyState } from '../ui/empty-state';
import { Search, Plus, Truck, Edit, Trash2, MoreHorizontal } from 'lucide-react';
import { InputGroup, InputGroupAddon, InputGroupInput } from '../ui/input-group';
import { Badge } from '../ui/badge';
import { useState } from 'react';
import { VehicleForm } from './vehicle-form';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/dropdown-menu';
import type { CreateVehicle, CreateVehicleWithDriver, Vehicle } from '../../types/types';
import { useVehicles, useCreateVehicleWithDriver, useDeleteVehicle, useUpdateVehicle } from '../../hooks/hooks';
import { mockVehicles } from '../../lib/mockData';
import { toast } from 'sonner';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../ui/alert-dialog';

export function VehicleList() {
  const { data: vehicles, isLoading, error } = useVehicles();
    const createVehicleMutation = useCreateVehicleWithDriver();
  const deleteVehicleMutation = useDeleteVehicle();
  const updateVehicleMutation = useUpdateVehicle();
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [vehicleToDelete, setVehicleToDelete] = useState<number | null>(null);
  const [vehicleToEdit, setVehicleToEdit] = useState<Vehicle | null>(null);

  const displayVehicles = error || !vehicles ? mockVehicles : vehicles;
  const isUsingMockData = !!error || !vehicles;

  const filteredVehicles = displayVehicles.filter(vehicle =>
    vehicle.vehicle_id?.toString().toLowerCase().includes(searchQuery.toLowerCase()) ||
    vehicle.cuña_plate_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    vehicle.plancha_plate_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    vehicle.cuña_circulation_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    vehicle.plancha_circulation_number?.toLowerCase().includes(searchQuery.toLowerCase())
  );

    const handleCreateVehicle = async (data: CreateVehicleWithDriver) => {
    try {
      await createVehicleMutation.mutateAsync(data);
      setIsCreateDialogOpen(false);
      toast.success('Vehículo creado exitosamente');
    } catch (error) {
      console.error('Error creating vehicle:', error);
      toast.error('Error al crear el vehículo');
    }
  };

  const handleDeleteVehicle = async () => {
    if (!vehicleToDelete) return;
    
    try {
      await deleteVehicleMutation.mutateAsync(vehicleToDelete);
      setVehicleToDelete(null);
      toast.success('Vehículo eliminado exitosamente');
    } catch (error) {
      console.error('Error deleting vehicle:', error);
      toast.error('Error al eliminar el vehículo');
    }
  };

  const handleEditVehicle = (vehicle: Vehicle) => {
    setVehicleToEdit(vehicle);
  };

  const handleUpdateVehicle = async (data: CreateVehicle) => {
    if (!vehicleToEdit) return;
    
    try {
      await updateVehicleMutation.mutateAsync({ id: vehicleToEdit.vehicle_id, data });
      setVehicleToEdit(null);
      toast.success('Vehículo actualizado exitosamente');
    } catch (error) {
      console.error('Error updating vehicle:', error);
      toast.error('Error al actualizar el vehículo');
    }
  };

  if (isLoading) return <Loading />;

  return (
    <>
      <div className="bg-white shadow-sm rounded-lg border">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-medium text-gray-900">
              Lista de Vehículos
              {isUsingMockData && (
                <Badge variant={"outline"}>
                  <span className=" text-sm text-orange-600">Ejemplo</span>
                </Badge>
              )}
            </h2>
            {!isUsingMockData && (
              <Button onClick={() => setIsCreateDialogOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Agregar
              </Button>
            )}
          </div>

          <div className='mt-4'>
            <InputGroup>
              <InputGroupInput
                placeholder="Buscar vehículos..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
                <InputGroupAddon>
                <Search />
                </InputGroupAddon>
              <InputGroupAddon align="inline-end"><Badge>{filteredVehicles.length}</Badge></InputGroupAddon>
            </InputGroup>
          </div>
        </div>
        <div className="grid gap-4 p-6">
          {filteredVehicles && filteredVehicles.length > 0 ? (
            filteredVehicles.map((vehicle) => (
              <div key={vehicle.vehicle_id} className="bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200 p-4 overflow-hidden">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                  <div className="flex items-start space-x-3 flex-1 min-w-0 overflow-hidden">
                    <div className="shrink-0">
                      <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                        <Truck className="w-5 h-5 text-gray-600" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0 overflow-hidden">
                      <h3 className="text-lg font-semibold text-gray-900 mb-2 truncate">{vehicle.name || "Vehiculo"} #{vehicle.vehicle_id}</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-gray-600">
                        {vehicle.cuña_plate_number && (
                          <div className="flex items-center space-x-2 min-w-0 overflow-hidden">
                            <span className="font-medium shrink-0">Placa Cuña:</span>
                            <Badge variant="secondary" className="truncate max-w-full">{vehicle.cuña_plate_number}</Badge>
                          </div>
                        )}
                        {vehicle.plancha_plate_number && (
                          <div className="flex items-center space-x-2 min-w-0 overflow-hidden">
                            <span className="font-medium shrink-0">Placa Plancha:</span>
                            <Badge variant="secondary" className="truncate max-w-full">{vehicle.plancha_plate_number}</Badge>
                          </div>
                        )}
                        {vehicle.cuña_circulation_number && (
                          <div className="flex items-center space-x-2 min-w-0 overflow-hidden">
                            <span className="font-medium shrink-0">Circulación Cuña:</span>
                            <span className="truncate">{vehicle.cuña_circulation_number}</span>
                          </div>
                        )}
                        {vehicle.plancha_circulation_number && (
                          <div className="flex items-center space-x-2 min-w-0 overflow-hidden">
                            <span className="font-medium shrink-0">Circulación Plancha:</span>
                            <span className="truncate">{vehicle.plancha_circulation_number}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="shrink-0">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                                        <DropdownMenuItem disabled={isUsingMockData} className="flex items-center space-x-2" onClick={() => handleEditVehicle(vehicle)}>
                          <Edit className="h-4 w-4" />
                          <span>Editar</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem disabled={isUsingMockData} className="flex items-center space-x-2 text-red-600 focus:text-red-600" onClick={() => setVehicleToDelete(vehicle.vehicle_id)}>
                          <Trash2 className="h-4 w-4" />
                          <span>Eliminar</span>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <EmptyState title="No hay vehículos" description="No se encontraron vehículos registrados." />
          )}
        </div>
      </div>

      <VehicleForm
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onSubmit={handleCreateVehicle}
        isLoading={createVehicleMutation.isPending}
      />

      <VehicleForm
        open={!!vehicleToEdit}
        onOpenChange={() => setVehicleToEdit(null)}
        vehicle={vehicleToEdit}
        onSubmit={handleUpdateVehicle}
        isLoading={updateVehicleMutation.isPending}
      />

      <AlertDialog open={!!vehicleToDelete} onOpenChange={() => setVehicleToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Esto eliminará permanentemente el vehículo
              y todos los datos asociados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteVehicle} className="bg-red-600 hover:bg-red-700">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}