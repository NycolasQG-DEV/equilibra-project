/**
 * WhatsApp Local Client (Baileys) — Multi-Tenant & Sessões Privadas por Usuário/Conta
 *
 * Cada conta (accountId) possui sua própria sessão, credenciais isoladas e QR Code privado.
 * O QR Code é exibido EXCLUSIVAMENTE no navegador do administrador autenticado e
 * NUNCA é impresso no terminal público do servidor.
 */

const path = require('node:path');
const fs = require('node:fs');
const pino = require('pino');
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

const AUTH_BASE_DIR = process.env.EQUILIBRA_WA_AUTH_DIR || path.join(__dirname, '..', '..', 'data', 'wa-auth');

/**
 * Mapa de sessões ativas indexadas por accountId.
 * Estrutura de cada sessão:
 * {
 *   accountId: string,
 *   authDir: string,
 *   sock: BaileysSocket | null,
 *   status: { connected: boolean, connecting: boolean, user: object | null, lastQr: string | null },
 *   msgCache: Map
 * }
 */
const sessions = new Map();

function sanitizeAccountId(id) {
  if (!id || typeof id !== 'string') return 'default';
  return id.replace(/[^a-zA-Z0-9_-]/g, '_');
}

function getSession(rawAccountId = 'default') {
  const accountId = sanitizeAccountId(rawAccountId);
  if (!sessions.has(accountId)) {
    const authDir = path.join(AUTH_BASE_DIR, accountId);
    sessions.set(accountId, {
      accountId,
      authDir,
      sock: null,
      status: {
        connected: false,
        connecting: false,
        user: null,
        lastQr: null
      },
      msgCache: new Map()
    });
  }
  return sessions.get(accountId);
}

/**
 * Extrai texto da mensagem do Baileys tratando wrappers de mensagem
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
 * Submete respostas anonimizadas
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
 * Inicia ou reinicia o cliente WhatsApp Baileys para uma conta específica
 * O QR Code NUNCA é impresso no terminal. Fica armazenado na sessão privada.
 */
async function initWhatsAppClient(rawAccountId = 'default') {
  const session = getSession(rawAccountId);

  if (session.status.connecting || session.status.connected) {
    return session.sock;
  }

  session.status.connecting = true;
  fs.mkdirSync(session.authDir, { recursive: true });

  const { state, saveCreds } = await useMultiFileAuthState(session.authDir);
  let version = [2, 3000, 1015901307];
  try {
    const v = await fetchLatestBaileysVersion();
    if (v?.version) version = v.version;
  } catch { }

  const logger = pino({ level: 'silent' });

  const sock = makeWASocket({
    version,
    logger,
    printQRInTerminal: false, // JAMAIS imprime no terminal
    auth: state,
    browser: ['Equilibra Pesquisas', 'Chrome', '1.0.0'],
    syncFullHistory: false,
    keepAliveIntervalMs: 25000,
    defaultQueryTimeoutMs: 60000,
    markOnlineOnConnect: true,
    getMessage: async (key) => {
      const cached = session.msgCache.get(key.id);
      return cached || undefined;
    }
  });

  session.sock = sock;

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      session.status.lastQr = qr;
      session.status.connected = false;
      console.log(`📲 [WhatsApp] Novo QR Code gerado para a conta "${session.accountId}" (disponível no modal privado do operador).`);
    }

    if (connection === 'close') {
      session.status.connected = false;
      session.status.connecting = false;
      const shouldReconnect = (lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut;
      const isLoggedOut = (lastDisconnect?.error)?.output?.statusCode === DisconnectReason.loggedOut;

      if (isLoggedOut) {
        console.log(`⚠️ [WhatsApp] Sessão encerrada no aparelho para a conta "${session.accountId}". Limpando credenciais...`);
        try {
          fs.rmSync(session.authDir, { recursive: true, force: true });
        } catch { }
      } else if (shouldReconnect) {
        console.log(`🔄 [WhatsApp] Reconectando WhatsApp para a conta "${session.accountId}"...`);
        setTimeout(() => initWhatsAppClient(session.accountId), 3000);
      }
    } else if (connection === 'open') {
      session.status.connected = true;
      session.status.connecting = false;
      session.status.lastQr = null;
      session.status.user = sock.user;
      const phone = sock.user?.id ? sock.user.id.split(':')[0] : 'Conectado';
      console.log(`✅ [WhatsApp] Conta "${session.accountId}" conectada com sucesso (+${phone}).`);

      try {
        await sock.sendPresenceUpdate('available');
      } catch { }
    }
  });

  // Escuta mensagens recebidas dos colaboradores em tempo real
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (!messages || !Array.isArray(messages)) return;

    for (const msg of messages) {
      if (msg.key?.fromMe) continue;
      const rawRemoteJid = msg.key?.remoteJid || '';
      if (!rawRemoteJid || rawRemoteJid.endsWith('@g.us') || rawRemoteJid === 'status@broadcast') continue;

      const cleanJid = rawRemoteJid.replace(/:\d+@/, '@');
      if (!cleanJid.endsWith('@s.whatsapp.net') && !cleanJid.endsWith('@lid')) continue;

      const text = extractMessageText(msg.message);
      if (!text) continue;

      try {
        const { reply, bubbles } = await handleIncomingMessage(
          cleanJid,
          text,
          submitAnswersDirect
        );

        const messagesToSend = bubbles || (Array.isArray(reply) ? reply : (reply ? [reply] : []));

        if (messagesToSend.length > 0) {
          for (let i = 0; i < messagesToSend.length; i++) {
            const msgItem = messagesToSend[i];
            if (!msgItem) continue;

            await sock.sendMessage(rawRemoteJid, { text: msgItem });
            if (i < messagesToSend.length - 1) {
              await new Promise(r => setTimeout(r, 800));
            }
          }
        }
      } catch (err) {
        console.error(`❌ [WhatsApp] Erro ao responder mensagem para conta ${session.accountId}:`, err.message);
      }
    }
  });

  return sock;
}

