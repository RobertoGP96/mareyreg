import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export type Role = "admin" | "dispatcher" | "viewer";

export class ForbiddenError extends Error {
  constructor(message = "No tienes permisos para realizar esta acción") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export async function requireAuth() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  return session;
}

export async function requireRole(roles: string[]) {
  const session = await requireAuth();
  if (!roles.includes(session.user.role)) redirect("/");
  return session;
}

/**
 * Server-only guard para server actions. A diferencia de `requireRole`
 * (que hace `redirect()` y sólo tiene sentido en layouts), esta lanza
 * `ForbiddenError` para que la action la capture en su `catch` y devuelva
 * un `ActionResult` con mensaje en español. Admin siempre pasa.
 */
export async function assertRole(...roles: Role[]): Promise<void> {
  const session = await auth();
  if (!session?.user) throw new Error("No autenticado");
  const role = session.user.role as Role;
  if (role === "admin") return;
  if (!roles.includes(role)) throw new ForbiddenError();
}

export async function requireModule(moduleId: string) {
  const session = await requireAuth();
  if (session.user.role === "admin") return session;
  if (!session.user.modules?.includes(moduleId)) redirect("/");
  return session;
}
