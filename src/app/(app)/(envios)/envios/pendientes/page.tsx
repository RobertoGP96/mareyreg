import { PageHeader } from "@/components/ui/page-header";
import { Clock } from "lucide-react";

export default function PendientesPage() {
  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <PageHeader icon={Clock} title="Pendientes" description="Operaciones registradas esperando confirmación" />
      <p className="text-muted-foreground text-sm">Cola de pendientes en construcción.</p>
    </div>
  );
}
