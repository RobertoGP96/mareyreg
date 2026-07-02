import { PrismaClient } from '../generated/prisma/client/index.js';
const db = new PrismaClient();
const cats = await db.pacaCategory.findMany({ orderBy: { categoryId: 'asc' } });
console.log('--- Categories ---');
console.log(JSON.stringify(cats, null, 2));
const cls = await db.pacaClassification.findMany({ orderBy: { classificationId: 'asc' } });
console.log('--- Classifications ---');
console.log(JSON.stringify(cls, null, 2));
await db.$disconnect();
