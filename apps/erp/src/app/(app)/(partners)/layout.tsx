import { requireModule } from "@/lib/auth-guard";

export default async function PartnersLayout({ children }: { children: React.ReactNode }) {
  await requireModule("partners");
  return <>{children}</>;
}
