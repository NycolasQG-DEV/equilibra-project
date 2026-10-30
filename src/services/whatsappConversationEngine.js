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

const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 horas
const MAX_RETRIES = 3;

/**
 * Map<waId, SessionState> — NUNCA persistido em disco.
 * waId é o remoteJid do WhatsApp (ex: "5511999990000@s.whatsapp.net")
 * que identifica APENAS a sessão de conversa, não é gravado com as respostas.
 */
const sessions = new Map();

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
  const clean = text.trim().toLowerCase().replace(/[.,!?]/g, '');
  const num = parseInt(clean, 10);
  if (Number.isInteger(num) && num >= 1 && num <= 5) return num;
  return WORD_MAP[clean] || null;
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
  const session = sessions.get(waId);

  if (!session) {
    // Sem sessão ativa — ignora silenciosamente
    return { reply: null, done: false, state: 'NO_SESSION' };
  }

  // Verificar expiração
  if (Date.now() - session.createdAt > SESSION_TTL_MS) {
    sessions.delete(waId);
    return {
      reply: '⏰ Sua sessão expirou. Caso queira participar, solicite um novo convite.',
      done: true,
      state: 'EXPIRED'
    };
  }

  const normalized = text.trim().toLowerCase();

  // ── ESTADO: WAITING_CONSENT ─────────────────────────────────────────────
  if (session.state === 'WAITING_CONSENT') {
    const yes = ['s', 'sim', 'yes', 'y', 'ok', 'pode', 'vamos', 'claro', 'quero'].includes(normalized);
    const no = ['n', 'não', 'nao', 'no', 'sair', 'exit', 'cancel', 'cancelar'].includes(normalized);

    if (yes) {
      session.state = 'ASKING';
      session.questionIndex = 0;
      session.retries = 0;
      const [, , question] = session.instrument.factors[0];
      return {
        reply: buildQuestionMessage(0, session.instrument.factors.length, question),
        done: false,
        state: 'ASKING'
      };
    }

    if (no) {
      sessions.delete(waId);
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
      if (session.retries >= MAX_RETRIES) {
        sessions.delete(waId);
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
      sessions.delete(waId); // destroi sessão imediatamente
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
 * Verifica se há uma sessão ativa para o waId.
 * @param {string} waId
 * @returns {boolean}
 */
function hasSession(waId) {
  return sessions.has(waId);
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

