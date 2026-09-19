// Permiso del módulo entregas. Uso: `pnpm dlx tsx prisma/seed-entregas.ts`
// tras aplicar el schema.
//
// Las entregas vivían dentro de envios: quien hoy tiene permiso `envios`
// recibe también `entregas` para no perder acceso al separar el módulo.
import "dotenv/config";
import { db } from "../src/lib/db";

async function grant(userId: number, email: string) {
  await db.userModulePermission.upsert({
    where: { userId_moduleId_action: { userId, moduleId: "entregas", action: "*" } },
    update: {},
    create: { userId, moduleId: "entregas", action: "*" },
  });
  console.log(`✓ permiso entregas → ${email}`);
}

async function main() {
  const users = await db.user.findMany({
    where: {
      OR: [{ role: "admin" }, { modulePermissions: { some: { moduleId: "envios" } } }],
    },
    select: { userId: true, email: true },
    orderBy: { userId: "asc" },
  });
  for (const u of users) await grant(u.userId, u.email);
  console.log(`${users.length} usuario(s) con acceso a entregas`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
