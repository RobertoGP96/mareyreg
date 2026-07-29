import "dotenv/config";
import { PrismaClient } from "../generated/prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! });
const db = new PrismaClient({ adapter });

function stripPaca(name: string): string {
  // Case-insensitive removal of the word "paca" / "pacas" as a standalone token.
  return name
    .replace(/\bpacas?\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

const classifications = await db.pacaClassification.findMany();
for (const c of classifications) {
  const next = stripPaca(c.name);
  if (next && next !== c.name) {
    const exists = await db.pacaClassification.findFirst({
      where: { name: next, NOT: { classificationId: c.classificationId } },
    });
    if (exists) {
      console.log(`SKIP classification #${c.classificationId} "${c.name}" -> "${next}" (already exists)`);
      continue;
    }
    await db.pacaClassification.update({
      where: { classificationId: c.classificationId },
      data: { name: next },
    });
    console.log(`classification #${c.classificationId}: "${c.name}" -> "${next}"`);
  }
}

const categories = await db.pacaCategory.findMany();
for (const c of categories) {
  const next = stripPaca(c.name);
  if (next && next !== c.name) {
    const exists = await db.pacaCategory.findFirst({
      where: {
        name: next,
        classificationId: c.classificationId,
        NOT: { categoryId: c.categoryId },
      },
    });
    if (exists) {
      console.log(`SKIP category #${c.categoryId} "${c.name}" -> "${next}" (already exists in same classification)`);
      continue;
    }
    await db.pacaCategory.update({
      where: { categoryId: c.categoryId },
      data: { name: next },
    });
    console.log(`category #${c.categoryId}: "${c.name}" -> "${next}"`);
  }
}

await db.$disconnect();
console.log("Done.");
