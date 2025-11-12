import { NeonService } from './neon-service';
import { getDriver } from './driverService';
import type { Trip, CreateTrip, Driver, Vehicle } from '../types/types';

const neonService = new NeonService();

export const getTrips = async (): Promise<Trip[]> => {
  const sql = 'SELECT * FROM trips';
  return (await neonService.executeSelectAsObjects(sql)) as unknown as Trip[];
};

export const getTrip = async (id: number): Promise<Trip> => {
  const sql = 'SELECT * FROM trips WHERE trip_id = $1';
  const results = await neonService.executeSelectAsObjects(sql, [id]);
  return results[0] as unknown as Trip;
};

export const getTripWithDetails = async (id: number): Promise<{
  trip: Trip;
  driver?: Driver;
  vehicle?: Vehicle;
}> => {
  // Get trip
  const trip = await getTrip(id);

  // Get driver associated with the trip
  let driver: Driver | undefined;
  if (trip.driver_id) {
    try {
      driver = await getDriver(trip.driver_id);
    } catch (error) {
      console.warn('Could not fetch driver for trip:', error);
    }
  }

  // Get vehicle associated with the driver
  let vehicle: Vehicle | undefined;
  if (trip.driver_id) {
    try {
      // Find vehicle assigned to this driver
      const { getVehicles } = await import('./vehicleService');
      const vehicles = await getVehicles();
      vehicle = vehicles.find(v => v.driver_id === trip.driver_id);
    } catch (error) {
      console.warn('Could not fetch vehicle for trip:', error);
    }
  }

  return {
    trip,
    driver,
    vehicle,
  };
};

export const createTrip = async (data: CreateTrip): Promise<Trip> => {
  const fields = ['driver_id'];
  const values: unknown[] = [data.driver_id];
  const placeholders = ['$1'];

  let paramIndex = 2;
  if (data.container_number !== undefined) {
    fields.push('container_number');
    values.push(data.container_number);
    placeholders.push(`$${paramIndex++}`);
  }
  if (data.load_date !== undefined) {
    fields.push('load_date');
    values.push(data.load_date);
    placeholders.push(`$${paramIndex++}`);
  }
  if (data.load_time !== undefined) {
    fields.push('load_time');
    values.push(data.load_time);
    placeholders.push(`$${paramIndex++}`);
  }
  if (data.trip_payment !== undefined) {
    fields.push('trip_payment');
    values.push(data.trip_payment);
    placeholders.push(`$${paramIndex++}`);
  }
  if (data.province !== undefined) {
    fields.push('province');
    values.push(data.province);
    placeholders.push(`$${paramIndex++}`);
  }
  if (data.product !== undefined) {
    fields.push('product');
    values.push(data.product);
    placeholders.push(`$${paramIndex++}`);
  }

  const sql = `INSERT INTO trips (${fields.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`;
  const result = await neonService.executeSelectAsObjects(sql, values);
  return result[0] as unknown as Trip;
};

export const updateTrip = async (id: number, data: Partial<Trip>): Promise<Trip> => {
  const updates: string[] = [];
  const values: unknown[] = [];

  // List of allowed fields to update (exclude trip_id)
  const allowedFields: (keyof Trip)[] = [
    'driver_id',
    'container_number',
    'load_date',
    'load_time',
    'trip_payment',
    'province',
    'product'
  ];

  let paramIndex = 1;
  allowedFields.forEach(key => {
    const value = data[key];
    if (value !== undefined) {
      updates.push(`${key} = $${paramIndex++}`);
      values.push(value);
    }
  });

  if (updates.length === 0) throw new Error('No fields to update');

  values.push(id); // Add id as the last parameter
  const sql = `UPDATE trips SET ${updates.join(', ')} WHERE trip_id = $${paramIndex} RETURNING *`;
  await neonService.executeSelectAsObjects(sql, values);

  // Return the updated trip
  return await getTrip(id);
};

export const deleteTrip = async (id: number): Promise<void> => {
  const sql = 'DELETE FROM trips WHERE trip_id = $1';
  await neonService.executeDelete(sql, [id]);
};

export const deleteAllTrips = async (): Promise<void> => {
  const sql = 'DELETE FROM trips';
  await neonService.executeDelete(sql);
};