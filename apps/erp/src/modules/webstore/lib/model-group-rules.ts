/** Campos de `Product` que deciden si puede compartir card con otros modelos. */
export interface ModelGroupMemberFacts {
  productId: number;
  name: string;
  sku: string | null;
  unit: string;
  isCatchWeight: boolean;
  isService: boolean;
  modelGroupId: number | null;
}

/**
 * Devuelve el motivo (en español) por el que `candidate` NO puede pertenecer
 * al grupo formado por `members`, o `null` si es válido. `groupId` es el grupo
 * que se está editando (`null` al crear): estar ya en ese mismo grupo es válido;
 * estar en otro, no. No se impone `category`: afectaría descuentos por
 * categoría y precios por volumen.
 */
export function modelGroupMembershipIssue(
  members: ModelGroupMemberFacts[],
  candidate: ModelGroupMemberFacts,
  groupId: number | null = null
): string | null {
  const label = `«${candidate.name}»`;

  if (candidate.isService) {
    return `${label} es un servicio y no puede agruparse como modelo.`;
  }
  if (!candidate.sku || candidate.sku.trim() === "") {
    return `${label} no tiene SKU; asígnale uno antes de agruparlo.`;
  }
  if (candidate.modelGroupId != null && candidate.modelGroupId !== groupId) {
    return `${label} ya pertenece a otro grupo de modelos. Sácalo de ese grupo primero.`;
  }

  const reference = members.find((m) => m.productId !== candidate.productId);
  if (!reference) return null;

  if (reference.isCatchWeight !== candidate.isCatchWeight) {
    return candidate.isCatchWeight
      ? `${label} es de peso variable y el resto del grupo no; no pueden compartir card.`
      : `${label} no es de peso variable y el resto del grupo sí; no pueden compartir card.`;
  }
  if (reference.unit !== candidate.unit) {
    return `${label} se vende en «${candidate.unit}» y el grupo en «${reference.unit}»; todos los modelos deben compartir la unidad.`;
  }
  return null;
}
