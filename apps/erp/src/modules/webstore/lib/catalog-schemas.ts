import { z } from "zod";

export const updatePriceSchema = z.object({
  productId: z.number().int().positive(),
  salePrice: z.number().nonnegative(),
});

export const toggleFlagSchema = z.object({
  productId: z.number().int().positive(),
  value: z.boolean(),
});

export type UpdatePriceInput = z.infer<typeof updatePriceSchema>;
export type ToggleFlagInput = z.infer<typeof toggleFlagSchema>;
