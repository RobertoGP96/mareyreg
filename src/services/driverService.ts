import { NeonService } from './neon-service';
import { createVehicle } from './vehicleService';
import type { Driver, CreateDriver, CreateDriverWithVehicle, CreateVehicle, Vehicle, Trip } from '../types/types';

const neonService = new NeonService();

export const getDrivers = async (): Promise<Driver[]> => {
  const sql = 'SELECT * FROM drivers';
  return (await neonService.executeSelectAsObjects(sql)) as unknown as Driver[];
};

export const getDriver = async (id: number): Promise<Driver> => {
  const sql = 'SELECT * FROM drivers WHERE driver_id = $1';
  const results = await neonService.executeSelectAsObjects(sql, [id]);
  return results[0] as unknown as Driver;
};

export const getDriverWithDetails = async (id: number): Promise<{
  driver: Driver;
  vehicle?: Vehicle;
  trips: Trip[];
}> => {
  // Get driver
  const driver = await getDriver(id);
  
  // Get vehicle associated with driver
  const vehicleSql = 'SELECT * FROM vehicles WHERE driver_id = $1';
  const vehicleResults = await neonService.executeSelectAsObjects(vehicleSql, [id]);
  const vehicle = vehicleResults.length > 0 ? vehicleResults[0] as unknown as Vehicle : undefined;
  
  // Get trips for this driver
  const tripsSql = 'SELECT * FROM trips WHERE driver_id = $1 ORDER BY load_date DESC, load_time DESC';
  const trips = (await neonService.executeSelectAsObjects(tripsSql, [id])) as unknown as Trip[];
  
  return {
    driver,
    vehicle,
    trips,
  };
};

export const createDriver = async (data: CreateDriver | CreateDriverWithVehicle): Promise<Driver> => {
  const fields = ['full_name', 'identification_number', 'phone_number'];
  const values: unknown[] = [data.full_name, data.identification_number, data.phone_number];
  const placeholders = ['$1', '$2', '$3'];

  let paramIndex = 4;
  if (data.operative_license !== undefined) {
    fields.push('operative_license');
    values.push(data.operative_license);
    placeholders.push(`$${paramIndex++}`);
  }

  const sql = `INSERT INTO drivers (${fields.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`;
  const result = await neonService.executeSelectAsObjects(sql, values);
  const driver = result[0] as unknown as Driver;

  // If createVehicle is true, create the vehicle and associate it with the driver
  if ('createVehicle' in data && data.createVehicle && data.vehicleData) {
    const vehicleData: CreateVehicle = {
      ...data.vehicleData,
      driver_id: driver.driver_id,
    };
    await createVehicle(vehicleData);
  }

  return driver;
};

export const updateDriver = async (id: number, data: Partial<Driver>): Promise<Driver> => {
  const updates: string[] = [];
  const values: unknown[] = [];

  let paramIndex = 1;
  Object.keys(data).forEach(key => {
    const value = data[key as keyof Driver];
    if (value !== undefined) {
      updates.push(`${key} = $${paramIndex++}`);
      values.push(value);
    }
  });

  if (updates.length === 0) throw new Error('No fields to update');

  values.push(id); // Add id as the last parameter
  const sql = `UPDATE drivers SET ${updates.join(', ')} WHERE driver_id = $${paramIndex} RETURNING *`;
  const result = await neonService.executeSelectAsObjects(sql, values);
  return result[0] as unknown as Driver;
};

export const deleteDriver = async (id: number): Promise<void> => {
  const sql = 'DELETE FROM drivers WHERE driver_id = $1';
  await neonService.executeDelete(sql, [id]);
};