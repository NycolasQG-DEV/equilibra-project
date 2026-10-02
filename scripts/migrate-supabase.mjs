/**
 * Script de migração e teste de conexão do Supabase PostgreSQL.
 * Execute com: node scripts/migrate-supabase.mjs
 */
import pg from "pg";
import fs from "fs";
import path from "path";

const { Client } = pg;

// Carregar variáveis do .env
const envPath = path.join(process.cwd(), ".env");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  envContent.split("\n").forEach((line) => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#") && trimmed.includes("=")) {
      const [key, ...values] = trimmed.split("=");
      const val = values.join("=").trim();
      process.env[key.trim()] = val;
    }
  });
}

const dbUrl =
  process.env.DATABASE_URL ||
  (process.env.DB_PASSWORD
    ? `postgresql://postgres.${process.env.SUPABASE_PROJECT_REF || "zimvczdjlvgsyeyyepcq"}:${encodeURIComponent(process.env.DB_PASSWORD)}@aws-0-us-east-1.pooler.supabase.com:6543/postgres`
    : null);

if (!dbUrl) {
  console.error("❌ ERRO: DATABASE_URL ou DB_PASSWORD não configurada no .env.");
  console.log("Configure no arquivo .env:");
  console.log("DATABASE_URL=postgresql://postgres:[SUA_SENHA]@db.zimvczdjlvgsyeyyepcq.supabase.co:5432/postgres");
  process.exit(1);
}

async function run() {
  console.log("⚡ Conectando ao Supabase PostgreSQL...");
  const client = new Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    console.log("✅ Conexão com Supabase PostgreSQL estabelecida!");

    const schemaPath = path.join(process.cwd(), "lib", "db", "supabase-schema.sql");
    if (fs.existsSync(schemaPath)) {
      console.log("📦 Aplicando tabelas e índices (supabase-schema.sql)...");
      const sql = fs.readFileSync(schemaPath, "utf-8");
      await client.query(sql);
      console.log("✅ Tabelas e migrações aplicadas com sucesso no Supabase!");
    }

    const productSchemaPath = path.join(process.cwd(), "lib", "db", "product-schema.sql");
    if (fs.existsSync(productSchemaPath)) {
      await client.query(fs.readFileSync(productSchemaPath, "utf-8"));
      console.log("✅ Módulo de pesquisas aplicado.");
    }

    const { rows: tables } = await client.query(
      "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;"
    );
    console.log("\n📋 Tabelas ativas no Supabase:");
    tables.forEach((r) => console.log(`   - ${r.tablename}`));

    await client.end();
    console.log("\n🎉 Migração para o Supabase concluída com sucesso!");
  } catch (err) {
    console.error("❌ Erro durante a migração:", err.message);
    process.exit(1);
  }
}

run();
