import { requireAuth } from "@/lib/auth-guard";

export default async function ReportingLayout({ children }: { children: React.ReactNode }) {
  await requireAuth();
  return <>{children}</>;
}
