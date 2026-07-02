import { requireModule } from "@/lib/auth-guard";

export default async function InventoryLayout({ children }: { children: React.ReactNode }) {
  await requireModule("inventory");
  return <>{children}</>;
}
