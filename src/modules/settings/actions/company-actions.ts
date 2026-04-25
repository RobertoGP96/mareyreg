"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/types";
import { requireRole } from "@/lib/auth-guard";
import type { CompanyData } from "../queries/company-queries";

export type CompanyInput = {
  name: string;
  rfc?: string;
  phone?: string;
  address?: string;
  description?: string;
  timezone: string;
  currency: string;
  language: string;
};

export async function updateCompany(
  data: CompanyInput
): Promise<ActionResult<CompanyData>> {
  try {
    await requireRole(["admin"]);

    const name = data.name.trim();
    if (name.length < 2) {
      return { success: false, error: "El nombre de la empresa es obligatorio" };
    }

    const payload = {
      name,
      rfc: data.rfc?.trim() || null,
      phone: data.phone?.trim() || null,
      address: data.address?.trim() || null,
      description: data.description?.trim() || null,
      timezone: data.timezone,
      currency: data.currency,
      language: data.language,
    };

    const row = await db.company.upsert({
      where: { id: 1 },
      update: payload,
      create: { id: 1, ...payload },
    });

    revalidatePath("/settings/general");
    revalidatePath("/", "layout");

    return {
      success: true,
      data: {
        name: row.name,
        rfc: row.rfc,
        phone: row.phone,
        address: row.address,
        description: row.description,
        timezone: row.timezone,
        currency: row.currency,
        language: row.language,
      },
    };
  } catch (error) {
    console.error("updateCompany error:", error);
    return { success: false, error: "Error al guardar la información" };
  }
}
