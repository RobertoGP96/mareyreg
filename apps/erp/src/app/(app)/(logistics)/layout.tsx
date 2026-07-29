import { requireModule } from "@/lib/auth-guard";

export default async function LogisticsLayout({ children }: { children: React.ReactNode }) {
  await requireModule("logistics");
  return <>{children}</>;
}
