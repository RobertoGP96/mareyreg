import { z } from "zod";

function nonEmptyTrimmed(fieldLabel: string) {
  return z
    .string()
    .trim()
    .min(1, `${fieldLabel} no puede estar vacío`)
    .optional();
}

export const presentationCreateSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "El nombre de la presentación es obligatorio")
    .max(80, "El nombre de la presentación no puede exceder 80 caracteres"),
  factor: z.number().positive("El factor debe ser mayor a 0"),
  retailPrice: z.number().min(0, "El precio de menudeo no puede ser negativo"),
  wholesalePrice: z
    .number()
    .min(0, "El precio de mayoreo no puede ser negativo")
    .nullable()
    .optional(),
  sku: nonEmptyTrimmed("El SKU"),
  barcode: nonEmptyTrimmed("El código de barras"),
  sortOrder: z.number().int().min(0).optional(),
});

export const presentationUpdateSchema = presentationCreateSchema.partial().extend({
  reason: z.string().trim().optional(),
});

export type PresentationCreateInput = z.infer<typeof presentationCreateSchema>;
export type PresentationUpdateInput = z.infer<typeof presentationUpdateSchema>;
