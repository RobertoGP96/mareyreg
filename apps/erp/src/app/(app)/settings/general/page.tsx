import { SettingsPageHeader } from "../_components/settings-page-header";
import { GeneralForm } from "./general-form";
import { getCompany } from "@/modules/settings/queries/company-queries";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function GeneralSettingsPage() {
  const session = await auth();
  const isAdmin = session?.user?.role === "admin";
  const company = await getCompany();

  return (
    <>
      <SettingsPageHeader
        badge="Empresa"
        title="General"
        subtitle="Información de la empresa, zona horaria y preferencias del sistema."
      />
      <GeneralForm initial={company} canEdit={isAdmin} />
    </>
  );
}
