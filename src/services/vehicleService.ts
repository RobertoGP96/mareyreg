import { NeonService } from './neon-service';
import type { Vehicle, CreateVehicle, CreateVehicleWithDriver } from '../types/types';
import { createDriver } from './driverService';

const neonService = new NeonService();

export const getVehicles = async (): Promise<Vehicle[]> => {
  const sql = 'SELECT * FROM vehicles';
  return (await neonService.executeSelectAsObjects(sql)) as unknown as Vehicle[];
};

export const getVehicle = async (id: number): Promise<Vehicle> => {
  const sql = 'SELECT * FROM vehicles WHERE vehicle_id = $1';
  const results = await neonService.executeSelectAsObjects(sql, [id]);
  return results[0] as unknown as Vehicle;
};

export const createVehicle = async (data: CreateVehicle): Promise<Vehicle> => {
  const fields: string[] = [];
  const values: unknown[] = [];
  const placeholders: string[] = [];

  let paramIndex = 1;
  if (data.cuña_circulation_number !== undefined) {
    fields.push('cuña_circulation_number');
    values.push(data.cuña_circulation_number);
    placeholders.push(`$${paramIndex++}`);
  }
  if (data.plancha_circulation_number !== undefined) {
    fields.push('plancha_circulation_number');
    values.push(data.plancha_circulation_number);
    placeholders.push(`$${paramIndex++}`);
  }
  if (data.cuña_plate_number !== undefined) {
    fields.push('cuña_plate_number');
    values.push(data.cuña_plate_number);
    placeholders.push(`$${paramIndex++}`);
  }
  if (data.plancha_plate_number !== undefined) {
    fields.push('plancha_plate_number');
    values.push(data.plancha_plate_number);
    placeholders.push(`$${paramIndex++}`);
  }
  if (data.driver_id !== undefined) {
    fields.push('driver_id');
    values.push(data.driver_id);
    placeholders.push(`$${paramIndex++}`);
  }

  if (fields.length === 0) throw new Error('At least one field must be provided');
  const sql = `INSERT INTO vehicles (${fields.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`;
  const result = await neonService.executeSelectAsObjects(sql, values);
  return result[0] as unknown as Vehicle;
};

export const createVehicleWithDriver = async (data: CreateVehicleWithDriver): Promise<Vehicle> => {
  let driverId = data.driver_id;

  // If we need to create a new driver
  if (data.createDriver && data.driverData) {
    const newDriver = await createDriver(data.driverData);
    driverId = newDriver.driver_id;
  }

  // Create the vehicle with the driver_id
  const vehicleData: CreateVehicle = {
    cuña_circulation_number: data.cuña_circulation_number,
    plancha_circulation_number: data.plancha_circulation_number,
    cuña_plate_number: data.cuña_plate_number,
    plancha_plate_number: data.plancha_plate_number,
    driver_id: driverId,
  };

  return await createVehicle(vehicleData);
};

export const updateVehicle = async (id: number, data: Partial<Vehicle>): Promise<Vehicle> => {
  const updates: string[] = [];
  const values: unknown[] = [];

  let paramIndex = 1;
  Object.keys(data).forEach(key => {
    const value = data[key as keyof Vehicle];
    if (value !== undefined) {
      updates.push(`${key} = $${paramIndex++}`);
      values.push(value);
    }
  });

  if (updates.length === 0) throw new Error('No fields to update');

  values.push(id); // Add id as the last parameter
  const sql = `UPDATE vehicles SET ${updates.join(', ')} WHERE vehicle_id = $${paramIndex} RETURNING *`;
  const result = await neonService.executeSelectAsObjects(sql, values);
  return result[0] as unknown as Vehicle;
};

export const deleteVehicle = async (id: number): Promise<void> => {
  const sql = 'DELETE FROM vehicles WHERE vehicle_id = $1';
  await neonService.executeDelete(sql, [id]);
};