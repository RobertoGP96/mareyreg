import { SettingsPageHeader } from "../_components/settings-page-header";
import { SecurityClient } from "./security-client";

export default function SecuritySettingsPage() {
  return (
    <>
      <SettingsPageHeader
        badge="Cuenta"
        title="Seguridad"
        subtitle="Contraseña, autenticación de dos factores y sesiones activas."
      />
      <SecurityClient />
    </>
  );
}
