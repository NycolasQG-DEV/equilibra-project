/**
 * Diagnóstico completo de FK constraints + remove a users_admin_id_fkey
 * Execute: node scripts/fix-fk.mjs
 */
import pg from "pg";
import fs from "fs";
import path from "path";

const { Client } = pg;

const envPath = path.join(process.cwd(), ".env");
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, "utf-8").split("\n").forEach((line) => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#") && trimmed.includes("=")) {
      const [key, ...vals] = trimmed.split("=");
      process.env[key.trim()] = vals.join("=").trim();
    }
  });
}

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

await client.connect();

// 1. Listar TODAS as constraints da tabela users
const { rows: allConstraints } = await client.query(`
  SELECT conname AS constraint_name, contype AS type,
         pg_get_constraintdef(oid) AS definition
  FROM pg_constraint
  WHERE conrelid = 'public.users'::regclass
  ORDER BY contype, conname
`);

console.log("\n📋 Todas as constraints de public.users:");
allConstraints.forEach((r) =>
  console.log(`   [${r.type}] ${r.constraint_name}: ${r.definition}`)
);

// 2. Remover a FK users_admin_id_fkey (impede inserção de colaboradores)
const fksToRemove = allConstraints.filter(
  (r) => r.type === "f" && (
    r.constraint_name === "users_admin_id_fkey" ||
    r.constraint_name === "users_id_fkey"
  )
);

if (fksToRemove.length === 0) {
  console.log("\nℹ️  Nenhuma FK problemática encontrada.");
} else {
  for (const fk of fksToRemove) {
    console.log(`\n🔧 Removendo: ${fk.constraint_name}...`);
    await client.query(`ALTER TABLE public.users DROP CONSTRAINT IF EXISTS "${fk.constraint_name}"`);
    console.log(`✅ ${fk.constraint_name} removida!`);
  }
}

// 3. Verificar tabelas relacionadas (survey_assignments, etc.)
const { rows: otherFks } = await client.query(`
  SELECT conname, conrelid::regclass AS table_name, pg_get_constraintdef(oid) AS definition
  FROM pg_constraint
  WHERE contype = 'f'
    AND confrelid = 'public.users'::regclass
  ORDER BY conname
`);

if (otherFks.length > 0) {
  console.log("\n📋 Outras tabelas com FK apontando para public.users:");
  otherFks.forEach((r) =>
    console.log(`   - ${r.table_name}.${r.conname}: ${r.definition}`)
  );
}

await client.end();
console.log("\n🎉 Diagnóstico e correção concluídos.\n");
