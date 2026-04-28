// Zod schemas compartidos por server actions y formularios.
import { z } from "zod";

export const currencySchema = z.object({
  code: z
    .string()
    .trim()
    .min(2, "Código mínimo 2 caracteres")
    .max(8, "Código máximo 8 caracteres")
    .regex(/^[A-Z0-9]+$/, "Solo mayúsculas y números"),
  name: z.string().trim().min(1, "Nombre requerido").max(60),
  symbol: z.string().trim().min(1, "Símbolo requerido").max(8),
  decimalPlaces: z.coerce.number().int().min(0).max(8),
  active: z.boolean().optional(),
});
export type CurrencyInput = z.infer<typeof currencySchema>;

export const accountGroupSchema = z.object({
  code: z
    .string()
    .trim()
    .min(2, "Código mínimo 2 caracteres")
    .max(40)
    .regex(/^[A-Z0-9_]+$/, "Solo mayúsculas, números y guion bajo"),
  name: z.string().trim().min(1, "Nombre requerido").max(120),
  description: z.string().trim().max(500).nullish(),
  userId: z.coerce.number().int().positive("Selecciona un responsable"),
  active: z.boolean().optional(),
});
export type AccountGroupInput = z.infer<typeof accountGroupSchema>;
