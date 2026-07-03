// Genera una API key para la tienda (apps/tienda) y reporta el estado del
// catálogo webstore. La key cruda se muestra UNA sola vez: copiarla a
// apps/tienda/.env.local como WEBSTORE_API_KEY.
//
// Uso (desde apps/erp):
//   pnpm dlx tsx scripts/create-webstore-key.ts               # solo crea la key
//   pnpm dlx tsx scripts/create-webstore-key.ts --enable-all  # además habilita
//                                                             # webstoreEnabled en
//                                                             # todos los productos activos
import "dotenv/config";
import bcrypt from "bcryptjs";
import { db } from "../src/lib/db";
import { generateRawKey, getKeyPrefix } from "../src/modules/webstore/lib/api-key";

async function main() {
  const enableAll = process.argv.includes("--enable-all");

  const totalActive = await db.product.count({ where: { isActive: true } });
  const enabled = await db.product.count({
    where: { isActive: true, webstoreEnabled: true },
  });
  console.log(`productos activos: ${totalActive}`);
  console.log(`productos visibles en la tienda (webstoreEnabled): ${enabled}`);

  if (enableAll) {
    const res = await db.product.updateMany({
      where: { isActive: true, webstoreEnabled: false },
      data: { webstoreEnabled: true },
    });
    console.log(`productos habilitados para la tienda: ${res.count}`);
  } else if (enabled === 0) {
    console.log(
      "AVISO: ningún producto tiene webstoreEnabled — el catálogo de la tienda saldrá vacío.\n" +
        "Habilítalos por producto en el ERP o corre este script con --enable-all."
    );
  }

  const rawKey = generateRawKey();
  const keyHash = await bcrypt.hash(rawKey, 10);
  const key = await db.webstoreApiKey.create({
    data: {
      label: "tienda-local-dev",
      keyHash,
      keyPrefix: getKeyPrefix(rawKey),
      scopes: ["read_catalog", "create_orders", "manage_customers"],
    },
  });
  console.log(`\nAPI key creada (id ${key.apiKeyId}). Cópiala ahora, no se vuelve a mostrar:`);
  console.log(`WEBSTORE_API_KEY='${rawKey}'`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
