import { SettingsPageHeader } from "../_components/settings-page-header";
import { NotificationsClient } from "./notifications-client";
import { requireAuth } from "@/lib/auth-guard";
import { getUserNotificationPrefs } from "@/modules/auth/queries/user-queries";

export const dynamic = "force-dynamic";

export default async function NotificationsSettingsPage() {
  const session = await requireAuth();
  const initialPrefs = await getUserNotificationPrefs(session.user.userId);

  return (
    <>
      <SettingsPageHeader
        badge="Cuenta"
        title="Notificaciones"
        subtitle="Elige qué eventos quieres recibir y por qué canal."
      />
      <NotificationsClient initialPrefs={initialPrefs} />
    </>
  );
}
