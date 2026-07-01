import { requireModule } from "@/lib/auth-guard";

export default async function WebstoreLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireModule("webstore");
  return <>{children}</>;
}
