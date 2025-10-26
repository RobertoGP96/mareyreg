import * as driverService from './driverService';
import * as vehicleService from './vehicleService';
import * as tripService from './tripService';

export const api = {
  ...driverService,
  ...vehicleService,
  ...tripService,
};