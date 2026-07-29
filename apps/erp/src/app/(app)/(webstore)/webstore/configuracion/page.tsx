export const dynamic = "force-dynamic";

import { getWebstoreSettings } from "@/modules/webstore/queries/settings-queries";
import { WebstoreSettingsClient } from "@/modules/webstore/components/webstore-settings-client";

export default async function WebstoreConfigPage() {
  const settings = await getWebstoreSettings();

  return (
    <div className="space-y-4">
      <WebstoreSettingsClient
        configuredWarehouseId={settings.configuredWarehouseId}
        configuredWarehouseInactive={settings.configuredWarehouseInactive}
        effectiveWarehouseName={settings.effectiveWarehouse?.name ?? null}
        warehouses={settings.warehouses}
      />
    </div>
  );
}
