/**
 * Script de diagnóstico de conexão Supabase
 * Uso: node scripts/test-supabase.js
 */
const path = require('node:path');
const fs = require('node:fs');

// Carrega .env manualmente
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
  console.log('[✓] .env carregado');
}

const { createClient } = require('@supabase/supabase-js');

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

console.log('URL:', url ? url : 'AUSENTE');
console.log('KEY:', key ? key.substring(0, 30) + '...' : 'AUSENTE');

if (!url || !key) {
  console.error('[ERRO] Credenciais ausentes no .env');
  process.exit(1);
}

const sb = createClient(url.trim(), key.trim(), {
  auth: { persistSession: false, autoRefreshToken: false }
});

const TABLES = ['accounts', 'members', 'groups', 'surveys', 'reports', 'invitations', 'responses', 'sessions', 'management', 'evidences'];

async function main() {
  console.log('\n--- Teste de conexão Supabase ---\n');

  for (const table of TABLES) {
    try {
      const start = Date.now();
      const { data, error } = await sb.from(table).select('id').limit(1);
      const ms = Date.now() - start;
      if (error) {
        console.log(`[ERRO] ${table.padEnd(15)} → ${error.message} (code: ${error.code})`);
      } else {
        console.log(`[OK]   ${table.padEnd(15)} → ${(data || []).length} registros amostrados (${ms}ms)`);
      }
    } catch (e) {
      console.log(`[FAIL] ${table.padEnd(15)} → ${e.message}`);
    }
  }

  console.log('\n--- Fim do diagnóstico ---');
  process.exit(0);
}

const timeout = setTimeout(() => {
  console.error('\n[TIMEOUT] Conexão com Supabase excedeu 15 segundos. Verifique se o projeto está pausado.');
  process.exit(2);
}, 15000);
timeout.unref();

main().catch(e => {
  console.error('Erro fatal:', e);
  process.exit(1);
});
