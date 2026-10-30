/**
 * Utilitário de Diagnóstico do Gateway WhatsApp & Motor IA
 * Execução: node scripts/gateway_health.js [--test-send <phone> <msg>]
 */

const path = require('node:path');
const fs = require('node:fs');

const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  process.loadEnvFile(envPath);
}

const { healthCheck, sendText, normalizePhone } = require('../src/services/whatsappGateway');
const { sessionStats, expireSessions } = require('../src/services/whatsappConversationEngine');

async function main() {
  console.log('='.repeat(60));
  console.log('🩺 DIAGNÓSTICO DO GATEWAY WHATSAPP & MOTOR DE CONVERSAÇÃO');
  console.log('='.repeat(60));

  const gwUrl = process.env.WA_GATEWAY_URL || '(não definida — modo DRY-RUN ativo)';
  const instance = process.env.WA_INSTANCE_NAME || 'equilibra';
  const hasKey = Boolean(process.env.WA_GATEWAY_KEY);
  const isDryRun = !process.env.WA_GATEWAY_URL;

  console.log(`\n[Configurações]`);
  console.log(`  Gateway URL   : ${gwUrl}`);
  console.log(`  Instância     : ${instance}`);
  console.log(`  API Key       : ${hasKey ? 'Configurada (***)' : 'Não configurada'}`);
  console.log(`  Modo Operação : ${isDryRun ? 'DRY-RUN (Simulação segura sem disparos)' : 'LIVE (Evolution API)'}`);

  console.log(`\n[Checagem de Saúde do Gateway]`);
  const status = await healthCheck();
  if (status.dryRun) {
    console.log('  Status : MODO SIMULAÇÃO (Dry-Run)');
    console.log('  Detalhe: Mensagens são logadas no console e o fluxo ocorre sem chamar APIs externas.');
  } else if (status.connected) {
    console.log('  Status : CONECTADO');
    console.log(`  Instância ativa: ${status.instance} (${status.state})`);
  } else {
    console.log('  Status : DESCONECTADO OU INDISPONÍVEL');
    console.log(`  Detalhe: ${status.error || status.status || 'Falha de comunicação com gateway'}`);
  }

  console.log(`\n[Motor de Conversação (Memória)]`);
  const stats = sessionStats();
  console.log(`  Sessões ativas em RAM : ${stats.active}`);
  const cleared = expireSessions();
  console.log(`  Sessões expiradas limpas: ${cleared}`);

  // Teste de envio opcional se passado na linha de comando
  const args = process.argv.slice(2);
  const testSendIdx = args.indexOf('--test-send');
  if (testSendIdx !== -1 && args[testSendIdx + 1]) {
    const phone = args[testSendIdx + 1];
    const msg = args[testSendIdx + 2] || 'Olá! Teste de conectividade do Equilibra via WhatsApp.';
    console.log(`\n[Teste de Disparo Manual]`);
    console.log(`  Destino: ${normalizePhone(phone)}`);
    console.log(`  Mensagem: "${msg}"`);
    const sendResult = await sendText(phone, msg);
    console.log('  Resultado:', sendResult);
  }

  console.log('\n' + '='.repeat(60));
}

main().catch((err) => {
  console.error('[ERRO FATAL]', err);
  process.exit(1);
});
