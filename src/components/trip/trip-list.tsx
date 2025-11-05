import { useTrips, useCreateTrip, useDrivers, useDeleteTrip, useUpdateTrip } from '../../hooks/hooks';
import { mockTrips } from '../../lib/mockData';
import { Button } from '../ui/button';
import { Loading } from '../ui/loading';
import { EmptyState } from '../ui/empty-state';
import { Calendar, Clock, Container, HandCoinsIcon, MapPin, Pen, Trash2, Search, Plus, Route, MoreHorizontal, Package } from 'lucide-react';
import { Badge } from '../ui/badge';
import { InputGroup, InputGroupAddon, InputGroupInput } from '../ui/input-group';
import { useState } from 'react';
import { TripForm } from './trip-form';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/dropdown-menu';
import type { CreateTrip, Trip } from '../../types/types';
import { toast } from 'sonner';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../ui/alert-dialog';
import { TripFilter } from './filter';

interface TripFilters {
    province?: string;
    product?: string;
    driver_id?: string;
    container_number?: string;
    load_date_from?: string;
    load_date_to?: string;
    trip_payment_min?: string;
    trip_payment_max?: string;
}

export function TripList() {
    const { data: trips, isLoading, error } = useTrips();
    const { data: drivers } = useDrivers();
    const createTripMutation = useCreateTrip();
    const deleteTripMutation = useDeleteTrip();
    const updateTripMutation = useUpdateTrip();
    const [searchQuery, setSearchQuery] = useState('');
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
    const [tripToDelete, setTripToDelete] = useState<number | null>(null);
    const [tripToEdit, setTripToEdit] = useState<Trip | null>(null);
    const [filters, setFilters] = useState<TripFilters>({});

    const displayTrips = error || !trips ? mockTrips : trips;
    const isUsingMockData = !!error || !trips;

    const filteredTrips = displayTrips.filter(trip => {
        const driver = drivers?.find(d => d.driver_id === trip.driver_id);

        // Filtro de búsqueda general
        const matchesSearch = searchQuery === '' || (
            trip.trip_id?.toString().toLowerCase().includes(searchQuery.toLowerCase()) ||
            driver?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            trip.driver_id?.toString().toLowerCase().includes(searchQuery.toLowerCase()) ||
            trip.container_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            trip.province?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            trip.product?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (trip.load_date && new Date(trip.load_date).toLocaleDateString('es-ES').toLowerCase().includes(searchQuery.toLowerCase())) ||
            trip.load_time?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            trip.trip_payment?.toString().toLowerCase().includes(searchQuery.toLowerCase())
        );

        // Filtros avanzados
        const matchesProvince = !filters.province || trip.province === filters.province;
        const matchesProduct = !filters.product || trip.product === filters.product;
        const matchesDriver = !filters.driver_id || trip.driver_id.toString() === filters.driver_id;
        const matchesContainer = !filters.container_number || trip.container_number?.toLowerCase().includes(filters.container_number.toLowerCase());

        const tripDate = trip.load_date ? new Date(trip.load_date) : null;
        const matchesDateFrom = !filters.load_date_from || !tripDate || tripDate >= new Date(filters.load_date_from);
        const matchesDateTo = !filters.load_date_to || !tripDate || tripDate <= new Date(filters.load_date_to + 'T23:59:59');

        const payment = trip.trip_payment ? parseFloat(trip.trip_payment.toString()) : 0;
        const matchesPaymentMin = !filters.trip_payment_min || payment >= parseFloat(filters.trip_payment_min);
        const matchesPaymentMax = !filters.trip_payment_max || payment <= parseFloat(filters.trip_payment_max);

        return matchesSearch && matchesProvince && matchesProduct && matchesDriver && matchesContainer && matchesDateFrom && matchesDateTo && matchesPaymentMin && matchesPaymentMax;
    });

    const handleCreateTrip = async (data: CreateTrip) => {
        try {
            await createTripMutation.mutateAsync(data);
            setIsCreateDialogOpen(false);
            toast.success('Viaje creado exitosamente');
        } catch (error) {
            console.error('Error creating trip:', error);
            toast.error('Error al crear el viaje');
        }
    };

    const handleDeleteTrip = async () => {
        if (!tripToDelete) return;

        try {
            await deleteTripMutation.mutateAsync(tripToDelete);
            setTripToDelete(null);
            toast.success('Viaje eliminado exitosamente');
        } catch (error) {
            console.error('Error deleting trip:', error);
            toast.error('Error al eliminar el viaje');
        }
    };

    const handleEditTrip = (trip: Trip) => {
        setTripToEdit(trip);
    };

    const handleUpdateTrip = async (data: CreateTrip) => {
        if (!tripToEdit) return;

        try {
            await updateTripMutation.mutateAsync({ id: tripToEdit.trip_id, data });
            setTripToEdit(null);
            toast.success('Viaje actualizado exitosamente');
        } catch (error) {
            console.error('Error updating trip:', error);
            toast.error('Error al actualizar el viaje');
        }
    };

    if (isLoading) return <Loading />;

    return (
        <>
            <div className="bg-white shadow-sm rounded-lg border">
                <div className="px-6 py-4 border-b border-gray-200">
                    <div className="flex justify-between items-center">
                        <h2 className="text-lg font-medium text-gray-900">
                            Lista de Viajes
                            {isUsingMockData && (
                                <Badge variant={"outline"}>
                                    <span className=" text-sm text-orange-600">Ejemplo</span>
                                </Badge>
                            )}
                        </h2>
                        {!isUsingMockData && (
                            <Button onClick={() => setIsCreateDialogOpen(true)}>
                                <Plus className="w-4 h-4 mr-2" />
                                Registrar
                            </Button>
                        )}
                    </div>

                    <div className='mt-4 flex items-center justify-center space-x-4'>
                        <div className="flex-1">
                            <InputGroup>
                                <InputGroupInput
                                    placeholder="Buscar viajes..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                                <InputGroupAddon>
                                    <Search />
                                </InputGroupAddon>
                                <InputGroupAddon align="inline-end"><Badge>{filteredTrips.length}</Badge></InputGroupAddon>
                            </InputGroup>
                        </div>
                        <TripFilter
                            filters={filters}
                            onFiltersChange={setFilters}
                            drivers={drivers || []}
                        />
                    </div>
                </div>
                <div className="grid gap-4 p-6">
                    {filteredTrips && filteredTrips.length > 0 ? (
                        filteredTrips.map((trip) => {
                            const driver = drivers?.find(d => d.driver_id === trip.driver_id);
                            return (
                                <div key={trip.trip_id} className="bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200 p-4 overflow-hidden">
                                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                                        <div className="flex items-start space-x-3 flex-1 min-w-0 overflow-hidden">
                                            <div className="shrink-0">
                                                <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                                                    <Route className="w-5 h-5 text-gray-600" />
                                                </div>
                                            </div>
                                            <div className="flex-1 min-w-0 overflow-hidden">
                                                <div className="flex items-center space-x-2 mb-2">
                                                    <h3 className="text-lg font-semibold text-gray-900 shrink-0">Viaje</h3>
                                                    <Badge variant="outline" className="bg-gray-100 truncate max-w-full">#{trip.trip_id}</Badge>
                                                </div>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-gray-600">
                                                    <div className="flex items-center space-x-2 min-w-0 overflow-hidden">
                                                        <span className="font-medium shrink-0">Conductor:</span>
                                                        <span className="truncate">{driver?.full_name || 'Desconocido'}</span>
                                                    </div>
                                                    {trip.container_number && (
                                                        <div className="flex items-center space-x-2 min-w-0 overflow-hidden">
                                                            <Container className="w-4 h-4 text-gray-400 shrink-0" />
                                                            <span className="font-medium shrink-0">Contenedor:</span>
                                                            <Badge variant="secondary" className="truncate max-w-full">{trip.container_number}</Badge>
                                                        </div>
                                                    )}
                                                    {trip.load_date && (
                                                        <div className="flex items-center space-x-2 min-w-0 overflow-hidden">
                                                            <Calendar className="w-4 h-4 text-gray-400 shrink-0" />
                                                            <span className="font-medium shrink-0">Fecha:</span>
                                                            <span className="truncate">{new Date(trip.load_date).toLocaleDateString('es-ES')}</span>
                                                        </div>
                                                    )}
                                                    {trip.load_time && (
                                                        <div className="flex items-center space-x-2 min-w-0 overflow-hidden">
                                                            <Clock className="w-4 h-4 text-gray-400 shrink-0" />
                                                            <span className="font-medium shrink-0">Hora:</span>
                                                            <span className="truncate">{trip.load_time}</span>
                                                        </div>
                                                    )}
                                                    {trip.trip_payment && (
                                                        <div className="flex items-center space-x-2 min-w-0 overflow-hidden">
                                                            <HandCoinsIcon className="w-4 h-4 text-gray-400 shrink-0" />
                                                            <span className="font-medium shrink-0">Pago:</span>
                                                            <span className="font-semibold text-green-600 truncate">
                                                                ${Number(trip.trip_payment).toLocaleString('es-ES', { minimumFractionDigits: 2 })}
                                                            </span>
                                                        </div>
                                                    )}
                                                    {trip.province && (
                                                        <div className="flex items-center space-x-2 min-w-0 overflow-hidden">
                                                            <MapPin className="w-4 h-4 text-gray-400 shrink-0" />
                                                            <span className="font-medium shrink-0">Provincia:</span>
                                                            <span className="truncate">{trip.province}</span>
                                                        </div>
                                                    )}
                                                    {trip.product && (
                                                        <div className="flex items-center space-x-2 min-w-0 overflow-hidden">
                                                            <Package className="w-4 h-4 text-gray-400 shrink-0" />
                                                            <span className="font-medium shrink-0">Producto:</span>
                                                            <span className="truncate">{trip.product}</span>
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
                                                    <DropdownMenuItem disabled={isUsingMockData} className="flex items-center space-x-2" onClick={() => handleEditTrip(trip)}>
                                                        <Pen className="h-4 w-4" />
                                                        <span>Editar</span>
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem disabled={isUsingMockData} className="flex items-center space-x-2 text-red-600 focus:text-red-600" onClick={() => setTripToDelete(trip.trip_id)}>
                                                        <Trash2 className="h-4 w-4" />
                                                        <span>Eliminar</span>
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    ) : (
                        <EmptyState title="No hay viajes" description="No se encontraron viajes registrados." />
                    )}
                </div>
            </div>

            <TripForm
                open={isCreateDialogOpen}
                onOpenChange={setIsCreateDialogOpen}
                drivers={drivers || []}
                onSubmit={handleCreateTrip}
                isLoading={createTripMutation.isPending}
            />

            <TripForm
                open={!!tripToEdit}
                onOpenChange={() => setTripToEdit(null)}
                drivers={drivers || []}
                trip={tripToEdit}
                onSubmit={handleUpdateTrip}
                isLoading={updateTripMutation.isPending}
            />

            <AlertDialog open={!!tripToDelete} onOpenChange={() => setTripToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Esta acción no se puede deshacer. Esto eliminará permanentemente el viaje
                            y todos los datos asociados.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteTrip} className="bg-red-600 hover:bg-red-700">
                            Eliminar
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}