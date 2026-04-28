import { PageHeader } from "@/components/ui/page-header";
import { CircleDollarSign } from "lucide-react";

export default function MonedasPage() {
  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <PageHeader icon={CircleDollarSign} title="Monedas" description="Catálogo de divisas operadas" />
      <p className="text-muted-foreground text-sm">CRUD de monedas en construcción.</p>
    </div>
  );
}
