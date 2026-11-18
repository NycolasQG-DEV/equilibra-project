/**
 * Script de execução de migrações pendentes no Supabase.
 * Uso: node scripts/run-migrations.js
 *
 * Requer: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY no .env
 * O Supabase permite executar SQL via o endpoint /rest/v1/rpc com função auxiliar,
 * mas para DDL usamos a Supabase Management API: POST /v1/projects/{ref}/database/query
 */
const path = require('node:path');
const fs = require('node:fs');

// Carrega .env
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    if (!process.env[key]) process.env[key] = val;
  }
}

const url = (process.env.SUPABASE_URL || '').trim();
const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || '').trim();

if (!url || !serviceKey) {
  console.error('[ERRO] SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios.');
  process.exit(1);
}

// Extrai o ref do projeto da URL (ex: thfribpqnhmnpkgltxnt de https://thfribpqnhmnpkgltxnt.supabase.co)
const projectRef = url.replace('https://', '').split('.')[0];
console.log(`[INFO] Project ref: ${projectRef}`);

// Pasta de migrações — executa em ordem
const migrationsDir = path.join(__dirname, '..', 'migrations');
const files = fs.readdirSync(migrationsDir)
  .filter(f => f.endsWith('.sql'))
  .sort();

console.log(`[INFO] Migrações encontradas: ${files.join(', ')}\n`);

async function executeSql(sql, label) {
  // Supabase Management API — executa SQL no banco do projeto
  // Endpoint: https://api.supabase.com/v1/projects/{ref}/database/query
  const managementUrl = `https://api.supabase.com/v1/projects/${projectRef}/database/query`;

  const resp = await fetch(managementUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${serviceKey}`
    },
    body: JSON.stringify({ query: sql })
  });

  const text = await resp.text();
  let parsed;
  try { parsed = JSON.parse(text); } catch { parsed = text; }

  if (!resp.ok) {
    console.error(`[ERRO] ${label} → HTTP ${resp.status}:`, parsed);
    return false;
  }

  console.log(`[OK] ${label} executada com sucesso.`);
  return true;
}

async function main() {
  for (const file of files) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    console.log(`\n--- Executando ${file} ---`);
    const ok = await executeSql(sql, file);
    if (!ok) {
      console.warn(`[AVISO] ${file} pode ter falhado — verifique o Supabase Dashboard.`);
    }
  }
  console.log('\n[INFO] Processo de migrações concluído.');
}

main().catch(e => {
  console.error('[FATAL]', e.message);
  process.exit(1);
});
