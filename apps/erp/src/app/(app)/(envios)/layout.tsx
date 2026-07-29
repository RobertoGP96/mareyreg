import { requireModule } from "@/lib/auth-guard";

export default async function EnviosLayout({ children }: { children: React.ReactNode }) {
  await requireModule("envios");
  return <>{children}</>;
}
