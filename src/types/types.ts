// Types for the database tables

export interface Driver {
  driver_id: number;
  full_name: string;
  identification_number: string;
  phone_number: string;
  operative_license?: string;
}
export type CreateDriver = Omit<Driver, 'driver_id'>

export interface Trip {
  trip_id: number;
  driver_id: number;
  container_number?: string;
  load_date?: Date; // Date object from database
  load_time?: string; // time
  trip_payment?: string; // string from database
  province?: string;
  product?: string;
}
export type CreateTrip = Omit<Trip, 'trip_id'>

export interface Vehicle {
  name: string;
  vehicle_id: number;
  cuña_circulation_number?: string;
  plancha_circulation_number?: string;
  cuña_plate_number?: string;
  plancha_plate_number?: string;
  driver_id?: number; // Optional driver association
  driver?: Driver; // Optional populated driver data
}
export type CreateVehicle = Omit<Vehicle, 'vehicle_id' | 'driver'>
export type CreateVehicleWithDriver = CreateVehicle & {
  createDriver?: boolean;
  driverData?: CreateDriver;
}
export type CreateDriverWithVehicle = CreateDriver & {
  createVehicle?: boolean;
  vehicleData?: CreateVehicle;
}