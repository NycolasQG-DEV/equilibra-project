/**
 * Utilitário de Diagnóstico do Gateway WhatsApp & Motor IA
 * Execução: node scripts/gateway_health.js [--connect] [--test-send <phone> <msg>]
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
  const args = process.argv.slice(2);

  // Se o usuário pedir para conectar diretamente via QR Code por este script
  if (args.includes('--connect')) {
    console.log('='.repeat(64));
    console.log('🔄 INICIANDO CONEXÃO DIRETA COM O WHATSAPP...');
    console.log('='.repeat(64));
    const { initWhatsAppClient } = require('../src/services/whatsappLocalClient');
    await initWhatsAppClient();
    return;
  }

  console.log('='.repeat(64));
  console.log('🩺 DIAGNÓSTICO DO WHATSAPP & MOTOR DE CONVERSAÇÃO');
  console.log('='.repeat(64));

  console.log(`\n[Modo de Operação]`);
  const status = await healthCheck();

  if (status.mode === 'direct_terminal_qr' && status.connected) {
    console.log(`  Tipo          : CONEXÃO DIRETA (WhatsApp Web Terminal)`);
    console.log(`  Status        : ✅ CONECTADO`);
    console.log(`  Número        : +${status.phone} (${status.user})`);
  } else if (status.mode === 'direct_terminal_qr' && !status.connected) {
    console.log(`  Tipo          : CONEXÃO DIRETA (WhatsApp Web Terminal)`);
    console.log(`  Status        : ⏳ AGUARDANDO LEITURA DO QR CODE`);
    console.log(`  Dica          : Execute "npm start" ou "node scripts/gateway_health.js --connect" para ver o QR Code.`);
  } else if (status.connected) {
    console.log(`  Tipo          : GATEWAY REST EXTERNO (Evolution API)`);
    console.log(`  Status        : ✅ CONECTADO (${status.instance || 'Instância ativa'})`);
  } else if (status.dryRun) {
    console.log(`  Tipo          : MODO SIMULAÇÃO (Dry-Run Seguro)`);
    console.log(`  Status        : ℹ️ Ativo (Mensagens são logadas no terminal sem envio externo)`);
    console.log(`  Dica          : Para conectar seu WhatsApp real, rode "npm start" para ver o QR Code.`);
  } else {
    console.log(`  Status        : ❌ DESCONECTADO`);
    console.log(`  Detalhe       : ${status.error || status.status || 'Não conectado'}`);
  }

  console.log(`\n[Motor de Conversação (RAM)]`);
  const stats = sessionStats();
  console.log(`  Sessões ativas em memória : ${stats.active}`);
  const cleared = expireSessions();
  console.log(`  Sessões expiradas limpas  : ${cleared}`);

  // Teste de envio opcional se passado na linha de comando
  const testSendIdx = args.indexOf('--test-send');
  if (testSendIdx !== -1 && args[testSendIdx + 1]) {
    const phone = args[testSendIdx + 1];
    const msg = args[testSendIdx + 2] || 'Olá! Teste de conectividade do Equilibra via WhatsApp.';
    console.log(`\n[Teste de Disparo]`);
    console.log(`  Destino : ${normalizePhone(phone)}`);
    console.log(`  Mensagem: "${msg}"`);
    const sendResult = await sendText(phone, msg);
    console.log('  Resultado:', sendResult);
  }

  console.log('\n' + '='.repeat(64));
}

main().catch((err) => {
  console.error('[ERRO FATAL]', err);
  process.exit(1);
});
