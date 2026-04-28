import { PageHeader } from "@/components/ui/page-header";
import { ArrowRightLeft } from "lucide-react";

export default function OperacionesPage() {
  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <PageHeader icon={ArrowRightLeft} title="Operaciones" description="Depósitos, retiros, ajustes y transferencias" />
      <p className="text-muted-foreground text-sm">Operaciones en construcción.</p>
    </div>
  );
}
