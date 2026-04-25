import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { ProfileForm } from "./profile-form";
import { SettingsPageHeader } from "../_components/settings-page-header";

export const dynamic = "force-dynamic";

export default async function ProfileSettingsPage() {
  const session = await auth();
  const userId = session?.user?.userId;

  const user = userId
    ? await db.user.findUnique({
        where: { userId },
        select: {
          userId: true,
          email: true,
          fullName: true,
          role: true,
          createdAt: true,
        },
      })
    : null;

  if (!user) {
    return (
      <>
        <SettingsPageHeader
          badge="Cuenta"
          title="Perfil"
          subtitle="Información personal y preferencias de la cuenta."
        />
        <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
          No se pudo cargar el perfil.
        </div>
      </>
    );
  }

  return (
    <>
      <SettingsPageHeader
        badge="Cuenta"
        title="Perfil"
        subtitle="Información personal visible para tu equipo."
      />
      <ProfileForm
        user={{
          fullName: user.fullName,
          email: user.email,
          role: user.role,
          createdAt: user.createdAt.toISOString(),
        }}
      />
    </>
  );
}
