import { auth } from "@/lib/auth";

export async function requireAuth() {
  const session = await auth();
  if (!session?.user) {
    throw new Error("No autenticado");
  }
  return session;
}

export async function requireRole(roles: string[]) {
  const session = await requireAuth();
  if (!roles.includes(session.user.role)) {
    throw new Error("No tienes permisos para realizar esta accion");
  }
  return session;
}

export async function requireModule(moduleId: string) {
  const session = await requireAuth();
  if (session.user.role === "admin") return session;
  if (!session.user.modules?.includes(moduleId)) {
    throw new Error("No tienes acceso a este modulo");
  }
  return session;
}
