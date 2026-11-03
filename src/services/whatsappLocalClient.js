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

// Cache mínimo de mensagens enviadas — necessário para Baileys processar
// retransmissões do WhatsApp sem descartar mensagens silenciosamente.
const msgCache = new Map();

/**
 * Extrai texto da mensagem do Baileys tratando wrappers de mensagem
 * (ephemeralMessage, viewOnce, quoted message, etc.)
 */
function extractMessageText(message) {
  if (!message) return '';
  let m = message;
  while (m && (m.ephemeralMessage || m.viewOnceMessage || m.viewOnceMessageV2 || m.documentWithCaptionMessage)) {
    m = m.ephemeralMessage?.message ||
      m.viewOnceMessage?.message ||
      m.viewOnceMessageV2?.message ||
      m.documentWithCaptionMessage?.message ||
      m;
  }

  return (
    m?.conversation ||
    m?.extendedTextMessage?.text ||
    m?.imageMessage?.caption ||
    m?.videoMessage?.caption ||
    m?.buttonsResponseMessage?.selectedButtonId ||
    m?.listResponseMessage?.singleSelectReply?.selectedRowId ||
    m?.templateButtonReplyMessage?.selectedId ||
    ''
  ).trim();
}

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
  } catch { }

  const logger = pino({ level: 'silent' });

  sock = makeWASocket({
    version,
    logger,
    printQRInTerminal: false, // Controlamos a exibição manualmente para layout limpo
    auth: state,
    browser: ['Equilibra Pesquisas', 'Chrome', '1.0.0'],
    syncFullHistory: false,
    keepAliveIntervalMs: 25000,
    defaultQueryTimeoutMs: 60000,
    markOnlineOnConnect: true,
    // CRÍTICO: getMessage deve retornar a mensagem ou undefined se não encontrada
    getMessage: async (key) => {
      const cached = msgCache.get(key.id);
      return cached || undefined;
    }
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
        } catch { }
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

      try {
        await sock.sendPresenceUpdate('available');
      } catch { }
    }
  });

  // Escuta mensagens recebidas dos colaboradores em tempo real
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (!messages || !Array.isArray(messages)) return;

    console.log(`📥 [WhatsApp] messages.upsert type="${type}" count=${messages.length}`);

    for (const msg of messages) {
      // Ignora mensagens enviadas pelo próprio bot ou de grupos (@g.us) / status
      if (msg.key?.fromMe) continue;
      const rawRemoteJid = msg.key?.remoteJid || '';
      if (!rawRemoteJid || rawRemoteJid.endsWith('@g.us') || rawRemoteJid === 'status@broadcast') continue;

      // Limpa JID removendo sufixo de device (:1@s.whatsapp.net -> @s.whatsapp.net ou :1@lid -> @lid)
      const cleanJid = rawRemoteJid.replace(/:\d+@/, '@');
      if (!cleanJid.endsWith('@s.whatsapp.net') && !cleanJid.endsWith('@lid')) continue;

      // Se for @lid, tenta obter o número de telefone (PN) correspondente do repositório Baileys
      let resolvedPn = null;
      if (cleanJid.endsWith('@lid')) {
        try {
          resolvedPn = sock.signalRepository?.lidMapping?.getPNForLID?.(cleanJid);
        } catch { }
      }

      // Log de diagnóstico — mostra estrutura da mensagem para depuração
      const msgType = msg.message ? Object.keys(msg.message)[0] : 'null';
      console.log(`📩 [WhatsApp] Mensagem de ${cleanJid} (PN: ${resolvedPn || 'n/a'}) | tipo: ${msgType}`);

      const text = extractMessageText(msg.message);
      if (!text) {
        console.log(`⚠️ [WhatsApp] Texto vazio para mensagem tipo "${msgType}" de ${cleanJid} — ignorando.`);
        continue;
      }

      console.log(`\n💬 [WhatsApp Recebido] De: ${cleanJid} | Mensagem: "${text}"`);

      try {
        const { reply, submitted } = await handleIncomingMessage(
          cleanJid,
          text,
          submitAnswersDirect,
          resolvedPn
        );

        if (reply) {
          console.log(`🤖 [WhatsApp Resposta] Enviando para ${rawRemoteJid}: "${reply.slice(0, 50)}..."`);
          await sock.sendMessage(rawRemoteJid, { text: reply });
          console.log(`✅ [WhatsApp Resposta] Enviada com sucesso para ${rawRemoteJid}`);
        } else {
          console.log(`ℹ️ [WhatsApp] Nenhuma resposta gerada para ${cleanJid}.`);
        }

        if (submitted) {
          console.log(`🎉 [WhatsApp] Resposta coletada e armazenada de forma 100% anônima para ${cleanJid}.`);
        }
      } catch (err) {
        console.error('❌ [WhatsApp] Erro ao processar mensagem do colaborador:', err.message);
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
    let targetLid = null;
    try {
      if (typeof sock.onWhatsApp === 'function') {
        const results = await sock.onWhatsApp(jid);
        if (results && results.length > 0 && results[0]?.exists) {
          if (results[0].jid) targetJid = results[0].jid;
          if (results[0].lid) targetLid = results[0].lid;
        }
      }
    } catch { }

    const sent = await sock.sendMessage(targetJid, { text });
    // Armazena no cache para getMessage() do Baileys
    if (sent?.key?.id) {
      msgCache.set(sent.key.id, { conversation: text });
      // Limita tamanho do cache a 200 mensagens
      if (msgCache.size > 200) {
        const firstKey = msgCache.keys().next().value;
        msgCache.delete(firstKey);
      }
    }
    return { ok: true, messageId: sent.key.id, targetJid, targetLid };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}
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

