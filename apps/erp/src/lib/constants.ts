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

export const CONTAINER_TYPES = [
  { value: "20ft", label: "20 pies" },
  { value: "40ft", label: "40 pies" },
  { value: "40ft_hc", label: "40 pies HC" },
  { value: "reefer", label: "Refrigerado" },
  { value: "other", label: "Otro" },
] as const;

export const MOVEMENT_TYPES = [
  { value: "entry", label: "Entrada" },
  { value: "exit", label: "Salida" },
  { value: "transfer", label: "Transferencia" },
  { value: "adjustment", label: "Ajuste" },
] as const;


// =============================================
// UNIDADES DE MEDIDA (basado en UNECE Rec.20)
// =============================================

export const UNIT_GROUPS = [
  "Peso",
  "Volumen",
  "Longitud",
  "Empaque / Embalaje",
  "Area",
] as const;

export type UnitGroup = (typeof UNIT_GROUPS)[number];

export interface ProductUnit {
  value: string;
  label: string;
  abbreviation: string;
  group: UnitGroup;
}

export const PRODUCT_UNITS: ProductUnit[] = [
  // --- Peso ---
  { value: "kg", label: "Kilogramos", abbreviation: "kg", group: "Peso" },
  { value: "g", label: "Gramos", abbreviation: "g", group: "Peso" },
  { value: "ton", label: "Toneladas", abbreviation: "t", group: "Peso" },
  { value: "lb", label: "Libras", abbreviation: "lb", group: "Peso" },
  { value: "oz", label: "Onzas", abbreviation: "oz", group: "Peso" },
  { value: "qq", label: "Quintales", abbreviation: "qq", group: "Peso" },

  // --- Volumen ---
  { value: "litros", label: "Litros", abbreviation: "L", group: "Volumen" },
  { value: "ml", label: "Mililitros", abbreviation: "mL", group: "Volumen" },
  { value: "galon", label: "Galones", abbreviation: "gal", group: "Volumen" },
  { value: "m3", label: "Metros cubicos", abbreviation: "m\u00B3", group: "Volumen" },

  // --- Longitud ---
  { value: "metros", label: "Metros", abbreviation: "m", group: "Longitud" },
  { value: "cm", label: "Centimetros", abbreviation: "cm", group: "Longitud" },
  { value: "pulgadas", label: "Pulgadas", abbreviation: "in", group: "Longitud" },
  { value: "pies", label: "Pies", abbreviation: "ft", group: "Longitud" },

  // --- Empaque / Embalaje ---
  { value: "unidades", label: "Unidades", abbreviation: "und", group: "Empaque / Embalaje" },
  { value: "cajas", label: "Cajas", abbreviation: "cja", group: "Empaque / Embalaje" },
  { value: "bultos", label: "Bultos", abbreviation: "bto", group: "Empaque / Embalaje" },
  { value: "sacos", label: "Sacos", abbreviation: "sco", group: "Empaque / Embalaje" },
  { value: "pacas", label: "Pacas", abbreviation: "pca", group: "Empaque / Embalaje" },
  { value: "pallets", label: "Pallets", abbreviation: "plt", group: "Empaque / Embalaje" },
  { value: "fardos", label: "Fardos", abbreviation: "fdo", group: "Empaque / Embalaje" },
  { value: "paquetes", label: "Paquetes", abbreviation: "pqt", group: "Empaque / Embalaje" },
  { value: "rollos", label: "Rollos", abbreviation: "rll", group: "Empaque / Embalaje" },
  { value: "bidones", label: "Bidones", abbreviation: "bid", group: "Empaque / Embalaje" },
  { value: "tambores", label: "Tambores", abbreviation: "tbr", group: "Empaque / Embalaje" },
  { value: "garrafones", label: "Garrafones", abbreviation: "grf", group: "Empaque / Embalaje" },
  { value: "botellas", label: "Botellas", abbreviation: "bot", group: "Empaque / Embalaje" },
  { value: "latas", label: "Latas", abbreviation: "lta", group: "Empaque / Embalaje" },

  // --- Area ---
  { value: "m2", label: "Metros cuadrados", abbreviation: "m\u00B2", group: "Area" },
  { value: "pies2", label: "Pies cuadrados", abbreviation: "ft\u00B2", group: "Area" },
];

export function getUnitByValue(value: string): ProductUnit | undefined {
  return PRODUCT_UNITS.find((u) => u.value === value);
}

export function getUnitLabel(value: string): string {
  return getUnitByValue(value)?.label ?? value;
}

export function getUnitAbbreviation(value: string): string {
  return getUnitByValue(value)?.abbreviation ?? value;
}

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
  { value: "materiales_construccion", label: "Materiales de Construccion" },
  { value: "ferreteria", label: "Ferreteria" },
  { value: "alimentos", label: "Alimentos y Bebidas" },
  { value: "productos_limpieza", label: "Productos de Limpieza" },
  { value: "combustible", label: "Combustible y Lubricantes" },
  { value: "quimicos", label: "Productos Quimicos" },
  { value: "repuestos", label: "Repuestos y Autopartes" },
  { value: "neumaticos", label: "Neumaticos y Gomas" },
  { value: "ropa", label: "Ropa y Textiles" },
  { value: "insumos_oficina", label: "Insumos de Oficina" },
  { value: "equipos", label: "Equipos y Herramientas" },
  { value: "tecnologia", label: "Tecnologia" },
  { value: "epp", label: "Equipos de Proteccion Personal" },
  { value: "otro", label: "Otro" },
] as const;

export const WAREHOUSE_TYPES = [
  { value: "general", label: "General" },
  { value: "refrigerado", label: "Refrigerado" },
  { value: "exterior", label: "Exterior / Patio" },
  { value: "transito", label: "En Transito" },
  { value: "combustible", label: "Deposito de Combustible" },
] as const;
