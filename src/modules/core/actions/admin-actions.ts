"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/types";

export async function clearAllData(): Promise<ActionResult<void>> {
  try {
    // Delete in order to respect foreign key constraints
    await db.trip.deleteMany();
    await db.vehicle.deleteMany();
    await db.driver.deleteMany();

    revalidatePath("/");
    revalidatePath("/drivers");
    revalidatePath("/vehicles");
    revalidatePath("/trips");
    return { success: true, data: undefined };
  } catch (error) {
    console.error("Error clearing data:", error);
    return { success: false, error: "Error al borrar los datos" };
  }
}
