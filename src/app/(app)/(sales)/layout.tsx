import { requireAuth } from "@/lib/auth-guard";

export default async function SalesLayout({ children }: { children: React.ReactNode }) {
  await requireAuth();
  return <>{children}</>;
}
