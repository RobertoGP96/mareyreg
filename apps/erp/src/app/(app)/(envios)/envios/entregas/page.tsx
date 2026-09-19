import { redirect } from "next/navigation";

// Las entregas se movieron al módulo entregas; la URL vieja sigue funcionando.
export default function EntregasLegacyPage() {
  redirect("/entregas");
}