/**
 * Envia mensagem direta de texto usando o socket do WhatsApp de uma conta específica
 */
async function sendDirect(phone, text, rawAccountId = 'default') {
  const session = getSession(rawAccountId);
  if (!session.status.connected || !session.sock) {
    return { ok: false, error: 'not_connected' };
  }

  const sock = session.sock;
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
    if (sent?.key?.id) {
      session.msgCache.set(sent.key.id, { conversation: text });
      if (session.msgCache.size > 200) {
        const firstKey = session.msgCache.keys().next().value;
        session.msgCache.delete(firstKey);
      }
    }
    return { ok: true, messageId: sent.key.id, targetJid, targetLid };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

/**
 * Reseta as credenciais e reinicia o socket para forçar geração de novo QR Code para a conta
 */
async function resetAuth(rawAccountId = 'default') {
  const session = getSession(rawAccountId);
  session.status.connected = false;
  session.status.connecting = false;
  session.status.lastQr = null;
  session.status.user = null;

  try {
    if (session.sock) {
      session.sock.end();
      session.sock = null;
    }
  } catch { }

  try {
    fs.rmSync(session.authDir, { recursive: true, force: true });
    console.log(`🗑️ [WhatsApp] Credenciais da conta "${session.accountId}" resetadas.`);
  } catch { }

  setTimeout(() => {
    initWhatsAppClient(session.accountId).catch((err) => {
      console.error(`[WhatsApp] Falha ao reiniciar conta ${session.accountId} após reset:`, err.message);
    });
  }, 1000);
}

/**
 * Retorna o status de conexão da conta informada
 */
function getStatus(rawAccountId = 'default') {
  const session = getSession(rawAccountId);
  return { ...session.status };
}

/**
 * Retoma silenciosamente sessões que já estavam conectadas antes da reinicialização
 */
function resumeExistingSessions() {
  try {
    if (!fs.existsSync(AUTH_BASE_DIR)) return;
    const entries = fs.readdirSync(AUTH_BASE_DIR, { withFileTypes: true });
    for (const ent of entries) {
      if (ent.isDirectory()) {
        const credsFile = path.join(AUTH_BASE_DIR, ent.name, 'creds.json');
        if (fs.existsSync(credsFile)) {
          console.log(`[WhatsApp] Restaurando sessão salva para a conta "${ent.name}"...`);
          initWhatsAppClient(ent.name).catch((err) => {
            console.error(`[WhatsApp] Falha ao restaurar conta ${ent.name}:`, err.message);
          });
        }
      }
    }
  } catch (err) {
    console.error('[WhatsApp] Erro ao retomar sessões existentes:', err.message);
  }
}

module.exports = {
  initWhatsAppClient,
  sendDirect,
  getStatus,
  resetAuth,
  resumeExistingSessions
};
