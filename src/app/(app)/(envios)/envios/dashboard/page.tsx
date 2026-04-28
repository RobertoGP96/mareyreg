import { PageHeader } from "@/components/ui/page-header";
import { HandCoins } from "lucide-react";

export default function EnviosDashboardPage() {
  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <PageHeader
        icon={HandCoins}
        title="Tesorería · Envíos"
        description="SALDO GENERAL por moneda y movimientos recientes"
      />
      <p className="text-muted-foreground text-sm">Dashboard en construcción.</p>
    </div>
  );
}
