import { redirect } from "next/navigation";

// Los destinatarios se movieron al módulo entregas; la URL vieja sigue funcionando.
export default function DestinatariosLegacyPage() {
  redirect("/entregas/destinatarios");
}
