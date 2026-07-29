import { requireModule } from "@/lib/auth-guard";

export default async function CurrencyLayout({ children }: { children: React.ReactNode }) {
  await requireModule("currency");
  return <>{children}</>;
}
