// Seed inicial de monedas, denominaciones y permiso admin para el módulo envios.
// Uso: `pnpm tsx prisma/seed-envios.ts` tras aplicar el schema.
import "dotenv/config";
import { db } from "../src/lib/db";

const CURRENCIES = [
  { code: "USD", name: "Dólar estadounidense", symbol: "$", kind: "cash", decimalPlaces: 2 },
  { code: "USDT", name: "Tether", symbol: "₮", kind: "digital", decimalPlaces: 2 },
  { code: "CUP", name: "Peso cubano", symbol: "$", kind: "cash", decimalPlaces: 2 },
  { code: "EUR", name: "Euro", symbol: "€", kind: "cash", decimalPlaces: 2 },
  { code: "CAN", name: "Dólar canadiense", symbol: "CA$", kind: "cash", decimalPlaces: 2 },
] as const;

// En moneda de efectivo el desglose es obligatorio y el monto se deriva de él,
// así que el catálogo DEBE llegar hasta la unidad mínima: si falta, montos como
// 1 250 CUP se vuelven imposibles de registrar.
// Las monedas digitales (USDT) no llevan denominaciones: capturan monto directo.
const DENOMINATIONS: Record<string, number[]> = {
  CUP: [1000, 500, 200, 100, 50, 20, 10, 5, 3, 1],
  USD: [100, 50, 20, 10, 5, 2, 1, 0.5, 0.25, 0.1, 0.05, 0.01],
  EUR: [500, 200, 100, 50, 20, 10, 5, 2, 1, 0.5, 0.2, 0.1, 0.05, 0.02, 0.01],
  CAN: [100, 50, 20, 10, 5, 2, 1, 0.25, 0.1, 0.05],
};

async function main() {
  for (const c of CURRENCIES) {
    // `kind` sí se reafirma en monedas existentes: es dato canónico y las
    // monedas creadas antes de introducir el campo quedaron todas en 'cash'.
    // El resto (nombre, símbolo, decimales) puede haberse ajustado a mano.
    await db.currency.upsert({
      where: { code: c.code },
      update: { kind: c.kind },
      create: c,
    });
    console.log(`✓ moneda ${c.code} (${c.kind})`);
  }

  for (const [code, values] of Object.entries(DENOMINATIONS)) {
    const currency = await db.currency.findUnique({ where: { code } });
    if (!currency || currency.kind === "digital") continue;

    for (const [index, value] of values.entries()) {
      await db.currencyDenomination.upsert({
        where: {
          currencyId_value: { currencyId: currency.currencyId, value },
        },
        update: {},
        create: {
          currencyId: currency.currencyId,
          value,
          sortOrder: index,
        },
      });
    }
    console.log(`✓ ${values.length} denominaciones para ${code}`);
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
