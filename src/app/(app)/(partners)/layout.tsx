import { requireAuth } from "@/lib/auth-guard";

export default async function PartnersLayout({ children }: { children: React.ReactNode }) {
  await requireAuth();
  return <>{children}</>;
}
