import type {
  Entity,
  Driver,
  Vehicle,
  Trip,
  Route,
  Cargo,
  Container,
  Payment,
  User,
  Product,
  Warehouse,
  StockMovement,
  StockLevel,
  TripStatus,
  VehicleStatus,
  DriverStatus,
} from "@/generated/prisma";

// Re-export Prisma types
export type {
  Entity,
  Driver,
  Vehicle,
  Trip,
  Route,
  Cargo,
  Container,
  Payment,
  User,
  Product,
  Warehouse,
  StockMovement,
  StockLevel,
  TripStatus,
  VehicleStatus,
  DriverStatus,
};

// Extended types with relations
export type DriverWithEntity = Driver & {
  entity: Entity;
};

export type EntityWithDrivers = Entity & {
  drivers: Driver[];
};

export type VehicleWithDriver = Vehicle & {
  driver: Driver | null;
};

export type TripWithDriver = Trip & {
  driver: Driver;
};

export type TripWithContainers = Trip & {
  containers: Container[];
};

export type DriverWithDetails = Driver & {
  entity: Entity;
  vehicles: Vehicle[];
  trips: (Trip & { containers: Container[] })[];
};

// Action result type
export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };
