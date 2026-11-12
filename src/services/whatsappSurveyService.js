/**
 * WhatsApp Survey Service
 * Orquestra o despacho de pesquisas via WhatsApp.
 *
 * Fluxo:
 *  1. Recebe survey + links (gerados por openSurvey)
 *  2. Para cada link com phone, descriptografa o número
 *  3. Inicia sessão no ConversationEngine (in-memory)
 *  4. Envia mensagem de introdução pelo gateway
 *  5. O ConversationEngine conduz a conversa via webhook
 *
 * PRIVACIDADE:
 *  - O phone descriptografado é usado SOMENTE para chamar gateway.sendText()
 *  - Nunca é registrado em disco nem associado às respostas
 *  - Após sendText(), a variável sai de escopo
 */

const gateway = require('./whatsappGateway');
const engine = require('./whatsappConversationEngine');
const { decryptPhone } = require('../config/identityCrypto');
const { surveyInstrument } = require('../domain/instruments');

/**
 * Template padrão de mensagem para envio via WhatsApp com a tag {link}.
 */
const DEFAULT_INVITE_TEMPLATE = 
  'Olá! O RH convida você a participar da nossa Pesquisa Confidencial de Fatores Psicossociais: {link}\n\n' +
  '🔒 Sua resposta é 100% anônima e leva cerca de 3 minutos. Sua opinião é essencial para a melhoria das condições de trabalho.';

/**
 * Envia a pesquisa para todos os membros com telefone cadastrado via WhatsApp.
 * Envia uma mensagem fixa (com link único confidencial) sem chatbot interativo.
 *
 * @param {object} survey - objeto survey completo (com status 'open')
 * @param {Array}  links  - array de { token, phone, memberId, segmentId, name, link }
 * @param {string} [customTemplate] - template personalizado contendo obrigatoriamente '{link}'
 * @returns {Promise<{ dispatched: number, skipped: number, errors: number }>}
 */
async function dispatchSurveyViaWhatsApp(survey, links, customTemplate = null) {
  const surveyTitle = survey.title || 'Pesquisa de Clima';
  const template = (customTemplate && customTemplate.includes('{link}'))
    ? customTemplate
    : (survey.whatsappMessageTemplate && survey.whatsappMessageTemplate.includes('{link}'))
      ? survey.whatsappMessageTemplate
      : DEFAULT_INVITE_TEMPLATE;

  let dispatched = 0;
  let skipped = 0;
  let errors = 0;

  for (const link of links) {
    const rawPhone = decryptPhone(link.phone);

    if (!rawPhone) {
      skipped++;
      continue;
    }

    try {
      const normalizedPhone = gateway.normalizePhone(rawPhone);
      if (!normalizedPhone) {
        skipped++;
        continue;
      }

      const surveyUrl = link.link || `/responder/${link.token}`;
      const messageToSend = template.replace(/\{link\}/g, surveyUrl);

      const result = await gateway.sendText(rawPhone, messageToSend, survey.accountId);

      if (result.ok) {
        dispatched++;
      } else {
        errors++;
        console.error(`[WA-DISPATCH] Falha ao enviar para membro: ${result.error}`);
      }
    } catch (err) {
      errors++;
      console.error('[WA-DISPATCH] Erro inesperado:', err.message);
    }
  }

  console.log(`[WA-DISPATCH] Pesquisa "${surveyTitle}": ${dispatched} mensagens enviadas, ${skipped} sem telefone, ${errors} erros.`);
  return { dispatched, skipped, errors };
}

/**
 * Processa mensagens recebidas pelo WhatsApp.
 * Se houver sessão iniciada no engine (ex: testes de regressão), conduz o fluxo.
 * Caso contrário (padrão de produção), responde orientando a utilizar o link web seguro.
 *
 * @param {string} waId  - remoteJid do WhatsApp
 * @param {string} text  - texto da mensagem recebida
 * @param {Function} [submitAnswers] - função para submeter respostas
 * @param {string} [resolvedPn] - número de telefone real caso waId seja um @lid
 * @returns {Promise<{ reply: string, bubbles: string[], submitted: boolean }>}
 */
async function handleIncomingMessage(waId, text, submitAnswers = null, resolvedPn = null) {
  if (engine.hasSession(waId) || (resolvedPn && engine.hasSession(resolvedPn))) {
    let result = await engine.processMessage(waId, text);
    if (result.state === 'NO_SESSION' && typeof resolvedPn === 'string' && resolvedPn.length > 0) {
      const pnResult = await engine.processMessage(resolvedPn, text);
      if (pnResult.state !== 'NO_SESSION') {
        result = pnResult;
        engine.addSessionAlias(resolvedPn, waId);
      }
    }

    let submitted = false;
    if (result.done && result.token && result.answers && typeof submitAnswers === 'function') {
      try {
        await submitAnswers({
          token: result.token,
          answers: result.answers,
          segmentId: result.segmentId
        });
        submitted = true;
      } catch (err) {
        console.error('[WA-SUBMIT] Erro ao submeter respostas:', err.message);
        return {
          reply: '✅ Pesquisa finalizada. Obrigado! pela participação!',
          bubbles: ['✅ Pesquisa finalizada. Obrigado! pela participação!'],
          submitted: false
        };
      }
    }

    return {
      reply: result.reply,
      bubbles: result.bubbles || (Array.isArray(result.reply) ? result.reply : (result.reply ? [result.reply] : [])),
      submitted
    };
  }

  const infoReply = 
    'Olá! Este canal é utilizado exclusivamente para o envio de convites de pesquisas.\n\n' +
    'Para responder à pesquisa de forma segura e com anonimato garantido, por favor acesse o link enviado na mensagem anterior. Muito obrigado pela sua participação!';

  return {
    reply: infoReply,
    bubbles: [infoReply],
    submitted: false
  };
}

module.exports = { dispatchSurveyViaWhatsApp, handleIncomingMessage };

