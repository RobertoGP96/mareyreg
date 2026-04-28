import { PageHeader } from "@/components/ui/page-header";
import { LineChart } from "lucide-react";

export default function TasasPage() {
  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <PageHeader icon={LineChart} title="Tasas de cambio" description="Reglas y rangos por par de monedas" />
      <p className="text-muted-foreground text-sm">Configuración de tasas en construcción.</p>
    </div>
  );
}
