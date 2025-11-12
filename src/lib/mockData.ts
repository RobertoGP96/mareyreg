import type { Driver, Vehicle, Trip } from '../types/types';

export const mockDrivers: Driver[] = [
  {
    driver_id: 1,
    full_name: 'Juan Pérez',
    identification_number: '123456789',
    phone_number: '+1234567890',
    operative_license: 'LIC123456'
  },
  {
    driver_id: 2,
    full_name: 'María García',
    identification_number: '987654321',
    phone_number: '+0987654321',
    operative_license: 'LIC654321'
  },
  {
    driver_id: 3,
    full_name: 'Carlos Rodríguez',
    identification_number: '456789123',
    phone_number: '+1456789123'
  }
];

export const mockVehicles: Vehicle[] = [
  {
    vehicle_id: 1,
    name: 'Camión Azul',
    cuña_circulation_number: 'CIRC001',
    plancha_circulation_number: 'PLANCIRC001',
    cuña_plate_number: 'ABC-123',
    plancha_plate_number: 'DEF-456'
  },
  {
    vehicle_id: 2,
    name: 'Camión Rojo',
    cuña_circulation_number: 'CIRC002',
    plancha_circulation_number: 'PLANCIRC002',
    cuña_plate_number: 'GHI-789',
    plancha_plate_number: 'JKL-012'
  },
  {
    vehicle_id: 3,
    name: 'Camión Verde',
    cuña_circulation_number: 'CIRC003',
    plancha_circulation_number: 'PLANCIRC003',
    cuña_plate_number: 'MNO-345',
    plancha_plate_number: 'PQR-678'
  }
];

export const mockTrips: Trip[] = [
  {
    trip_id: 1,
    driver_id: 1,
    container_number: 'CONT001',
    load_date: new Date('2025-10-25'),
    load_time: '08:00:00',
    trip_payment: '150.00',
    province: 'Santiago de Cuba'
  },
  {
    trip_id: 2,
    driver_id: 2,
    container_number: 'CONT002',
    load_date: new Date('2025-10-26'),
    load_time: '09:30:00',
    trip_payment: '200.00',
    province: 'La Habana'
  },
  {
    trip_id: 3,
    driver_id: 3,
    container_number: 'CONT003',
    load_date: new Date('2025-10-27'),
    load_time: '10:15:00',
    trip_payment: '175.50',
    province: 'Camagüey'
  }
];