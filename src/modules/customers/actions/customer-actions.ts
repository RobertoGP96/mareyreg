"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/types";
import { createAuditLog, getCurrentUserId } from "@/lib/audit";

export interface CustomerInput {
  name: string;
  taxId?: string;
  email?: string;
  phone?: string;
  address?: string;
  customerType?: "retail" | "wholesale";
  creditLimit?: number;
  paymentTerms?: number;
  priceListId?: number | null;
  notes?: string;
}

export async function createCustomer(
  data: CustomerInput
): Promise<ActionResult<{ customerId: number }>> {
  try {
    const userId = await getCurrentUserId();
    const customer = await db.$transaction(async (tx) => {
      const c = await tx.customer.create({
        data: {
          name: data.name,
          taxId: data.taxId || null,
          email: data.email || null,
          phone: data.phone || null,
          address: data.address || null,
          customerType: data.customerType ?? "retail",
          creditLimit: data.creditLimit ?? null,
          paymentTerms: data.paymentTerms ?? null,
          priceListId: data.priceListId ?? null,
          notes: data.notes || null,
        },
      });
      await createAuditLog(tx, {
        action: "create",
        entityType: "Customer",
        entityId: c.customerId,
        module: "sales",
        userId,
        newValues: data,
      });
      return c;
    });
    revalidatePath("/customers");
    return { success: true, data: { customerId: customer.customerId } };
  } catch (error) {
    console.error("Error creating customer:", error);
    return { success: false, error: "Error al crear el cliente" };
  }
}

export async function updateCustomer(
  id: number,
  data: Partial<CustomerInput> & { isActive?: boolean }
): Promise<ActionResult<void>> {
  try {
    const userId = await getCurrentUserId();
    await db.$transaction(async (tx) => {
      const prev = await tx.customer.findUnique({ where: { customerId: id } });
      await tx.customer.update({
        where: { customerId: id },
        data: {
          ...(data.name !== undefined && { name: data.name }),
          ...(data.taxId !== undefined && { taxId: data.taxId || null }),
          ...(data.email !== undefined && { email: data.email || null }),
          ...(data.phone !== undefined && { phone: data.phone || null }),
          ...(data.address !== undefined && { address: data.address || null }),
          ...(data.customerType !== undefined && { customerType: data.customerType }),
          ...(data.creditLimit !== undefined && { creditLimit: data.creditLimit ?? null }),
          ...(data.paymentTerms !== undefined && { paymentTerms: data.paymentTerms ?? null }),
          ...(data.priceListId !== undefined && { priceListId: data.priceListId }),
          ...(data.notes !== undefined && { notes: data.notes || null }),
          ...(data.isActive !== undefined && { isActive: data.isActive }),
        },
      });
      await createAuditLog(tx, {
        action: "update",
        entityType: "Customer",
        entityId: id,
        module: "sales",
        userId,
        oldValues: prev,
        newValues: data,
      });
    });
    revalidatePath("/customers");
    return { success: true, data: undefined };
  } catch (error) {
    console.error("Error updating customer:", error);
    return { success: false, error: "Error al actualizar el cliente" };
  }
}

export async function deleteCustomer(id: number): Promise<ActionResult<void>> {
  try {
    const userId = await getCurrentUserId();
    await db.$transaction(async (tx) => {
      const prev = await tx.customer.findUnique({ where: { customerId: id } });
      await tx.customer.delete({ where: { customerId: id } });
      await createAuditLog(tx, {
        action: "delete",
        entityType: "Customer",
        entityId: id,
        module: "sales",
        userId,
        oldValues: prev,
      });
    });
    revalidatePath("/customers");
    return { success: true, data: undefined };
  } catch (error) {
    console.error("Error deleting customer:", error);
    return { success: false, error: "Error al eliminar el cliente. Verifique que no tenga facturas asociadas." };
  }
}
