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
    },
  });
}

export async function getUserByEmail(email: string) {
  return db.user.findUnique({ where: { email } });
}

export async function getUserCount() {
  return db.user.count();
}
