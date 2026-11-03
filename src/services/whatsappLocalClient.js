/**
 * WhatsApp Local Client (Baileys)
 * Conexão direta via WhatsApp Web sem emuladores ou gateways externos.
 * Exibe o QR Code diretamente no terminal para login rápido.
 *
 * Persistência: salva credenciais em data/wa-auth/ para manter conectado
 * após reiniciar o servidor.
 */

const path = require('node:path');
const fs = require('node:fs');
const pino = require('pino');
const qrcode = require('qrcode-terminal');
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion
} = require('@whiskeysockets/baileys');

const { handleIncomingMessage } = require('./whatsappSurveyService');
const { read, writeMany } = require('../config/equilibraStorage');
const { surveyInstrument } = require('../domain/instruments');
const crypto = require('node:crypto');

const HASH = (v) => crypto.createHash('sha256').update(v).digest('hex');

const AUTH_DIR = process.env.EQUILIBRA_WA_AUTH_DIR || path.join(__dirname, '..', '..', 'data', 'wa-auth');

let sock = null;
let status = {
  connected: false,
  connecting: false,
  user: null,
  lastQr: null
};

/**
 * Normaliza número para remoteJid do WhatsApp
 */
function toJid(phone) {
  const digits = String(phone).replace(/\D/g, '');
  const withDdi = (digits.length === 10 || digits.length === 11) ? `55${digits}` : digits;
  return `${withDdi}@s.whatsapp.net`;
}

/**
 * Submissão anônima de respostas ao concluir questionário
 */
async function submitAnswersDirect({ token, answers, segmentId }) {
  const tokenH = HASH(token);
  const invitations = read('invitations');
  let invitation = invitations.find((inv) => inv.tokenHash === tokenH && !inv.used);
  if (!invitation) {
    invitation = invitations.find((inv) => (inv.tokenHash === token || inv.id === token) && !inv.used);
  }

  if (!invitation) {
    throw new Error('Convite inválido ou já utilizado.');
  }

  const surveys = read('surveys');
  const survey = surveys.find((s) => s.id === invitation.surveyId);
  if (!survey || survey.status !== 'open') {
    throw new Error('Pesquisa encerrada.');
  }

  const instrument = surveyInstrument(survey);
  const submittedDay = new Date().toISOString().slice(0, 10);
  const responses = read('responses');

  // Grava resposta anonimizada (apenas valores das notas e segmento)
  const newResponse = {
    id: crypto.randomUUID(),
    accountId: survey.accountId,
    surveyId: survey.id,
    segmentId: invitation.segmentId || segmentId || null,
    submittedDay,
    channel: 'whatsapp_direct',
    answers: Object.fromEntries(instrument.factors.map(([k]) => [k, answers[k]]))
  };

  const insertIndex = Math.floor(Math.random() * (responses.length + 1));
  responses.splice(insertIndex, 0, newResponse);

  invitation.used = true;
  invitation.usedDay = submittedDay;

  writeMany({ responses, invitations });
}

/**
 * Inicia ou reinicia o cliente WhatsApp Baileys
 */
async function initWhatsAppClient() {
  if (status.connecting || status.connected) return sock;

  status.connecting = true;
  fs.mkdirSync(AUTH_DIR, { recursive: true });

  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
  let version = [2, 3000, 1015901307];
  try {
    const v = await fetchLatestBaileysVersion();
    if (v?.version) version = v.version;
  } catch {}

  const logger = pino({ level: 'silent' });

  sock = makeWASocket({
    version,
    logger,
    printQRInTerminal: false, // Controlamos a exibição manualmente para layout limpo
    auth: state,
    browser: ['Equilibra Pesquisas', 'Chrome', '1.0.0'],
    syncFullHistory: false
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      status.lastQr = qr;
      status.connected = false;
      console.log('\n' + '='.repeat(64));
      console.log('📲 CONEXÃO DO WHATSAPP (EQUILIBRA)');
      console.log('Abra o WhatsApp no seu celular:');
      console.log('  → Configurações > Aparelhos Conectados > Conectar um Aparelho');
      console.log('  → Aponte a câmera para o QR Code abaixo:');
      console.log('='.repeat(64));
      qrcode.generate(qr, { small: true });
      console.log('='.repeat(64) + '\n');
    }

    if (connection === 'close') {
      status.connected = false;
      status.connecting = false;
      const shouldReconnect = (lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut;
      const isLoggedOut = (lastDisconnect?.error)?.output?.statusCode === DisconnectReason.loggedOut;

      if (isLoggedOut) {
        console.log('⚠️ [WhatsApp] Sessão encerrada no celular. Limpando credenciais antigas...');
        try {
          fs.rmSync(AUTH_DIR, { recursive: true, force: true });
        } catch {}
        setTimeout(initWhatsAppClient, 2000);
      } else if (shouldReconnect) {
        console.log('🔄 [WhatsApp] Reconectando ao WhatsApp...');
        setTimeout(initWhatsAppClient, 3000);
      }
    } else if (connection === 'open') {
      status.connected = true;
      status.connecting = false;
      status.lastQr = null;
      status.user = sock.user;
      const phone = sock.user?.id ? sock.user.id.split(':')[0] : 'Conectado';
      console.log('\n' + '━'.repeat(64));
      console.log(`✅ [WhatsApp] Conectado com sucesso!`);
      console.log(`   Número: +${phone} (${sock.user?.name || 'Equilibra'})`);
      console.log(`   Pronto para despachar e receber pesquisas.`);
      console.log('━'.repeat(64) + '\n');
    }
  });

  // Escuta mensagens recebidas dos colaboradores
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;

    for (const msg of messages) {
      // Ignora mensagens enviadas pelo próprio bot ou de grupos (@g.us)
      if (msg.key.fromMe) continue;
      const remoteJid = msg.key.remoteJid || '';
      if (!remoteJid.endsWith('@s.whatsapp.net')) continue;

      const text = (
        msg.message?.conversation ||
        msg.message?.extendedTextMessage?.text ||
        ''
      ).trim();

      if (!text) continue;

      try {
        const { reply, submitted } = await handleIncomingMessage(
          remoteJid,
          text,
          submitAnswersDirect
        );

        if (reply) {
          await sock.sendMessage(remoteJid, { text: reply });
        }

        if (submitted) {
          console.log(`[WhatsApp] Resposta coletada e armazenada de forma 100% anônima.`);
        }
      } catch (err) {
        console.error('[WhatsApp] Erro ao processar mensagem do colaborador:', err.message);
      }
    }
  });

  return sock;
}

/**
 * Envia mensagem direta de texto usando o socket do WhatsApp
 */
async function sendDirect(phone, text) {
  if (!status.connected || !sock) {
    return { ok: false, error: 'not_connected' };
  }
  const jid = toJid(phone);
  try {
    let targetJid = jid;
    try {
      if (typeof sock.onWhatsApp === 'function') {
        const results = await sock.onWhatsApp(jid);
        if (results && results.length > 0 && results[0]?.exists && results[0]?.jid) {
          targetJid = results[0].jid;
        }
      }
    } catch {}

    const sent = await sock.sendMessage(targetJid, { text });
    return { ok: true, messageId: sent.key.id, targetJid };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

function getStatus() {
  return { ...status };
}

module.exports = {
  initWhatsAppClient,
  sendDirect,
  getStatus
};

