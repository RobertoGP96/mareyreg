"use server";

import { db } from "@/lib/db";
import type { ActionResult } from "@/types";
import { getEffectivePrice } from "../lib/effective-price";

export async function getSuggestedUnitPriceAction(
  productId: number,
  quantity: number,
  customerId?: number
): Promise<ActionResult<{ basePrice: number; finalPrice: number }>> {
  try {
    const price = await getEffectivePrice(db, { productId, quantity, customerId });
    return { success: true, data: { basePrice: price.basePrice, finalPrice: price.finalPrice } };
  } catch (error) {
    console.error("Error getting suggested unit price:", error);
    return { success: false, error: "Error al calcular el precio" };
  }
}
