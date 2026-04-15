import { requireModule } from "@/lib/auth-guard";

export default async function ReportingLayout({ children }: { children: React.ReactNode }) {
  await requireModule("reporting");
  return <>{children}</>;
}
