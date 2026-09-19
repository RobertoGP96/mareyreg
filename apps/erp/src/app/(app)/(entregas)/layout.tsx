import { requireModule } from "@/lib/auth-guard";

export default async function EntregasLayout({ children }: { children: React.ReactNode }) {
  await requireModule("entregas");
  return <>{children}</>;
}
