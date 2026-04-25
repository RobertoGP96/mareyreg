"use server";

import { db } from "@/lib/db";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/types";
import { requireAuth, requireRole } from "@/lib/auth-guard";
import { signIn, isGoogleAuthEnabled } from "@/lib/auth";
import { AuthError } from "next-auth";

export type ChannelKey = "email" | "push" | "in_app";
export type NotificationPrefs = Record<string, Record<ChannelKey, boolean>>;

export async function loginUser(data: {
  email: string;
  password: string;
  callbackUrl?: string;
}): Promise<ActionResult<{ callbackUrl: string }>> {
  try {
    await signIn("credentials", {
      email: data.email,
      password: data.password,
      redirect: false,
    });

    return {
      success: true,
      data: { callbackUrl: data.callbackUrl || "/" },
    };
  } catch (error) {
    if (error instanceof AuthError) {
      return { success: false, error: "Credenciales incorrectas" };
    }
    throw error;
  }
}

export async function loginWithGoogle(callbackUrl?: string): Promise<void> {
  if (!isGoogleAuthEnabled) {
    throw new Error("Google auth no está configurado");
  }
  await signIn("google", { redirectTo: callbackUrl || "/" });
}

// ============================================================
// PROFILE / SECURITY / PREFERENCES (current user)
// ============================================================

export async function updateUserProfile(data: {
  fullName: string;
}): Promise<ActionResult<void>> {
  try {
    const session = await requireAuth();
    const fullName = data.fullName.trim();

    if (fullName.length < 2) {
      return { success: false, error: "El nombre debe tener al menos 2 caracteres" };
    }

    await db.user.update({
      where: { userId: session.user.userId },
      data: { fullName },
    });

    revalidatePath("/settings/profile");
    revalidatePath("/", "layout");
    return { success: true, data: undefined };
  } catch (error) {
    console.error("updateUserProfile error:", error);
    return { success: false, error: "Error al actualizar el perfil" };
  }
}

export async function updateUserPassword(data: {
  currentPassword: string;
  newPassword: string;
}): Promise<ActionResult<void>> {
  try {
    const session = await requireAuth();

    if (data.newPassword.length < 8) {
      return {
        success: false,
        error: "La contraseña nueva debe tener al menos 8 caracteres",
      };
    }
    if (data.currentPassword === data.newPassword) {
      return {
        success: false,
        error: "La nueva contraseña no puede ser igual a la actual",
      };
    }

    const user = await db.user.findUnique({
      where: { userId: session.user.userId },
      select: { passwordHash: true },
    });
    if (!user) return { success: false, error: "Usuario no encontrado" };

    const valid = await bcrypt.compare(data.currentPassword, user.passwordHash);
    if (!valid) {
      return { success: false, error: "La contraseña actual es incorrecta" };
    }

    const passwordHash = await bcrypt.hash(data.newPassword, 12);
    await db.user.update({
      where: { userId: session.user.userId },
      data: { passwordHash },
    });

    return { success: true, data: undefined };
  } catch (error) {
    console.error("updateUserPassword error:", error);
    return { success: false, error: "Error al cambiar la contraseña" };
  }
}

export async function updateNotificationPrefs(
  prefs: NotificationPrefs
): Promise<ActionResult<void>> {
  try {
    const session = await requireAuth();

    await db.user.update({
      where: { userId: session.user.userId },
      data: { notificationPrefs: prefs },
    });

    revalidatePath("/settings/notifications");
    return { success: true, data: undefined };
  } catch (error) {
    console.error("updateNotificationPrefs error:", error);
    return { success: false, error: "Error al guardar preferencias" };
  }
}

// Admin-only: clear database (kept where it was originally — unrelated)

export async function registerInitialAdmin(data: {
  email: string;
  password: string;
  fullName: string;
}): Promise<ActionResult<{ userId: number }>> {
  try {
    const userCount = await db.user.count();
    if (userCount > 0) {
      return { success: false, error: "Ya existe un administrador registrado" };
    }

    const passwordHash = await bcrypt.hash(data.password, 12);
    const user = await db.user.create({
      data: {
        email: data.email,
        passwordHash,
        fullName: data.fullName,
        role: "admin",
      },
    });

    return { success: true, data: { userId: user.userId } };
  } catch (error) {
    console.error("Error registering admin:", error);
    return { success: false, error: "Error al registrar el administrador" };
  }
}

export async function createUser(data: {
  email: string;
  password: string;
  fullName: string;
  role: "admin" | "dispatcher" | "viewer";
  modules: string[];
}): Promise<ActionResult<{ userId: number }>> {
  try {
    await requireRole(["admin"]);

    const existing = await db.user.findUnique({
      where: { email: data.email },
    });
    if (existing) {
      return { success: false, error: "Ya existe un usuario con ese email" };
    }

    const passwordHash = await bcrypt.hash(data.password, 12);
    const user = await db.user.create({
      data: {
        email: data.email,
        passwordHash,
        fullName: data.fullName,
        role: data.role,
        modulePermissions: {
          create: data.modules.map((moduleId) => ({ moduleId })),
        },
      },
    });

    revalidatePath("/settings/users");
    return { success: true, data: { userId: user.userId } };
  } catch (error) {
    console.error("Error creating user:", error);
    return { success: false, error: "Error al crear el usuario" };
  }
}

export async function updateUser(
  id: number,
  data: {
    email?: string;
    fullName?: string;
    role?: "admin" | "dispatcher" | "viewer";
    password?: string;
    modules?: string[];
  }
): Promise<ActionResult<void>> {
  try {
    await requireRole(["admin"]);

    const updateData: Record<string, unknown> = {};
    if (data.email) updateData.email = data.email;
    if (data.fullName) updateData.fullName = data.fullName;
    if (data.role) updateData.role = data.role;
    if (data.password) updateData.passwordHash = await bcrypt.hash(data.password, 12);

    await db.user.update({
      where: { userId: id },
      data: updateData,
    });

    if (data.modules !== undefined) {
      await db.userModulePermission.deleteMany({ where: { userId: id } });
      if (data.modules.length > 0) {
        await db.userModulePermission.createMany({
          data: data.modules.map((moduleId) => ({ userId: id, moduleId })),
        });
      }
    }

    revalidatePath("/settings/users");
    return { success: true, data: undefined };
  } catch (error) {
    console.error("Error updating user:", error);
    return { success: false, error: "Error al actualizar el usuario" };
  }
}

export async function deleteUser(id: number): Promise<ActionResult<void>> {
  try {
    await requireRole(["admin"]);

    await db.user.delete({ where: { userId: id } });
    revalidatePath("/settings/users");
    return { success: true, data: undefined };
  } catch (error) {
    console.error("Error deleting user:", error);
    return { success: false, error: "Error al eliminar el usuario" };
  }
}
