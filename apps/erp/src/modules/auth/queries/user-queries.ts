import { db } from "@/lib/db";

export async function getUsers() {
  return db.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      userId: true,
      email: true,
      fullName: true,
      role: true,
      createdAt: true,
      modulePermissions: {
        select: { moduleId: true },
      },
    },
  });
}

export async function getUserByEmail(email: string) {
  return db.user.findUnique({ where: { email } });
}

export async function getUserCount() {
  return db.user.count();
}

import type { ChannelKey, NotificationPrefs } from "../actions/auth-actions";

export async function getUserNotificationPrefs(
  userId: number
): Promise<NotificationPrefs | null> {
  const row = await db.user.findUnique({
    where: { userId },
    select: { notificationPrefs: true },
  });
  if (!row?.notificationPrefs) return null;
  // Prisma Json field comes through as `unknown`; we trust our own writes here.
  return row.notificationPrefs as NotificationPrefs;
}

export type { ChannelKey, NotificationPrefs };
