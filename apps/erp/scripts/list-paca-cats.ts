import "dotenv/config";
import { PrismaClient } from "../generated/prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! });
const db = new PrismaClient({ adapter });

const cats = await db.pacaCategory.findMany({
  orderBy: { categoryId: "asc" },
  include: { classification: true },
});
console.log("--- Categories ---");
for (const c of cats) {
  console.log(`${c.categoryId}\t${c.name}\t[${c.classification?.name ?? "sin clasif"}]`);
}
const cls = await db.pacaClassification.findMany({ orderBy: { classificationId: "asc" } });
console.log("\n--- Classifications ---");
for (const c of cls) {
  console.log(`${c.classificationId}\t${c.name}`);
}
await db.$disconnect();
