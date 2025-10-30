import * as driverService from './driverService';
import * as vehicleService from './vehicleService';
import * as tripService from './tripService';

export const clearAllData = async (): Promise<void> => {
  await tripService.deleteAllTrips();
  await vehicleService.deleteAllVehicles();
  await driverService.deleteAllDrivers();
};

export const api = {
  ...driverService,
  ...vehicleService,
  ...tripService,
  clearAllData,
};