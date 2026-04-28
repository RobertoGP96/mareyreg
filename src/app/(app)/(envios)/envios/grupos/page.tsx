import { PageHeader } from "@/components/ui/page-header";
import { Users } from "lucide-react";

export default function GruposPage() {
  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <PageHeader icon={Users} title="Grupos" description="Cada grupo agrupa cuentas por persona o tarea" />
      <p className="text-muted-foreground text-sm">Lista de grupos en construcción.</p>
    </div>
  );
}
