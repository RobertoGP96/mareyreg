import { SettingsPageHeader } from "../_components/settings-page-header";
import { NotificationsClient } from "./notifications-client";

export default function NotificationsSettingsPage() {
  return (
    <>
      <SettingsPageHeader
        badge="Cuenta"
        title="Notificaciones"
        subtitle="Elige qué eventos quieres recibir y por qué canal."
      />
      <NotificationsClient />
    </>
  );
}
