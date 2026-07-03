"use server";

import { z } from "zod";
import { upsertCustomer } from "@/lib/erp-client";

const syncProfileSchema = z.object({
  name: z.string().trim().min(1),
  phone: z.string().trim().min(5),
  email: z.string().trim().email().optional(),
  address: z.string().trim().optional(),
});

export type SyncProfileInput = z.infer<typeof syncProfileSchema>;

export type SyncProfileResult =
  | { success: true; data: { customerId: number; created: boolean } }
  | { success: false; error: string };

const GENERIC_ERROR = "No pudimos sincronizar tu perfil en este momento.";

/**
 * Sincroniza el perfil de la tienda con el ERP. Best-effort: cualquier
 * fallo (validación, red, respuesta de error) se devuelve como
 * { success: false } SIN lanzar — el registro/perfil local nunca debe
 * romperse por una falla del ERP.
 */
export async function syncProfile(
  input: SyncProfileInput
): Promise<SyncProfileResult> {
  try {
    const parsed = syncProfileSchema.safeParse(input);
    if (!parsed.success) {
      console.error("syncProfile validación:", parsed.error.flatten());
      return { success: false, error: GENERIC_ERROR };
    }
    const profile = parsed.data;

    const result = await upsertCustomer({
      name: profile.name,
      phone: profile.phone,
      ...(profile.email ? { email: profile.email } : {}),
      ...(profile.address ? { address: profile.address } : {}),
    });

    return {
      success: true,
      data: { customerId: result.customerId, created: result.created },
    };
  } catch (e) {
    console.error("syncProfile:", e);
    return { success: false, error: GENERIC_ERROR };
  }
}
