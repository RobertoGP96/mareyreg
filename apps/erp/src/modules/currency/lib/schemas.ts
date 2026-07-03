import { z } from "zod";

export const createExchangeRateSchema = z
  .object({
    baseCurrencyId: z.coerce.number().int().positive("Selecciona moneda base"),
    quoteCurrencyId: z.coerce.number().int().positive("Selecciona moneda destino"),
    rate: z.coerce.number().positive("La tasa debe ser mayor a 0"),
    note: z.string().trim().max(300).nullish(),
  })
  .refine((d) => d.baseCurrencyId !== d.quoteCurrencyId, {
    message: "Base y destino deben ser monedas distintas",
    path: ["quoteCurrencyId"],
  });
export type CreateExchangeRateInput = z.infer<typeof createExchangeRateSchema>;

export const updateExchangeRateSchema = z.object({
  exchangeRateId: z.coerce.number().int().positive(),
  rate: z.coerce.number().positive("La tasa debe ser mayor a 0"),
  expectedVersion: z.coerce.number().int().min(0),
  note: z.string().trim().max(300).nullish(),
});
export type UpdateExchangeRateInput = z.infer<typeof updateExchangeRateSchema>;

export const deleteExchangeRateSchema = z.object({
  exchangeRateId: z.coerce.number().int().positive(),
});
export type DeleteExchangeRateInput = z.infer<typeof deleteExchangeRateSchema>;
