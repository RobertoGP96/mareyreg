import { SettingsPageHeader } from "../_components/settings-page-header";
import { GeneralForm } from "./general-form";

export default function GeneralSettingsPage() {
  return (
    <>
      <SettingsPageHeader
        badge="Empresa"
        title="General"
        subtitle="Información de la empresa, zona horaria y preferencias del sistema."
      />
      <GeneralForm />
    </>
  );
}
