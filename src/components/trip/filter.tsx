import { useState } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Badge } from '../ui/badge';
import { X, Filter } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import type { Driver } from '../../types/types';

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

interface TripFilterProps {
    filters: TripFilters;
    onFiltersChange: (filters: TripFilters) => void;
    drivers: Driver[];
}

export function TripFilter({ filters, onFiltersChange, drivers }: TripFilterProps) {
    const [isOpen, setIsOpen] = useState(false);

    const handleFilterChange = (key: keyof TripFilters, value: string | undefined) => {
        const newFilters = { ...filters };
        if (value === '' || value === undefined) {
            delete newFilters[key];
        } else {
            newFilters[key] = value;
        }
        onFiltersChange(newFilters);
    };

    const clearFilters = () => {
        onFiltersChange({});
    };

    const activeFiltersCount = Object.keys(filters).length;

    const provinces = ['Pinar del Río', 'Artemisa', 'La Habana', 'Mayabeque', 'Matanzas', 'Cienfuegos', 'Villa Clara', 'Sancti Spíritus', 'Ciego de Ávila', 'Camagüey', 'Las Tunas', 'Granma', 'Holguín', 'Santiago de Cuba', 'Guantánamo'];
    const products = ['Azúcar', 'Café', 'Tabaco', 'Cítricos', 'Arroz', 'Maíz', 'Frijoles', 'Tomate', 'Plátano', 'Otro'];

    return (
        <div className="flex items-center">
            <Popover open={isOpen} onOpenChange={setIsOpen}>
                <PopoverTrigger asChild>
                    <div className='flex items-center justify-center relative cursor-pointer p-2 rounded-md hover:bg-gray-100'>
                        <Filter className="w-5 h-5" />
                        {activeFiltersCount > 0 && (
                            <Badge variant="secondary" className="absolute -top-1 -right-1 h-4 w-4 p-0 flex items-center justify-center text-xs">
                                {activeFiltersCount}
                            </Badge>
                        )}
                    </div>
                </PopoverTrigger>
                <PopoverContent className="" align="start">
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h4 className="font-medium">Filtros avanzados</h4>
                            {activeFiltersCount > 0 && (
                                <Button variant="ghost" size="sm" onClick={clearFilters}>
                                    <X className="w-4 h-4 mr-1" />
                                    Limpiar
                                </Button>
                            )}
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className='space-y-1'>
                                <Label htmlFor="province">Provincia</Label>
                                <Select
                                    value={filters.province || ''}
                                    onValueChange={(value) => handleFilterChange('province', value)}
                                >
                                    <SelectTrigger className="w-full">
                                        <SelectValue placeholder="Seleccionar provincia" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {provinces.map((province) => (
                                            <SelectItem key={province} value={province}>
                                                {province}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className='space-y-1'>
                                <Label htmlFor="product">Producto</Label>
                                <Select
                                    value={filters.product || ''}
                                    onValueChange={(value) => handleFilterChange('product', value)}
                                >
                                    <SelectTrigger className="w-full">
                                        <SelectValue placeholder="Seleccionar producto" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {products.map((product) => (
                                            <SelectItem key={product} value={product}>
                                                {product}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className='space-y-1'>
                                <Label htmlFor="driver">Conductor</Label>
                                <Select
                                    value={filters.driver_id || ''}
                                    onValueChange={(value) => handleFilterChange('driver_id', value)}
                                >
                                    <SelectTrigger className="w-full">
                                        <SelectValue placeholder="Seleccionar conductor" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {drivers.map((driver) => (
                                            <SelectItem key={driver.driver_id} value={driver.driver_id.toString()}>
                                                {driver.full_name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className='space-y-1'>
                                <Label htmlFor="container">Contenedor</Label>
                                <Input
                                    id="container"
                                    placeholder="Número de contenedor"
                                    value={filters.container_number || ''}
                                    onChange={(e) => handleFilterChange('container_number', e.target.value)}
                                    className="w-full"
                                />
                            </div>

                            <div className='space-y-1'>
                                <Label htmlFor="date_from">Fecha desde</Label>
                                <Input
                                    id="date_from"
                                    type="date"
                                    value={filters.load_date_from || ''}
                                    onChange={(e) => handleFilterChange('load_date_from', e.target.value)}
                                    className="w-full"
                                />
                            </div>

                            <div className='space-y-1'>
                                <Label htmlFor="date_to">Fecha hasta</Label>
                                <Input
                                    id="date_to"
                                    type="date"
                                    value={filters.load_date_to || ''}
                                    onChange={(e) => handleFilterChange('load_date_to', e.target.value)}
                                    className="w-full"
                                />
                            </div>

                            <div className='space-y-1'>
                                <Label htmlFor="payment_min">Pago mínimo</Label>
                                <Input
                                    id="payment_min"
                                    type="number"
                                    placeholder="0"
                                    value={filters.trip_payment_min || ''}
                                    onChange={(e) => handleFilterChange('trip_payment_min', e.target.value)}
                                    className="w-full"
                                />
                            </div>

                            <div className='space-y-1'>
                                <Label htmlFor="payment_max">Pago máximo</Label>
                                <Input
                                    id="payment_max"
                                    type="number"
                                    placeholder="0"
                                    value={filters.trip_payment_max || ''}
                                    onChange={(e) => handleFilterChange('trip_payment_max', e.target.value)}
                                    className="w-full"
                                />
                            </div>
                        </div>
                    </div>
                </PopoverContent>
            </Popover>
        </div>
    );
}
