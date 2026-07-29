export const dynamic = "force-dynamic";

import { getRoutes } from "@/modules/logistics/queries/route-queries";
import { RouteListClient } from "@/modules/logistics/components/route-list-client";

export default async function RoutesPage() {
  const routes = await getRoutes();
  return (
    <div className="space-y-4">
      <RouteListClient initialRoutes={routes} />
    </div>
  );
}
