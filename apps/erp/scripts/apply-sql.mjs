/**
 * Aplica uno o más archivos SQL crudos (prisma/sql/*.sql) contra DATABASE_URL,
 * en el orden dado y deteniéndose en el primer error.
 * Sustituye a psql cuando no está instalado; los archivos son idempotentes.
 *
 * Uso (desde apps/erp, o desde la raíz vía `pnpm db:sql`):
 *   node scripts/apply-sql.mjs prisma/sql/inventory-pieces.sql
 *   node scripts/apply-sql.mjs prisma/sql/a.sql prisma/sql/b.sql
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

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error("Uso: node scripts/apply-sql.mjs <archivo.sql> [más archivos...]");
  process.exit(1);
}

// Leer todo antes de abrir la conexión: un path mal escrito no debe dejar la
// mitad de la secuencia aplicada.
const scripts = files.map((fileArg) => ({
  fileArg,
  sql: readFileSync(resolve(process.cwd(), fileArg), "utf8"),
}));

const pool = new Pool({ connectionString: DATABASE_URL });
try {
  for (const { fileArg, sql } of scripts) {
    try {
      await pool.query(sql);
      console.log(`✅ Aplicado: ${fileArg}`);
    } catch (e) {
      console.error(`❌ Error aplicando ${fileArg}:`, e);
      process.exitCode = 1;
      break;
    }
  }
} finally {
  await pool.end();
}
