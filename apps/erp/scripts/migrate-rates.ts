/**
 * Migración one-shot del módulo envios:
 *   ExchangeRateRule (con ExchangeRateRange, kind, Account.exchangeRateRuleId 1:1)
 *     →
 *   ExchangeRateRule con minAmount/maxAmount/rate inline + pivot AccountExchangeRateRule (N:M)
 *
 * IMPORTANTE — pre-requisitos:
 *   1. Hacer pg_dump previo de exchange_rate_*, accounts, operations, audit_logs.
 *   2. Probar primero en una rama de Neon (`neon branches create migration-test`) y
 *      apuntar DATABASE_URL a esa rama.
 *
 * Uso:
 *   pnpm dlx tsx scripts/migrate-rates.ts            # dry-run (cuenta, no escribe)
 *   pnpm dlx tsx scripts/migrate-rates.ts --confirm  # aplica la migración
 *
 * Después de --confirm exitoso, correr en orden:
 *   1. pnpm prisma generate
 *   2. pnpm db:push   (debería ser no-op)
 *   3. pnpm dlx tsx scripts/migrate-rates.ts --apply-constraints
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";

neonConfig.webSocketConstructor = ws;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("❌ Falta DATABASE_URL en .env");
  process.exit(1);
}

const args = new Set(process.argv.slice(2));
const CONFIRM = args.has("--confirm");
const APPLY_CONSTRAINTS = args.has("--apply-constraints");
const DRY_RUN = !CONFIRM && !APPLY_CONSTRAINTS;

const projectRoot = resolve(__dirname, "..");
const migrationSqlPath = resolve(projectRoot, "prisma/sql/envios-rates-migration.sql");
const constraintsSqlPath = resolve(projectRoot, "prisma/sql/envios-constraints.sql");

async function main() {
  const pool = new Pool({ connectionString: DATABASE_URL });
  try {
    const client = await pool.connect();
    try {
      // 1. Inspección del estado actual.
      const tablesQ = await client.query<{ table_name: string }>(`
        SELECT table_name FROM information_schema.tables
         WHERE table_schema = current_schema()
           AND table_name IN ('exchange_rate_rules','exchange_rate_ranges','account_exchange_rate_rules','accounts','operations')
      `);
      const tables = new Set(tablesQ.rows.map((r) => r.table_name));
      console.log("📊 Tablas presentes:", [...tables].sort().join(", "));

      const hasOldRanges = tables.has("exchange_rate_ranges");
      const hasNewPivot = tables.has("account_exchange_rate_rules");

      if (!tables.has("exchange_rate_rules")) {
        console.error("❌ No existe la tabla exchange_rate_rules. ¿DB correcta?");
        process.exit(1);
      }

      // Métricas pre-migración.
      const counts = await client.query<{ k: string; v: number }>(`
        SELECT 'rules'      AS k, COUNT(*)::int AS v FROM exchange_rate_rules
        ${hasOldRanges ? `UNION ALL SELECT 'ranges', COUNT(*)::int FROM exchange_rate_ranges` : ""}
        UNION ALL SELECT 'accounts',   COUNT(*)::int FROM accounts
        UNION ALL SELECT 'operations', COUNT(*)::int FROM operations
        ${hasOldRanges ? `UNION ALL SELECT 'accounts_with_rule', COUNT(*)::int FROM accounts WHERE exchange_rate_rule_id IS NOT NULL` : ""}
      `);
      console.log("📈 Conteos:");
      for (const r of counts.rows) console.log(`   ${r.k.padEnd(20)} = ${r.v}`);

      if (APPLY_CONSTRAINTS) {
        await applyConstraints(client);
        return;
      }

      if (!hasOldRanges && hasNewPivot) {
        console.log(
          "✅ La migración ya parece aplicada (no hay exchange_rate_ranges, sí hay pivot).",
        );
        console.log(
          "   Si necesitas reinstalar triggers/constraints, corre con --apply-constraints.",
        );
        return;
      }

      if (!hasOldRanges) {
        console.error(
          "❌ No existe exchange_rate_ranges pero tampoco está la pivot. Estado inconsistente; revisa manualmente.",
        );
        process.exit(1);
      }

      // 2. Validar que el script SQL existe.
      let migrationSql: string;
      try {
        migrationSql = readFileSync(migrationSqlPath, "utf8");
      } catch {
        console.error(`❌ No se pudo leer ${migrationSqlPath}`);
        process.exit(1);
      }

      if (DRY_RUN) {
        console.log("\n🔍 DRY-RUN — no se ha modificado nada.");
        console.log("   Para aplicar: pnpm dlx tsx scripts/migrate-rates.ts --confirm");
        console.log("   Antes de aplicar:");
        console.log("     • pg_dump de exchange_rate_*, accounts, operations, audit_logs");
        console.log("     • Verificar que DATABASE_URL apunta a una rama de Neon de prueba");
        return;
      }

      // 3. Aplicar migración.
      console.log("\n🚀 Aplicando migración...");
      const t0 = Date.now();
      // El script ya envuelve en BEGIN/COMMIT.
      await client.query(migrationSql);
      console.log(`✅ Migración aplicada en ${Date.now() - t0} ms.`);

      // Métricas post-migración.
      const post = await client.query<{ k: string; v: number }>(`
        SELECT 'rules' AS k, COUNT(*)::int AS v FROM exchange_rate_rules
        UNION ALL SELECT 'pivot', COUNT(*)::int FROM account_exchange_rate_rules
        UNION ALL SELECT 'operations_with_rule', COUNT(*)::int FROM operations WHERE exchange_rate_rule_id IS NOT NULL
        UNION ALL SELECT 'audit_remap_fallback', COUNT(*)::int FROM audit_log WHERE action = 'rate_remapped_fallback'
      `);
      console.log("\n📈 Post-migración:");
      for (const r of post.rows) console.log(`   ${r.k.padEnd(22)} = ${r.v}`);

      console.log("\nSiguiente paso:");
      console.log("  1. pnpm prisma generate");
      console.log("  2. pnpm db:push   (debería ser no-op)");
      console.log("  3. pnpm dlx tsx scripts/migrate-rates.ts --apply-constraints");
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
}

async function applyConstraints(client: import("@neondatabase/serverless").PoolClient) {
  let sql: string;
  try {
    sql = readFileSync(constraintsSqlPath, "utf8");
  } catch {
    console.error(`❌ No se pudo leer ${constraintsSqlPath}`);
    process.exit(1);
  }
  console.log("\n🔒 Aplicando constraints + triggers anti-solape...");
  const t0 = Date.now();
  await client.query(sql);
  console.log(`✅ Constraints aplicados en ${Date.now() - t0} ms.`);
}

main().catch((err) => {
  console.error("❌ Error:", err);
  process.exit(1);
});
