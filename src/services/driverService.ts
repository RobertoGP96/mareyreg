import { NeonService } from './neon-service';
import { createVehicle, getVehicle, getVehicles } from './vehicleService';
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

export const getDriverByIdentification = async (identificationNumber: string): Promise<Driver | null> => {
  const sql = 'SELECT * FROM drivers WHERE identification_number = $1';
  const results = await neonService.executeSelectAsObjects(sql, [identificationNumber]);
  return results.length > 0 ? results[0] as unknown as Driver : null;
};

export const getDriverWithDetails = async (id: number): Promise<{
  driver: Driver;
  vehicle?: Vehicle;
  trips: Trip[];
}> => {
  // Get driver
  const driver = await getDriver(id);

  // Get vehicle associated with driver using the updated getVehicle function
  let vehicle: Vehicle | undefined;
  try {
    // First, find if there's a vehicle assigned to this driver
    const allVehicles = await getVehicles();
    const driverVehicle = allVehicles.find((v: Vehicle) => v.driver_id === id);
    if (driverVehicle) {
      vehicle = await getVehicle(driverVehicle.vehicle_id);
    }
  } catch (error) {
    console.warn('Could not fetch vehicle for driver:', error);
  }

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
  // First, check if a driver with this identification_number already exists
  const existingDriver = await getDriverByIdentification(data.identification_number);

  if (existingDriver) {

    // If createVehicle is true, associate the vehicle with the existing driver
    if ('createVehicle' in data && data.createVehicle && data.vehicleData) {
      const vehicleData: CreateVehicle = {
        ...data.vehicleData,
        driver_id: existingDriver.driver_id,
      };
      await createVehicle(vehicleData);
    }

    return existingDriver;
  }

  // If no existing driver, proceed with creation
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

  // List of allowed fields to update (exclude driver_id)
  const allowedFields: (keyof Driver)[] = [
    'full_name',
    'identification_number',
    'phone_number',
    'operative_license'
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
  const sql = `UPDATE drivers SET ${updates.join(', ')} WHERE driver_id = $${paramIndex} RETURNING *`;
  await neonService.executeSelectAsObjects(sql, values);

  // Return the updated driver
  return await getDriver(id);
};

export const deleteDriver = async (id: number): Promise<void> => {
  const sql = 'DELETE FROM drivers WHERE driver_id = $1';
  await neonService.executeDelete(sql, [id]);
};

export const deleteAllDrivers = async (): Promise<void> => {
  const sql = 'DELETE FROM drivers';
  await neonService.executeDelete(sql);
};