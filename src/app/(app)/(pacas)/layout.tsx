import { requireModule } from "@/lib/auth-guard";

export default async function PacasLayout({ children }: { children: React.ReactNode }) {
  await requireModule("pacas");
  return <>{children}</>;
}
