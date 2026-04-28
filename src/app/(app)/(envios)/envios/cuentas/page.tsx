import { PageHeader } from "@/components/ui/page-header";
import { Wallet } from "lucide-react";

export default function CuentasPage() {
  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <PageHeader icon={Wallet} title="Cuentas" description="Una cuenta por moneda dentro de cada grupo" />
      <p className="text-muted-foreground text-sm">Lista de cuentas en construcción.</p>
    </div>
  );
}
