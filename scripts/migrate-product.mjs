import fs from "node:fs";
import path from "node:path";
import pg from "pg";

const envPath = path.join(process.cwd(), ".env");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
  }
}

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL não configurada.");
const client = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const schema = fs.readFileSync(path.join(process.cwd(), "lib", "db", "product-schema.sql"), "utf8");
try {
  await client.connect();
  await client.query("BEGIN");
  await client.query(schema);
  const { rows } = await client.query("SELECT to_regclass('public.product_answers') AS table_name");
  if (!rows[0]?.table_name) throw new Error("Tabela de respostas não foi criada.");
  await client.query("COMMIT");
  console.log("Migração de pesquisas aplicada e validada.");
} catch (error) {
  await client.query("ROLLBACK").catch(() => undefined);
  console.error("Migração não concluída:", error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
} finally {
  await client.end().catch(() => undefined);
}
