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
const { parseWebhook, sendText, healthCheck } = require('../services/whatsappGateway');
const { handleIncomingMessage } = require('../services/whatsappSurveyService');

const router = express.Router();

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

// ── WEBHOOK: recebe mensagens entrantes ──────────────────────────────────────

router.post('/webhook/whatsapp', verifyWebhookSecret, async (req, res) => {
  // Responde imediatamente para evitar timeout do gateway
  res.status(200).json({ ok: true });

  const parsed = parseWebhook(req.body);
  if (!parsed) return; // evento irrelevante (status update, outgoing, etc.)

  const { waId } = parsed;

  try {
    const { bubbles } = await handleIncomingMessage();
    if (bubbles && bubbles.length > 0) {
      const phone = waId.replace(/@.+/, '');
      await sendText(phone, bubbles[0]);
    }
  } catch (err) {
    console.error('[WA-WEBHOOK] Erro ao processar mensagem:', err.message);
  }
});

// ── HEALTH: status do gateway ────────────────────────────────────────────────

router.get('/webhook/whatsapp/health', async (req, res) => {
  const gwHealth = await healthCheck();
  res.json({
    gateway: gwHealth
  });
});

module.exports = router;

