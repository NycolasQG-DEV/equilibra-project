/**
 * Cria a tabela evidences diretamente via supabase-js (service_role).
 * A service_role key tem acesso irrestrito ao banco, incluindo DDL via rpc.
 * 
 * Estratégia: chamar RPC exec_sql se existir, ou tentar criar a tabela
 * verificando se já existe via uma query simples.
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

const { createClient } = require('@supabase/supabase-js');

const url = (process.env.SUPABASE_URL || '').trim();
const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || '').trim();

if (!url || !serviceKey) {
  console.error('[ERRO] Credenciais ausentes.');
  process.exit(1);
}

const sb = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});

async function main() {
  console.log('Verificando tabela evidences...\n');

  // Tenta SELECT na tabela
  const { error: checkErr } = await sb.from('evidences').select('id').limit(1);

  if (!checkErr) {
    console.log('[OK] Tabela evidences já existe e está acessível.');
    process.exit(0);
  }

  console.log('[INFO] Tabela evidences não encontrada:', checkErr.message);
  console.log('[INFO] Tentando criar via RPC exec_sql...\n');

  // Tenta usar função exec_sql (pode existir em alguns setups)
  const ddl = `
    CREATE TABLE IF NOT EXISTS evidences (
      id text PRIMARY KEY,
      data jsonb NOT NULL,
      created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL,
      updated_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_evidences_account ON evidences ((data->>'accountId'));
    CREATE INDEX IF NOT EXISTS idx_evidences_survey ON evidences ((data->>'surveyId'));
    ALTER TABLE evidences ENABLE ROW LEVEL SECURITY;
  `;

  const { data: rpcData, error: rpcErr } = await sb.rpc('exec_sql', { sql: ddl });

  if (!rpcErr) {
    console.log('[OK] Tabela criada via RPC exec_sql:', rpcData);
  } else {
    console.error('[INFO] RPC exec_sql não disponível:', rpcErr.message);
    console.log('\n========================================');
    console.log('AÇÃO MANUAL NECESSÁRIA:');
    console.log('========================================');
    console.log('Execute o seguinte SQL no Supabase Dashboard:');
    console.log('→ https://supabase.com/dashboard/project/thfribpqnhmnpkgltxnt/sql/new');
    console.log('\n' + ddl);
    console.log('========================================');
    process.exit(1);
  }

  // Verifica se foi criada
  const { error: verifyErr } = await sb.from('evidences').select('id').limit(1);
  if (!verifyErr) {
    console.log('[✓] Tabela evidences criada e verificada com sucesso!');
  } else {
    console.error('[ERRO] Tabela ainda inacessível após criação:', verifyErr.message);
    process.exit(1);
  }
}

main().catch(e => {
  console.error('[FATAL]', e.message);
  process.exit(1);
});
