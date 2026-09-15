import { neon } from "@neondatabase/serverless";

const raw = process.env.DATABASE_URL;
if (!raw) { console.log("FALTA DATABASE_URL"); process.exit(1); }

// Diagnóstico del formato sin revelar la contraseña.
const url = raw.trim();
const quoted = /^['"]|['"]$/.test(url);
let parsed;
try { parsed = new URL(url.replace(/^['"]|['"]$/g, "")); } catch { parsed = null; }
const info = {
  longitud: url.length,
  comillasSobrantes: quoted,
  empiezaConPsql: /^psql\s/i.test(url),
  esquema: parsed?.protocol ?? "(no se pudo parsear)",
  usuario: parsed?.username ? "sí" : "NO",
  password: parsed?.password ? "sí" : "NO",
  host: parsed?.hostname || "NO",
  baseDeDatos: parsed?.pathname && parsed.pathname !== "/" ? parsed.pathname.slice(1) : "NO",
  sslmode: parsed?.searchParams.get("sslmode") ?? "(sin sslmode)",
};
console.log("Formato de DATABASE_URL:", info);

const t0 = Date.now();
try {
  const sql = neon(url);
  const [v] = await sql`select current_database() as db`;
  console.log(`Conexión OK en ${Date.now() - t0} ms · db=${v.db}`);
  const cols = await sql`select column_name from information_schema.columns where table_name = 'products' and column_name in ('model_group_id','model_label','model_sort_order')`;
  const [tbl] = await sql`select to_regclass('public.webstore_model_groups') as t`;
  const faltan = ["model_group_id", "model_label", "model_sort_order"].filter((c) => !cols.some((r) => r.column_name === c));
  console.log(`Schema grupos de modelos: columnas faltantes en products = ${faltan.length ? faltan.join(", ") : "ninguna"}; tabla webstore_model_groups = ${tbl.t ? "existe" : "NO EXISTE"}`);
  if (faltan.length || !tbl.t) console.log("=> La base NO tiene el schema desplegado: corre pnpm db:push y aplica prisma/sql/webstore-model-groups.sql");
  const [p] = await sql`select count(*)::int as total, count(*) filter (where webstore_enabled and is_active and sku is not null)::int as tienda from products`;
  console.log(`Productos: ${p.total} en total, ${p.tienda} publicados en la tienda`);
  const keys = await sql`select key_prefix, scopes, is_active, expires_at from webstore_api_keys order by api_key_id`;
  console.log("API keys webstore:", keys.length ? keys : "ninguna");
} catch (e) {
  console.log("ERROR de base de datos:", e.message);
  process.exit(1);
}
