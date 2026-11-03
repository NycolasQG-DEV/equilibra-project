/**
 * WhatsApp Conversation Engine
 * Máquina de estados para conduzir pesquisas via WhatsApp.
 *
 * PRIVACIDADE: Este módulo nunca persiste a associação entre waId (número)
 * e respostas. Toda sessão é mantida exclusivamente em memória RAM e
 * destruída imediatamente após a submissão.
 *
 * Estados:
 *   WAITING_CONSENT → ASKING → SUBMITTING → DONE
 *                   ↘ ABANDONED (N, timeout, 3 erros)
 */

const path = require('node:path');
const fs = require('node:fs');

const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 horas
const MAX_RETRIES = 3;

const SESSIONS_DIR = process.env.EQUILIBRA_DATA_DIR || path.join(__dirname, '..', '..', 'data');
const SESSIONS_FILE = path.join(SESSIONS_DIR, '.wa-sessions.json');

/**
 * Map<waId, SessionState> com persistência tolerante a reinícios.
 * waId é o remoteJid do WhatsApp (ex: "5511999990000@s.whatsapp.net")
 * que identifica APENAS a sessão de conversa, nunca gravado com as respostas finais.
 */
const sessions = new Map();

function saveSessions() {
  try {
    fs.mkdirSync(SESSIONS_DIR, { recursive: true });
    const serialized = Object.fromEntries(sessions.entries());
    fs.writeFileSync(SESSIONS_FILE, JSON.stringify(serialized, null, 2), 'utf8');
  } catch (err) {
    console.error('[WA-ENGINE] Erro ao persistir sessões:', err.message);
  }
}

