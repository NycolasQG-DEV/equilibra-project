/**
 * WhatsApp Persona Engine (Maya) — Equilibra
 *
 * Conduz escuta ativa no WhatsApp com personalidade humanizada, mensagens
 * curtas ("sem enrolação"), memória de contexto, empilhamento inteligente
 * (máx 2 balões) e extração de notas (1 a 5) contextualizadas via Groq AI.
 *
 * Possui fallback gracioso robusto para contingência offline / rate limits.
 */

const ai = require('../integrations/ai');

const MAYA_PERSONA = {
  name: 'Maya',
  role: 'Facilitadora de Escuta e Clima Organizacional (Equilibra)',
  traits: [
    'humana',
    'acolhedora',
    'concisa (estilo WhatsApp)',
    'profissional',
    'objetiva e sem enrolação'
  ],
  maxBubblesPerTurn: 2,
  minTypingDelayMs: 900,
  maxTypingDelayMs: 2400
};

/**
 * Mapeamento rápido de palavras para números (para validação e fallback)
 */
const WORD_MAP = {
  um: 1, uma: 1, one: 1,
  dois: 2, duas: 2, two: 2,
  tres: 3, três: 3, three: 3,
  quatro: 4, four: 4,
  cinco: 5, five: 5,
  '1️⃣': 1, '2️⃣': 2, '3️⃣': 3, '4️⃣': 4, '5️⃣': 5
};

function parseQuickScore(text) {
  if (!text || typeof text !== 'string') return null;
  const clean = text.trim().toLowerCase().replace(/[.,!?*]/g, '');
  const directNum = parseInt(clean, 10);
  if (Number.isInteger(directNum) && directNum >= 1 && directNum <= 5) return directNum;
  if (WORD_MAP[clean]) return WORD_MAP[clean];
  const match = clean.match(/\b([1-5])\b/);
  if (match) return parseInt(match[1], 10);
  for (const [word, val] of Object.entries(WORD_MAP)) {
    if (new RegExp(`\\b${word}\\b`).test(clean)) return val;
  }
  return null;
}

/**
 * Gera mensagem introdutória da Persona (em 2 balões curtos).
 */
function buildPersonaIntro(surveyTitle, instrument) {
  const count = instrument?.factors?.length || 5;
  const timeEst = Math.max(1, Math.ceil(count * 0.4));
  return [
    `Olá! Sou a Maya, da equipe de escuta do Equilibra. 😊`,
    `Sua empresa está realizando a pesquisa de clima:\n*${surveyTitle}*\n\n• Suas respostas são anônimas (nenhum dado pessoal é salvo)\n• Leva cerca de ${timeEst} min (${count} perguntas rápidas)\n\nPodemos começar? Responda *SIM* (ou *NÃO* caso prefira não participar).`
  ];
}

/**
 * Constrói o System Prompt para a Persona com o estado atual da sessão.
 */
function buildSystemPrompt(session) {
  const instrument = session.instrument || {};
  const factors = (instrument.factors || []).map(([key, label, question], idx) => ({
    index: idx + 1,
    key,
    label,
    question,
    score: session.answers[key] !== undefined ? session.answers[key] : null
  }));

  const answered = factors.filter(f => f.score !== null);
  const pending = factors.filter(f => f.score === null);
  const current = pending[0] || null;

  return `Você é a Maya, facilitadora de escuta e bem-estar no trabalho da plataforma Equilibra.
Você está conversando no WhatsApp com um colaborador de uma empresa para coletar a percepção anônima dele sobre as condições de trabalho.

OBJETIVO PRINCIPAL:
Conduzir uma conversa humana, fluida, acolhedora e DIRETA ("sem enrolação") para obter a nota de 1 a 5 para os fatores da pesquisa.

FATORES DA PESQUISA:
${factors.map(f => `- [${f.key}] (Pergunta ${f.index}/${factors.length}) "${f.label}": ${f.question} -> ${f.score !== null ? `Nota: ${f.score}` : 'PENDENTE'}`).join('\n')}

ESTADO ATUAL:
- Fatores já avaliados: ${answered.length} de ${factors.length}
- Fator atual sendo investigado: ${current ? `(Pergunta ${current.index}/${factors.length}) "${current.label}" (${current.question})` : 'NENHUM (todos finalizados)'}
- Fatores restantes: ${pending.length}

REGRAS DE COMUNICAÇÃO NO WHATSAPP (MANDATÓRIAS):
1. TEXTOS CURTOS: Cada mensagem deve ter no máximo 1 a 3 frases curtas e objetivas. NUNCA escreva parágrafos longos ou relatórios.
2. EMPILHAMENTO DE BALÕES:
   - Você pode retornar 1 mensagem ou até 2 mensagens separadas no array "messages".
   - Use 2 balões apenas quando fizer sentido humano (ex.: 1º balão: um acolhimento caloroso em 1 frase; 2º balão: a pergunta contextualizada com o indicador "(Pergunta X/${factors.length})").
3. ESCALA DE NOTAS (1 a 5):
   - 1 = Muito desfavorável / discordo totalmente
   - 2 = Desfavorável / discordo parcialmente
   - 3 = Neutro / regular
   - 4 = Favorável / concordo parcialmente
   - 5 = Muito favorável / concordo totalmente
4. ACOLHIMENTO E ESCUTA ATIVA:
   - Se o colaborador desabafar, reclamar ou der um relato sem nota (ex.: "está muito corrido essa semana"), acolha brevemente em 1 linha empática e logo em seguida peça a nota de 1 a 5 para registrar no termômetro da empresa.
   - Se ele já deu uma nota (ex.: "nota 3", "acho que 4", "dou 2"), confirme de forma calorosa e faça a ponte natural para o próximo fator.
5. FINALIZAÇÃO:
   - No último fator avaliado, encerre com agradecimento caloroso contendo "Obrigado! Sua contribuição é muito importante."
6. LIMITES PROFISSIONAIS:
   - NUNCA dê diagnósticos psicológicos ou conselhos de saúde pessoal. O foco é sempre as condições e rotinas de trabalho.
7. MENSAGENS FORA DE TEMA, ÁUDIOS OU FIGURINHAS:
   - Se o usuário falar de assunto aleatório ou mencionar figurinha/áudio, responda em 1 linha simpática ("Por aqui só consigo ler textos por enquanto! 😊") e retome com delicadeza o fator atual.

FORMATO DE RESPOSTA OBRIGATÓRIO (retorne EXCLUSIVAMENTE um objeto JSON válido, sem tags markdown ou texto fora do JSON):
{
  "extractedScore": number | null,
  "messages": [string],
  "done": boolean
}
- "extractedScore": número inteiro de 1 a 5 caso o usuário tenha fornecido a nota nesta mensagem para o fator atual, ou null caso ele apenas tenha feito um comentário sem nota.
- "messages": array de 1 ou 2 strings curtas prontas para envio no WhatsApp.
- "done": true apenas se este era o último fator e a pesquisa foi totalmente concluída.`;
}

