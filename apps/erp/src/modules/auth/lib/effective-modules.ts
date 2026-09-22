import { getEnabledModuleIds } from "@/lib/module-registry";

/** Módulos efectivos de un usuario: los suyos más los que concede su rol, sin duplicados. */
export function mergeEffectiveModules(
  explicit: readonly string[],
  grantedByRole: readonly string[]
): string[] {
  return Array.from(new Set([...explicit, ...grantedByRole]));
}

/** Descarta ids que no correspondan a un módulo habilitado en el registry. */
export function sanitizeModuleIds(ids: readonly string[]): string[] {
  const enabled = new Set(getEnabledModuleIds());
  return Array.from(new Set(ids.filter((id) => enabled.has(id))));
}
