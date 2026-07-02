export const dynamic = "force-dynamic";

import { getEntities } from "@/modules/fleet/queries/entity-queries";
import { EntityListClient } from "@/modules/fleet/components/entity-list-client";

export default async function EntitiesPage() {
  const entities = await getEntities();

  return (
    <div className="space-y-4">
      <EntityListClient initialEntities={entities} />
    </div>
  );
}