/**
 * Fallback inteligente e humanizado caso o Groq esteja indisponível.
 */
function generateFallbackResponse(session, userText) {
  const factors = session.instrument?.factors || [];
  const currentIndex = session.questionIndex || 0;
  const currentFactor = factors[currentIndex];

  if (!currentFactor) {
    return {
      extractedScore: null,
      messages: ['Pesquisa concluída! Muito obrigado pela sua contribuição com o bem-estar da equipe.'],
      done: true
    };
  }

  const [, label, question] = currentFactor;
  const detectedScore = parseQuickScore(userText);

  // Se o usuário deu uma nota válida
  if (detectedScore !== null) {
    const isLast = currentIndex + 1 >= factors.length;
    if (isLast) {
      return {
        extractedScore: detectedScore,
        messages: [
          `Nota ${detectedScore} registrada com total sigilo!`,
          `Pesquisa concluída! Suas respostas foram salvas com total anonimato.\n\nObrigado! Sua contribuição é muito importante. 🤝`
        ],
        done: true
      };
    }

    const nextIndex = currentIndex + 1;
    const nextFactor = factors[nextIndex];
    const nextLabel = nextFactor[1];
    const nextQuestion = nextFactor[2];

    return {
      extractedScore: detectedScore,
      messages: [
        `Perfeito, nota ${detectedScore} anotada.`,
        `Pensando agora em *${nextLabel}* (Pergunta ${nextIndex + 1}/${factors.length}):\n\n${nextQuestion}\n\n_De 1 a 5, que nota você daria?_`
      ],
      done: false
    };
  }

  // Se o usuário fez um comentário livre sem nota
  return {
    extractedScore: null,
    messages: [
      `Entendo o seu ponto!`,
      `Para a gente registrar certinho no termômetro da empresa (Pergunta ${currentIndex + 1}/${factors.length}) — *${label}*:\n\n${question}\n\n_Que nota de 1 a 5 você daria?_`
    ],
    done: false
  };
}

/**
 * Conduz um turno de conversa com a Persona Maya via Groq AI.
 *
 * @param {object} session
 * @param {string} userText
 * @returns {Promise<{
 *   messages: string[],
 *   done: boolean,
 *   extractedScore: number | null
 * }>}
 */
async function processPersonaTurn(session, userText) {
  // Inicializa histórico na sessão caso não exista
  if (!Array.isArray(session.history)) {
    session.history = [];
  }

  const systemPrompt = buildSystemPrompt(session);

  const messagesPayload = [
    { role: 'system', content: systemPrompt },
    ...session.history.slice(-8), // últimas 8 mensagens para manter agilidade e contexto
    { role: 'user', content: userText }
  ];

  let turnResult = null;

  try {
    const groq = ai.provider();
    const rawAiOutput = await groq.generate(messagesPayload);

    // Tenta extrair JSON da resposta da IA
    const jsonMatch = rawAiOutput.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (Array.isArray(parsed.messages) && parsed.messages.length > 0) {
        // Sanitiza mensagens (máximo 2 balões, textos curtos)
        const cleanMessages = parsed.messages
          .slice(0, MAYA_PERSONA.maxBubblesPerTurn)
          .map(m => String(m).trim())
          .filter(Boolean);

        let validScore = null;
        if (typeof parsed.extractedScore === 'number' && parsed.extractedScore >= 1 && parsed.extractedScore <= 5) {
          validScore = Math.round(parsed.extractedScore);
        } else {
          // Verificação secundária determinística no texto do usuário
          validScore = parseQuickScore(userText);
        }

        turnResult = {
          extractedScore: validScore,
          messages: cleanMessages,
          done: Boolean(parsed.done)
        };
      }
    }
  } catch (err) {
    console.warn(`[WA-PERSONA] Groq indisponível ou erro (${err.message}) — acionando fallback humanizado.`);
  }

  // Fallback caso Groq não retorne ou falhe
  if (!turnResult) {
    turnResult = generateFallbackResponse(session, userText);
  }

  // Atualiza histórico em memória
  session.history.push({ role: 'user', content: userText });
  for (const m of turnResult.messages) {
    session.history.push({ role: 'assistant', content: m });
  }

  return turnResult;
}

module.exports = {
  MAYA_PERSONA,
  buildPersonaIntro,
  buildSystemPrompt,
  parseQuickScore,
  generateFallbackResponse,
  processPersonaTurn
};
