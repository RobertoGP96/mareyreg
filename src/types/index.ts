import type {
  Driver,
  Vehicle,
  Trip,
  Route,
  Cargo,
  Payment,
  User,
  Product,
  Warehouse,
  StockMovement,
  StockLevel,
} from "@/generated/prisma";

// Re-export Prisma types
export type {
  Driver,
  Vehicle,
  Trip,
  Route,
  Cargo,
  Payment,
  User,
  Product,
  Warehouse,
  StockMovement,
  StockLevel,
};

// Extended types with relations
export type VehicleWithDriver = Vehicle & {
  driver: Driver | null;
};

export type TripWithDriver = Trip & {
  driver: Driver;
};

export type DriverWithDetails = Driver & {
  vehicles: Vehicle[];
  trips: Trip[];
};

// Action result type
export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };
