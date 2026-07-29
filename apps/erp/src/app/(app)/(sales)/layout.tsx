import { requireModule } from "@/lib/auth-guard";

export default async function SalesLayout({ children }: { children: React.ReactNode }) {
  await requireModule("sales");
  return <>{children}</>;
}