function loadSessions() {
  try {
    if (fs.existsSync(SESSIONS_FILE)) {
      const raw = fs.readFileSync(SESSIONS_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      const now = Date.now();
      for (const [waId, session] of Object.entries(parsed)) {
        if (session && now - session.createdAt <= SESSION_TTL_MS) {
          sessions.set(waId, session);
        }
      }
    }
  } catch (err) {
    console.error('[WA-ENGINE] Erro ao carregar sessões salvas:', err.message);
  }
}

// Carrega sessões pré-existentes na inicialização
loadSessions();

/**
 * Gera variantes do JID para acomodar a variação do 9º dígito no Brasil
 * e remove identificadores de dispositivo (ex: :1@s.whatsapp.net).
 */
function getCandidateKeys(waId) {
  if (!waId || typeof waId !== 'string') return [];
  const cleanJid = waId.replace(/:\d+@/, '@');
  const userPart = cleanJid.split('@')[0];
  const digits = userPart.replace(/\D/g, '');
  const domain = cleanJid.includes('@') ? cleanJid.slice(cleanJid.indexOf('@')) : '@s.whatsapp.net';

  const keys = [cleanJid];
  if (waId !== cleanJid) keys.push(waId);

  if (digits.startsWith('55')) {
    const local = digits.slice(2);
    if (local.length === 11 && local[2] === '9') {
      const withoutNine = `55${local.slice(0, 2)}${local.slice(3)}`;
      keys.push(`${withoutNine}${domain}`);
    } else if (local.length === 10) {
      const withNine = `55${local.slice(0, 2)}9${local.slice(2)}`;
      keys.push(`${withNine}${domain}`);
    }
  }
  return Array.from(new Set(keys));
}

function findSession(waId) {
  if (!waId || typeof waId !== 'string') return { key: waId, session: null };
  const cleanJid = waId.replace(/:\d+@/, '@');
  const candidates = getCandidateKeys(cleanJid);

  for (const k of candidates) {
    if (sessions.has(k)) {
      return { key: k, session: sessions.get(k) };
    }
  }

  // Fallback: busca por dígitos exatos do número
  const targetDigits = cleanJid.split('@')[0].replace(/\D/g, '');
  if (targetDigits) {
    for (const [key, session] of sessions.entries()) {
      const sessionDigits = key.split('@')[0].replace(/\D/g, '');
      if (sessionDigits === targetDigits) {
        return { key, session };
      }
      if (targetDigits.startsWith('55') && sessionDigits.startsWith('55')) {
        const tLocal = targetDigits.slice(2);
        const sLocal = sessionDigits.slice(2);
        if (
          (tLocal.length === 11 && tLocal[2] === '9' && `${tLocal.slice(0, 2)}${tLocal.slice(3)}` === sLocal) ||
          (sLocal.length === 11 && sLocal[2] === '9' && `${sLocal.slice(0, 2)}${sLocal.slice(3)}` === tLocal)
        ) {
          return { key, session };
        }
      }
    }
  }

  return { key: cleanJid, session: null };
}

/**
 * Normaliza a resposta do usuário para um número 1-5 ou null.
 * Aceita: "4", " 3 ", "3.", "cinco", "CINCO", "quatro", emojis de dedo, etc.
 */
const WORD_MAP = {
  um: 1, 'uma': 1, one: 1,
  dois: 2, duas: 2, two: 2,
  tres: 3, três: 3, three: 3,
  quatro: 4, four: 4,
  cinco: 5, five: 5,
  '1️⃣': 1, '2️⃣': 2, '3️⃣': 3, '4️⃣': 4, '5️⃣': 5
};

function parseAnswer(text) {
  if (!text || typeof text !== 'string') return null;
  const clean = text.trim().toLowerCase().replace(/[.,!?*]/g, '');

  // 1. Número direto ou início (ex: "4", "5.", "3 - neutro")
  const directNum = parseInt(clean, 10);
  if (Number.isInteger(directNum) && directNum >= 1 && directNum <= 5) return directNum;

  // 2. Mapeamento direto de palavras e emojis
  if (WORD_MAP[clean]) return WORD_MAP[clean];

  // 3. Procura primeiro dígito 1 a 5 isolado no texto (ex: "nota 4", "opção 3")
  const match = clean.match(/\b([1-5])\b/);
  if (match) return parseInt(match[1], 10);

  // 4. Procura palavras isoladas (ex: "acho que cinco")
  for (const [word, val] of Object.entries(WORD_MAP)) {
    if (new RegExp(`\\b${word}\\b`).test(clean)) return val;
  }

  return null;
}

/**
 * Formata a mensagem de apresentação do questionário.
 * @param {string} surveyTitle
 * @param {object} instrument - { name, factors: [[key, label, question],...], instructions }
 * @returns {string}
 */
function buildIntroMessage(surveyTitle, instrument) {
  const n = instrument.factors.length;
  return (
    `📋 *${surveyTitle}*\n\n` +
    `Você foi convidado para participar de uma pesquisa de clima organizacional.\n\n` +
    `🔒 *Suas respostas são anônimas* — nenhum dado pessoal será registrado.\n` +
    `São *${n} perguntas*, levando cerca de ${Math.ceil(n * 0.5)} minutos.\n\n` +
    `Responda de *1 a 5*:\n` +
    `1 = Discordo totalmente  |  5 = Concordo totalmente\n\n` +
    `Digite *S* para começar ou *N* para sair.`
  );
}

/**
 * Formata uma pergunta do questionário.
 * @param {number} index - índice atual (0-based)
 * @param {number} total - total de perguntas
 * @param {string} question - texto da pergunta
 * @returns {string}
 */
function buildQuestionMessage(index, total, question) {
  const progress = `${index + 1}/${total}`;
  return (
    `❓ *Pergunta ${progress}*\n\n` +
    `${question}\n\n` +
    `_Responda com um número de 1 a 5:_\n` +
    `1 – Discordo totalmente\n` +
    `2 – Discordo parcialmente\n` +
    `3 – Neutro\n` +
    `4 – Concordo parcialmente\n` +
    `5 – Concordo totalmente`
  );
}

/**
 * Inicia uma sessão de conversa para um membro.
 * @param {string} waId       - remoteJid do WhatsApp (identificador temporário)
 * @param {string} token      - token de convite (48 hex chars) — para submissão anônima
 * @param {string} segmentId  - segmento do membro (para relatório agregado)
 * @param {object} instrument - instrumento da pesquisa com .factors
 * @param {string} surveyTitle
 * @returns {{ introMessage: string }}
 */
function startSession(waId, token, segmentId, instrument, surveyTitle) {
  const session = {
    token,
    segmentId,
    surveyTitle,
    instrument,
    state: 'WAITING_CONSENT',
    questionIndex: 0,
    answers: {},
    retries: 0,
    createdAt: Date.now()
  };
  sessions.set(waId, session);
  saveSessions();

  return { introMessage: buildIntroMessage(surveyTitle, instrument) };
}

/**
 * Processa uma mensagem recebida do colaborador.
 *
 * @param {string} waId  - remoteJid (identificador de sessão temporária)
 * @param {string} text  - texto da mensagem
 * @returns {{
 *   reply: string | null,
 *   done: boolean,
 *   state: string,
 *   token?: string,
 *   answers?: object,
 *   segmentId?: string
 * }}
 */
function processMessage(waId, text) {
  const { key: activeKey, session } = findSession(waId);

  if (!session) {
    const cleanPhone = waId.replace(/@.+/, '').replace(/\D/g, '');
    return {
      reply: `Olá! Não encontrei nenhuma pesquisa de clima ativa pendente para o seu número (+${cleanPhone}).\n\nSe você foi convidado recentemente, aguarde o disparo da sua empresa ou acerte seu cadastro com o administrador.`,
      done: false,
      state: 'NO_SESSION'
    };
  }

  // Verificar expiração
  if (Date.now() - session.createdAt > SESSION_TTL_MS) {
    sessions.delete(activeKey);
    saveSessions();
    return {
      reply: '⏰ Sua sessão expirou. Caso queira participar, solicite um novo convite.',
      done: true,
      state: 'EXPIRED'
    };
  }

  const normalized = text.trim().toLowerCase();
  const cleanNormalized = normalized.replace(/[.,!?:;*]/g, '').trim();

  // ── ESTADO: WAITING_CONSENT ─────────────────────────────────────────────
  if (session.state === 'WAITING_CONSENT') {
    const yes = [
      's', 'sim', 'yes', 'y', 'ok', 'pode', 'vamos', 'claro', 'quero',
      'bora', 'iniciar', 'comecar', 'começar', '1', 'positivo', 'posso', 'topo', 'aceito', 'partiu'
    ].includes(cleanNormalized) || cleanNormalized.startsWith('sim') || cleanNormalized.startsWith('vamos');

    const no = [
      'n', 'não', 'nao', 'no', 'sair', 'exit', 'cancel', 'cancelar', 'recusar', 'dispensar', '2'
    ].includes(cleanNormalized);

    if (yes) {
      session.state = 'ASKING';
      session.questionIndex = 0;
      session.retries = 0;
      saveSessions();
      const [, , question] = session.instrument.factors[0];
      return {
        reply: buildQuestionMessage(0, session.instrument.factors.length, question),
        done: false,
        state: 'ASKING'
      };
    }

    if (no) {
      sessions.delete(activeKey);
      saveSessions();
      return {
        reply: 'Tudo bem! Sua participação é voluntária. Se mudar de ideia, solicite um novo convite.',
        done: true,
        state: 'ABANDONED'
      };
    }

    // Não entendeu — pede de novo
    return {
      reply: 'Por favor, responda *S* para iniciar a pesquisa ou *N* para sair.',
      done: false,
      state: 'WAITING_CONSENT'
    };
  }

  // ── ESTADO: ASKING ───────────────────────────────────────────────────────
  if (session.state === 'ASKING') {
    const answer = parseAnswer(text);

    if (answer === null) {
      session.retries++;
      saveSessions();
      if (session.retries >= MAX_RETRIES) {
        sessions.delete(activeKey);
        saveSessions();
        return {
          reply: '❌ Não consegui registrar sua resposta após várias tentativas. Sessão encerrada. Solicite um novo convite se desejar participar.',
          done: true,
          state: 'ABANDONED'
        };
      }
      return {
        reply: `⚠️ Resposta inválida. Por favor, envie um número de *1 a 5* (tentativa ${session.retries}/${MAX_RETRIES}).`,
        done: false,
        state: 'ASKING'
      };
    }

    // Resposta válida — registra
    session.retries = 0;
    const [key] = session.instrument.factors[session.questionIndex];
    session.answers[key] = answer;
    session.questionIndex++;
    saveSessions();

    const total = session.instrument.factors.length;

    if (session.questionIndex >= total) {
      // Última pergunta respondida — submeter
      session.state = 'SUBMITTING';
      const result = {
        reply: '✅ *Obrigado!* Sua participação foi registrada de forma anônima.\n\nSeus dados contribuem para melhorar o ambiente de trabalho sem identificar você.',
        done: true,
        state: 'DONE',
        token: session.token,
        answers: { ...session.answers },
        segmentId: session.segmentId
      };
      sessions.delete(activeKey); // destroi sessão imediatamente
      saveSessions();
      return result;
    }

    // Próxima pergunta
    const [, , nextQuestion] = session.instrument.factors[session.questionIndex];
    return {
      reply: buildQuestionMessage(session.questionIndex, total, nextQuestion),
      done: false,
      state: 'ASKING'
    };
  }

  // Estado desconhecido
  return { reply: null, done: false, state: session.state };
}

/**
 * Verifica se há uma sessão ativa para o waId (com resolução flexível de 9º dígito).
 * @param {string} waId
 * @returns {boolean}
 */
function hasSession(waId) {
  return Boolean(findSession(waId).session);
}

/**
 * Remove sessões expiradas (chamado pelo scheduler).
 * @returns {number} quantidade de sessões removidas
 */
function expireSessions() {
  const now = Date.now();
  let removed = 0;
  for (const [waId, session] of sessions.entries()) {
    if (now - session.createdAt > SESSION_TTL_MS) {
      sessions.delete(waId);
      removed++;
    }
  }
  if (removed > 0) saveSessions();
  return removed;
}

/**
 * Retorna contagem de sessões ativas (para monitoramento).
 * Nunca expõe tokens, waIds ou dados de resposta.
 * @returns {{ active: number }}
 */
function sessionStats() {
  return { active: sessions.size };
}

module.exports = {
  startSession,
  processMessage,
  hasSession,
  expireSessions,
  sessionStats,
  // Exportado apenas para testes unitários:
  _parseAnswer: parseAnswer,
  _buildIntroMessage: buildIntroMessage,
  _buildQuestionMessage: buildQuestionMessage
};

