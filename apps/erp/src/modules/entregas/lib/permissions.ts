// Espejo cliente de `assertRole("dispatcher")` en las actions: solo decide qué
// botones mostrar; la autorización real ocurre en el servidor.
export function canManageDeliveries(role: string | null | undefined): boolean {
  return role === "admin" || role === "dispatcher";
}
