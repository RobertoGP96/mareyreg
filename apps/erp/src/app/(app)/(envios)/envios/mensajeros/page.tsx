import { redirect } from "next/navigation";

// Los mensajeros se movieron al módulo entregas; la URL vieja sigue funcionando.
export default function MensajerosLegacyPage() {
  redirect("/entregas/mensajeros");
}
