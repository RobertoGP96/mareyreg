import { z } from "zod";

export const webstoreCustomerUpdateSchema = z.object({
  name: z.string().trim().min(1, "El nombre es requerido"),
  phone: z.string().trim().min(5, "El teléfono debe tener al menos 5 caracteres").optional(),
  email: z.string().trim().email("Email inválido").optional().or(z.literal("")),
  address: z.string().trim().optional(),
  version: z.number().int().nonnegative(),
});

export type WebstoreCustomerUpdateInput = z.infer<typeof webstoreCustomerUpdateSchema>;
