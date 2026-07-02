// Seed inicial de monedas + permiso admin para el módulo envios.
// Uso: `pnpm tsx prisma/seed-envios.ts` tras aplicar el schema.
import "dotenv/config";
import { db } from "../src/lib/db";

const CURRENCIES = [
  { code: "USD", name: "Dólar estadounidense", symbol: "$", decimalPlaces: 2 },
  { code: "USDT", name: "Tether", symbol: "₮", decimalPlaces: 2 },
  { code: "CUP", name: "Peso cubano", symbol: "$", decimalPlaces: 2 },
  { code: "EUR", name: "Euro", symbol: "€", decimalPlaces: 2 },
  { code: "CAN", name: "Dólar canadiense", symbol: "CA$", decimalPlaces: 2 },
];

async function main() {
  for (const c of CURRENCIES) {
    await db.currency.upsert({
      where: { code: c.code },
      update: {},
      create: c,
    });
    console.log(`✓ moneda ${c.code}`);
  }

  const admins = await db.user.findMany({ where: { role: "admin" } });
  for (const admin of admins) {
    await db.userModulePermission.upsert({
      where: {
        userId_moduleId_action: {
          userId: admin.userId,
          moduleId: "envios",
          action: "*",
        },
      },
      update: {},
      create: { userId: admin.userId, moduleId: "envios", action: "*" },
    });
    console.log(`✓ permiso envios → ${admin.email}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
