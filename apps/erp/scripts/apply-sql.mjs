/**
 * Aplica un archivo SQL crudo (prisma/sql/*.sql) contra DATABASE_URL.
 * Sustituye a psql cuando no está instalado; los archivos son idempotentes.
 *
 * Uso (desde apps/erp):
 *   node scripts/apply-sql.mjs prisma/sql/inventory-pieces.sql
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";

neonConfig.webSocketConstructor = ws;

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("❌ Falta DATABASE_URL en .env");
  process.exit(1);
}

const fileArg = process.argv[2];
if (!fileArg) {
  console.error("Uso: node scripts/apply-sql.mjs <ruta-al-archivo.sql>");
  process.exit(1);
}

const sqlPath = resolve(process.cwd(), fileArg);
const sql = readFileSync(sqlPath, "utf8");

const pool = new Pool({ connectionString: DATABASE_URL });
try {
  await pool.query(sql);
  console.log(`✅ Aplicado: ${fileArg}`);
} catch (e) {
  console.error(`❌ Error aplicando ${fileArg}:`, e);
  process.exitCode = 1;
} finally {
  await pool.end();
}
