"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/types";
import { createAuditLog, getCurrentUserId } from "@/lib/audit";

export interface SupplierInput {
  name: string;
  taxId?: string;
  email?: string;
  phone?: string;
  address?: string;
  contactPerson?: string;
  paymentTerms?: number;
  notes?: string;
}

export async function createSupplier(
  data: SupplierInput
): Promise<ActionResult<{ supplierId: number }>> {
  try {
    const userId = await getCurrentUserId();
    const supplier = await db.$transaction(async (tx) => {
      const s = await tx.supplier.create({
        data: {
          name: data.name,
          taxId: data.taxId || null,
          email: data.email || null,
          phone: data.phone || null,
          address: data.address || null,
          contactPerson: data.contactPerson || null,
          paymentTerms: data.paymentTerms ?? null,
          notes: data.notes || null,
        },
      });
      await createAuditLog(tx, {
        action: "create",
        entityType: "Supplier",
        entityId: s.supplierId,
        module: "purchasing",
        userId,
        newValues: data,
      });
      return s;
    });
    revalidatePath("/suppliers");
    return { success: true, data: { supplierId: supplier.supplierId } };
  } catch (error) {
    console.error("Error creating supplier:", error);
    return { success: false, error: "Error al crear el proveedor" };
  }
}

export async function updateSupplier(
  id: number,
  data: Partial<SupplierInput> & { isActive?: boolean }
): Promise<ActionResult<void>> {
  try {
    const userId = await getCurrentUserId();
    await db.$transaction(async (tx) => {
      const prev = await tx.supplier.findUnique({ where: { supplierId: id } });
      await tx.supplier.update({
        where: { supplierId: id },
        data: {
          ...(data.name !== undefined && { name: data.name }),
          ...(data.taxId !== undefined && { taxId: data.taxId || null }),
          ...(data.email !== undefined && { email: data.email || null }),
          ...(data.phone !== undefined && { phone: data.phone || null }),
          ...(data.address !== undefined && { address: data.address || null }),
          ...(data.contactPerson !== undefined && { contactPerson: data.contactPerson || null }),
          ...(data.paymentTerms !== undefined && { paymentTerms: data.paymentTerms ?? null }),
          ...(data.notes !== undefined && { notes: data.notes || null }),
          ...(data.isActive !== undefined && { isActive: data.isActive }),
        },
      });
      await createAuditLog(tx, {
        action: "update",
        entityType: "Supplier",
        entityId: id,
        module: "purchasing",
        userId,
        oldValues: prev,
        newValues: data,
      });
    });
    revalidatePath("/suppliers");
    return { success: true, data: undefined };
  } catch (error) {
    console.error("Error updating supplier:", error);
    return { success: false, error: "Error al actualizar el proveedor" };
  }
}

export async function deleteSupplier(id: number): Promise<ActionResult<void>> {
  try {
    const userId = await getCurrentUserId();
    await db.$transaction(async (tx) => {
      const prev = await tx.supplier.findUnique({ where: { supplierId: id } });
      await tx.supplier.delete({ where: { supplierId: id } });
      await createAuditLog(tx, {
        action: "delete",
        entityType: "Supplier",
        entityId: id,
        module: "purchasing",
        userId,
        oldValues: prev,
      });
    });
    revalidatePath("/suppliers");
    return { success: true, data: undefined };
  } catch (error) {
    console.error("Error deleting supplier:", error);
    return { success: false, error: "Error al eliminar el proveedor. Verifique que no tenga OC asociadas." };
  }
}
