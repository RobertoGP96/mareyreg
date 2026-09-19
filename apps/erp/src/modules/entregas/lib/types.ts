// DTOs serializables para los componentes cliente del módulo.
import type { Currency } from "@/generated/prisma";

/** Moneda del catálogo (de envios) reducida a lo que necesita una entrega. */
export type CurrencyOption = Pick<
  Currency,
  "currencyId" | "code" | "name" | "symbol" | "kind" | "decimalPlaces" | "active"
>;
