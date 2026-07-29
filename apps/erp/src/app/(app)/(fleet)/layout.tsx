import { requireModule } from "@/lib/auth-guard";

export default async function FleetLayout({ children }: { children: React.ReactNode }) {
  await requireModule("logistics");
  return <>{children}</>;
}
