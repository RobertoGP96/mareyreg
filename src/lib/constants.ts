export const CUBAN_PROVINCES = [
  "Pinar del Rio",
  "Artemisa",
  "La Habana",
  "Mayabeque",
  "Matanzas",
  "Villa Clara",
  "Cienfuegos",
  "Sancti Spiritus",
  "Ciego de Avila",
  "Camaguey",
  "Las Tunas",
  "Holguin",
  "Granma",
  "Santiago de Cuba",
  "Guantanamo",
  "Isla de la Juventud",
] as const;

export const PRODUCTS = [
  "Cemento",
  "Arena",
  "Grava",
  "Hierro",
  "Madera",
  "Alimentos",
  "Combustible",
  "Contenedor",
  "Otro",
] as const;

export const CARGO_TYPES = [
  { value: "bulk", label: "A granel" },
  { value: "container", label: "Contenedor" },
  { value: "refrigerated", label: "Refrigerado" },
  { value: "general", label: "General" },
] as const;

export const MOVEMENT_TYPES = [
  { value: "entry", label: "Entrada" },
  { value: "exit", label: "Salida" },
  { value: "transfer", label: "Transferencia" },
  { value: "adjustment", label: "Ajuste" },
] as const;


export const PRODUCT_UNITS = [
  { value: "kg", label: "Kilogramos" },
  { value: "litros", label: "Litros" },
  { value: "unidades", label: "Unidades" },
  { value: "pacas", label: "Pacas" },
  { value: "metros", label: "Metros" },
] as const;

export const RESERVATION_STATUSES = [
  { value: "active", label: "Activa" },
  { value: "completed", label: "Completada" },
  { value: "cancelled", label: "Cancelada" },
  { value: "expired", label: "Expirada" },
] as const;

export const PAYMENT_METHODS = [
  { value: "efectivo", label: "Efectivo" },
  { value: "transferencia", label: "Transferencia" },
  { value: "tarjeta", label: "Tarjeta" },
  { value: "otro", label: "Otro" },
] as const;

export const PRODUCT_CATEGORIES = [
  { value: "materiales", label: "Materiales" },
  { value: "alimentos", label: "Alimentos" },
  { value: "ropa", label: "Ropa" },
  { value: "combustible", label: "Combustible" },
  { value: "otro", label: "Otro" },
] as const;
