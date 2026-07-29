import { z } from "zod";

export const offerTypeSchema = z.enum(["percent", "fixed"]);

export const offerInputSchema = z
  .object({
    name: z.string().min(1, "El nombre es obligatorio"),
    description: z.string().optional(),
    type: offerTypeSchema,
    value: z.number().positive("El valor debe ser mayor a 0"),
    startsAt: z.string().optional(),
    endsAt: z.string().optional(),
    productIds: z.array(z.number().int().positive()).min(1, "Selecciona al menos un producto"),
    version: z.number().int().nonnegative().optional(),
  })
  .refine((data) => data.type !== "percent" || data.value <= 100, {
    message: "El porcentaje de la oferta debe estar entre 0 y 100",
    path: ["value"],
  })
  .refine(
    (data) => {
      if (!data.startsAt || !data.endsAt) return true;
      return new Date(data.endsAt) > new Date(data.startsAt);
    },
    { message: "La fecha de fin debe ser posterior a la fecha de inicio", path: ["endsAt"] }
  );

export type OfferInput = z.infer<typeof offerInputSchema>;
