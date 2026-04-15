import { requireAuth } from "@/lib/auth-guard";

export default async function PurchasingLayout({ children }: { children: React.ReactNode }) {
  await requireAuth();
  return <>{children}</>;
}
