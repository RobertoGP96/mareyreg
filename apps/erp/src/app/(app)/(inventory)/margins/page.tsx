export const dynamic = "force-dynamic";

import { getMarginReport } from "@/modules/inventory/queries/margin-report-queries";
import { getWarehouses } from "@/modules/inventory/queries/warehouse-queries";
import { MarginReportClient } from "@/modules/inventory/components/margin-report-client";

interface Props {
  searchParams: Promise<{ warehouseId?: string; onlyWarnings?: string }>;
}

export default async function MarginsPage({ searchParams }: Props) {
  const sp = await searchParams;
  const warehouseId = sp.warehouseId ? Number(sp.warehouseId) : undefined;
  const onlyWarnings = sp.onlyWarnings === "1";

  const [report, warehouses] = await Promise.all([
    getMarginReport({ warehouseId, onlyWarnings }),
    getWarehouses(),
  ]);

  return (
    <div className="space-y-4">
      <MarginReportClient
        rows={report.rows}
        summary={report.summary}
        warehouses={warehouses.map((w) => ({ warehouseId: w.warehouseId, name: w.name }))}
        selectedWarehouseId={warehouseId ?? null}
        onlyWarnings={onlyWarnings}
      />
    </div>
  );
}
