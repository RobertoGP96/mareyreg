export const dynamic = "force-dynamic";

import { getSales, getSalesStats } from "@/modules/pacas/queries/paca-sale-queries";
import { SaleListClient } from "@/modules/pacas/components/sale-list-client";
import { db } from "@/lib/db";

export default async function VentasPage() {
  const [sales, stats, availablePacas] = await Promise.all([
    getSales(),
    getSalesStats(),
    db.paca.findMany({
      where: { status: { in: ["available", "reserved"] } },
      select: { pacaId: true, code: true, salePrice: true },
      orderBy: { code: "asc" },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold font-headline tracking-tight text-primary">Ventas de Pacas</h1>
        <p className="text-muted-foreground mt-1">
          Registro de ventas de pacas de ropa
        </p>
      </div>
      <SaleListClient
        sales={sales as Parameters<typeof SaleListClient>[0]["sales"]}
        availablePacas={availablePacas as Parameters<typeof SaleListClient>[0]["availablePacas"]}
        stats={stats}
      />
    </div>
  );
}
