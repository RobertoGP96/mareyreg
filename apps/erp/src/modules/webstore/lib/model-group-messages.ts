// Compartidos entre la action ("use server" no puede exportar constantes) y
// el dialog, que reacciona a los errores de versión cerrando y refrescando.
export const MODEL_GROUP_NOT_FOUND_MESSAGE = "El grupo de modelos no existe o fue eliminado";
export const MODEL_GROUP_STALE_MESSAGE =
  "El grupo fue modificado por otra persona. Recarga e intenta de nuevo.";

export function isModelGroupStaleError(message: string): boolean {
  return message === MODEL_GROUP_STALE_MESSAGE || message === MODEL_GROUP_NOT_FOUND_MESSAGE;
}
