/**
 * WhatsApp Webhook Routes
 * Endpoint público que recebe mensagens entrantes do gateway WhatsApp
 * e orquestra a continuação das conversas de pesquisa.
 *
 * Rota: POST /webhook/whatsapp
 *
 * Autenticação: verificação de X-Webhook-Secret (opcional, mas recomendada em prod).
 * O endpoint é PÚBLICO (sem session cookie) por design — webhook externo.
 */

const express = require('express');
const crypto = require('node:crypto');
const { read, write, writeMany } = require('../config/equilibraStorage');
const { parseWebhook, sendText, healthCheck } = require('../services/whatsappGateway');
const { handleIncomingMessage } = require('../services/whatsappSurveyService');
const { expireSessions, sessionStats } = require('../services/whatsappConversationEngine');
const { surveyInstrument } = require('../domain/instruments');

const router = express.Router();

const hash = (v) => crypto.createHash('sha256').update(v).digest('hex');

/**
 * Verifica o secret do webhook se WA_WEBHOOK_SECRET estiver definido.
 * Implementação tolerante: se a variável não estiver configurada, aceita tudo
 * (para facilitar desenvolvimento local).
 */
function verifyWebhookSecret(req, res, next) {
  const secret = process.env.WA_WEBHOOK_SECRET;
  if (!secret) return next(); // sem verificação em dev

  const provided = req.headers['x-webhook-secret'] || req.headers['x-api-key'] || '';
  if (!provided || provided !== secret) {
    return res.status(403).json({ error: 'Webhook secret inválido.' });
  }
  next();
}

/**
 * Submete respostas anonimamente usando o token do convite.
 * Replica a lógica do POST /responder/:token mas sem HTTP externo.
 *
 * @param {{ token: string, answers: object, segmentId: string }} payload
 */
async function submitAnswersInternal({ token, answers, segmentId }) {
  const tokenH = hash(token);
  const invitations = read('invitations');
  const invitation = invitations.find((inv) => inv.tokenHash === tokenH && !inv.used);

  if (!invitation) {
    throw new Error(`Convite não encontrado ou já usado: ${tokenH.slice(0, 8)}...`);
  }

  const surveys = read('surveys');
  const survey = surveys.find((s) => s.id === invitation.surveyId);

  if (!survey || survey.status !== 'open') {
    throw new Error('Pesquisa encerrada ou não encontrada.');
  }

  const instrument = surveyInstrument(survey);
  const factors = instrument.factors;
  const submittedDay = new Date().toISOString().slice(0, 10);

  // Valida que todas as respostas são 1-5
  const allValid = factors.every(
    ([key]) => Number.isInteger(answers[key]) && answers[key] >= 1 && answers[key] <= 5
  );
  if (!allValid) {
    throw new Error('Respostas inválidas — fora do intervalo 1-5.');
  }

  const responses = read('responses');
  const currentCount = responses.filter((r) => r.surveyId === survey.id).length;
  const maxResponses = survey.memberIds?.length || 0;

  if (currentCount >= maxResponses) {
    throw new Error('Limite de respostas atingido.');
  }

  // Resposta anônima — sem memberId, sem phone, sem qualquer identificador pessoal
  const newResponse = {
    id: crypto.randomUUID(),
    accountId: survey.accountId,
    surveyId: survey.id,
    segmentId: invitation.segmentId || segmentId || null,
    submittedDay,
    channel: 'whatsapp',
    answers: Object.fromEntries(factors.map(([key]) => [key, answers[key]]))
  };

  // Insere em posição aleatória para impedir correlação por ordem
  const insertIndex = Math.floor(Math.random() * (responses.length + 1));
  responses.splice(insertIndex, 0, newResponse);

  // Marca convite como usado (sem revelar identidade)
  const inv = invitations.find((i) => i.id === invitation.id);
  if (inv) {
    inv.used = true;
    inv.usedDay = submittedDay;
  }

  writeMany({ responses, invitations });
}

// ── WEBHOOK: recebe mensagens entrantes ──────────────────────────────────────

router.post('/webhook/whatsapp', verifyWebhookSecret, async (req, res) => {
  // Responde imediatamente para evitar timeout do gateway
  res.status(200).json({ ok: true });

  const parsed = parseWebhook(req.body);
  if (!parsed) return; // evento irrelevante (status update, outgoing, etc.)

  const { waId, text } = parsed;

  try {
    const { reply, bubbles, submitted } = await handleIncomingMessage(
      waId,
      text,
      submitAnswersInternal
    );

    const messagesToSend = bubbles || (Array.isArray(reply) ? reply : (reply ? [reply] : []));
    if (messagesToSend.length > 0) {
      const phone = waId.replace(/@.+/, '');
      for (let i = 0; i < messagesToSend.length; i++) {
        const msgItem = messagesToSend[i];
        if (!msgItem) continue;
        await sendText(phone, msgItem);
        if (i < messagesToSend.length - 1) {
          await new Promise(r => setTimeout(r, 1200));
        }
      }
    }

    if (submitted) {
      console.log('[WA-WEBHOOK] Resposta registrada anonimamente com sucesso.');
    }
  } catch (err) {
    console.error('[WA-WEBHOOK] Erro ao processar mensagem:', err.message);
  }
});

// ── HEALTH: status do gateway e sessões ativas ───────────────────────────────

router.get('/webhook/whatsapp/health', async (req, res) => {
  const gwHealth = await healthCheck();
  const stats = sessionStats();
  // Limpeza de sessões expiradas a cada health check
  const expired = expireSessions();

  res.json({
    gateway: gwHealth,
    sessions: stats,
    expiredCleared: expired
  });
});

module.exports = router;

