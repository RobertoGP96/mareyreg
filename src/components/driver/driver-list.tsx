import { useDrivers, useCreateDriver, useDeleteDriver, useUpdateDriver } from '../../hooks/hooks';
import { mockDrivers } from '../../lib/mockData';
import { Button } from '../ui/button';
import { Loading } from '../ui/loading';
import { EmptyState } from '../ui/empty-state';
import { IdCardIcon, IdCardLanyard, Pen, Phone, Search, Trash2, MoreHorizontal, UserPlus, Eye } from 'lucide-react';
import { InputGroup, InputGroupAddon, InputGroupInput } from '../ui/input-group';
import { Badge } from '../ui/badge';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { DriverForm } from './driver-form';
import type { CreateDriver, CreateDriverWithVehicle, Driver } from '../../types/types';
import { toast } from 'sonner';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../ui/alert-dialog';
import { Avatar, AvatarFallback } from '../ui/avatar';

export function DriverList() {
    const { data: drivers, isLoading, error } = useDrivers();
    const createDriverMutation = useCreateDriver();
    const deleteDriverMutation = useDeleteDriver();
    const updateDriverMutation = useUpdateDriver();
    const navigate = useNavigate();
    const [searchQuery, setSearchQuery] = useState('');
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
    const [driverToDelete, setDriverToDelete] = useState<number | null>(null);
    const [driverToEdit, setDriverToEdit] = useState<Driver | null>(null);

    const displayDrivers = error || !drivers ? [...mockDrivers].sort((a, b) => a.full_name.localeCompare(b.full_name)) : [...drivers].sort((a, b) => a.full_name.localeCompare(b.full_name));
    const isUsingMockData = !!error || !drivers;

    const filteredDrivers = displayDrivers.filter(driver =>
        driver.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        driver.identification_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        driver.phone_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        driver.operative_license?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleCreateDriver = async (data: CreateDriverWithVehicle) => {
        try {
            await createDriverMutation.mutateAsync(data);
            setIsCreateDialogOpen(false);
            toast.success('Conductor creado exitosamente');
        } catch (error: unknown) {
            console.error('Error creating driver:', error);
            const err = error as { code?: string; constraint?: string };
            if (err.code === '23505' && err.constraint === 'drivers_identification_number_key') {
                toast.error('El número de identificación ya existe. Por favor, use un número diferente.');
            } else {
                toast.error('Error al crear el conductor');
            }
        }
    };

    const handleDeleteDriver = async () => {
        if (!driverToDelete) return;

        try {
            await deleteDriverMutation.mutateAsync(driverToDelete);
            setDriverToDelete(null);
            toast.success('Conductor eliminado exitosamente');
        } catch (error) {
            console.error('Error deleting driver:', error);
            toast.error('Error al eliminar el conductor');
        }
    };

    const handleEditDriver = (driver: Driver) => {
        setDriverToEdit(driver);
    };

    const handleViewDriver = (driverId: number) => {
        navigate(`/drivers/${driverId}`);
    };

    const handleUpdateDriver = async (data: CreateDriverWithVehicle) => {
        if (!driverToEdit) return;

        // For updates, we only update driver fields, not create vehicles
        const driverData: CreateDriver = {
            full_name: data.full_name,
            identification_number: data.identification_number,
            phone_number: data.phone_number,
            operative_license: data.operative_license,
        };

        try {
            await updateDriverMutation.mutateAsync({ id: driverToEdit.driver_id, data: driverData });
            setDriverToEdit(null);
            toast.success('Conductor actualizado exitosamente');
        } catch (error: unknown) {
            console.error('Error updating driver:', error);
            const err = error as { code?: string; constraint?: string };
            if (err.code === '23505' && err.constraint === 'drivers_identification_number_key') {
                toast.error('El número de identificación ya existe. Por favor, use un número diferente.');
            } else {
                toast.error('Error al actualizar el conductor');
            }
        }
    };

    if (isLoading) return <Loading />;

    return (
        <>
            <div className="bg-white shadow-sm rounded-lg border">
                <div className="px-6 py-4 border-b border-gray-200">
                    <div className="flex justify-between items-center">
                        <h2 className="text-lg font-medium text-gray-900">
                            Lista de Conductores
                            {isUsingMockData && (
                                <Badge variant={"outline"}>
                                    <span className=" text-sm text-orange-600">Ejemplo</span>
                                </Badge>
                            )}
                        </h2>
                        {!isUsingMockData && (
                            <Button onClick={() => setIsCreateDialogOpen(true)}>
                                <UserPlus className="w-4 h-4 mr-2" />
                                Agregar
                            </Button>
                        )}
                    </div>

                    <div className=' mt-4'>
                        <InputGroup>
                            <InputGroupInput
                                placeholder="Buscar conductores..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                            <InputGroupAddon>
                                <Search />
                            </InputGroupAddon>
                            <InputGroupAddon align="inline-end"><Badge>{filteredDrivers.length}</Badge></InputGroupAddon>
                        </InputGroup>
                    </div>

                </div>
                <div className="grid gap-4 p-6">
                    {filteredDrivers && filteredDrivers.length > 0 ? (
                        filteredDrivers.map((driver) => (
                            <div key={driver.driver_id} className="bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200 p-4">
                                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                                    <div className="flex items-start space-x-3 flex-1">
                                        <Avatar className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center" >
                                            <AvatarFallback>
                                                <p className="text-lg uppercase font-semibold text-gray-900 truncate">
                                                    {driver.full_name ? driver.full_name.split(' ').map(name => name.charAt(0)).join('').toUpperCase().slice(0, 2) : '?'}
                                                </p>
                                            </AvatarFallback>
                                        </Avatar>

                                        <div className="flex-1 min-w-0">
                                            <h3 className="text-lg font-semibold text-gray-900 mb-2 truncate">{driver.full_name}</h3>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-gray-600">
                                                <div className="flex items-center space-x-2">
                                                    <IdCardIcon className="w-4 h-4 text-gray-400" />
                                                    <span className="font-medium">ID:</span>
                                                    <span className="truncate">{driver.identification_number}</span>
                                                </div>
                                                <div className="flex items-center space-x-2">
                                                    <Phone className="w-4 h-4 text-gray-400" />
                                                    <span className="font-medium">Teléfono:</span>
                                                    <span className="truncate">{driver.phone_number}</span>
                                                </div>
                                                {driver.operative_license && (
                                                    <div className="flex items-center space-x-2">
                                                        <IdCardLanyard className="w-4 h-4 text-gray-400" />
                                                        <span className="font-medium">Licencia:</span>
                                                        <Badge variant="secondary" className="truncate">{driver.operative_license}</Badge>
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
                                                <DropdownMenuItem
                                                    onClick={() => handleViewDriver(driver.driver_id)}
                                                    className="flex items-center space-x-2"
                                                >
                                                    <Eye className="h-4 w-4" />
                                                    <span>Ver detalles</span>
                                                </DropdownMenuItem>
                                                <DropdownMenuItem
                                                    disabled={isUsingMockData}
                                                    onClick={() => handleEditDriver(driver)}
                                                    className="flex items-center space-x-2"
                                                >
                                                    <Pen className="h-4 w-4" />
                                                    <span>Editar</span>
                                                </DropdownMenuItem>
                                                <DropdownMenuItem
                                                    disabled={isUsingMockData}
                                                    onClick={() => setDriverToDelete(driver.driver_id)}
                                                    className="flex items-center space-x-2 text-red-600 focus:text-red-600"
                                                >
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
                        <EmptyState title="No hay conductores" description="No se encontraron conductores registrados." />
                    )}
                </div>
            </div>

            <DriverForm
                open={isCreateDialogOpen}
                onOpenChange={setIsCreateDialogOpen}
                onSubmit={handleCreateDriver}
                isLoading={createDriverMutation.isPending}
            />

            <DriverForm
                open={!!driverToEdit}
                onOpenChange={(open) => !open && setDriverToEdit(null)}
                onSubmit={handleUpdateDriver}
                isLoading={updateDriverMutation.isPending}
                driver={driverToEdit}
            />

            <AlertDialog open={!!driverToDelete} onOpenChange={() => setDriverToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Esta acción no se puede deshacer. Esto eliminará permanentemente el conductor
                            y removerá sus datos de nuestros servidores.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDeleteDriver}
                            className="bg-red-600 hover:bg-red-700"
                            disabled={deleteDriverMutation.isPending}
                        >
                            {deleteDriverMutation.isPending ? 'Eliminando...' : 'Eliminar'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}