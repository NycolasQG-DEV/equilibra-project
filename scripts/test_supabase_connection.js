/**
 * Teste de Conexão com o Supabase
 * Execução: node scripts/test_supabase_connection.js
 */

const path = require('node:path');
const fs = require('node:fs');

const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) process.loadEnvFile(envPath);

const { getClient, TABLES } = require('../src/config/supabaseClient');

async function testConnection() {
  console.log('='.repeat(60));
  console.log('🔍 TESTANDO CONEXÃO COM O SUPABASE...');
  console.log('='.repeat(60));

  console.log(`URL do Projeto: ${process.env.SUPABASE_URL}`);
  const sb = getClient();

  if (!sb) {
    console.error('❌ Cliente Supabase não configurado. Verifique o .env.');
    process.exit(1);
  }

  console.log('\nVerificando tabelas no Supabase:');
  const missingTables = [];

  for (const table of TABLES) {
    try {
      const { data, error } = await sb.from(table).select('id').limit(1);
      if (error) {
        console.log(`  ❌ Tabela "${table}": NÃO ENCONTRADA (${error.message})`);
        missingTables.push(table);
      } else {
        console.log(`  ✅ Tabela "${table}": CONECTADA E PRONTA!`);
      }
    } catch (err) {
      console.log(`  ❌ Tabela "${table}": ERRO (${err.message})`);
      missingTables.push(table);
    }
  }

  console.log('\n' + '='.repeat(60));
  if (missingTables.length > 0) {
    console.log(`⚠️ ATENÇÃO: ${missingTables.length} tabela(s) ainda não foram criadas no Supabase.`);
    console.log('👉 Execute o script "supabase_schema.sql" no SQL Editor do seu Supabase para criá-las.');
  } else {
    console.log('🎉 TUDO PRONTO! Todas as tabelas do Equilibra estão criadas e respondendo no Supabase!');
  }
  console.log('='.repeat(60));
}

testConnection().catch(console.error);

