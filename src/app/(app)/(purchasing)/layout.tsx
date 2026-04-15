import { requireModule } from "@/lib/auth-guard";

export default async function PurchasingLayout({ children }: { children: React.ReactNode }) {
  await requireModule("purchasing");
  return <>{children}</>;
}
