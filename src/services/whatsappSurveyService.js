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
 * Envia a pesquisa para todos os membros com telefone cadastrado via WhatsApp.
 * Chamado internamente por openSurvey() quando channel === 'whatsapp'.
 *
 * @param {object} survey - objeto survey completo (com status 'open')
 * @param {Array}  links  - array de { token, phone, memberId, segmentId, name }
 * @returns {Promise<{ dispatched: number, skipped: number, errors: number }>}
 */
async function dispatchSurveyViaWhatsApp(survey, links) {
  const instrument = surveyInstrument(survey);
  const surveyTitle = survey.title || 'Pesquisa de Clima';

  let dispatched = 0;
  let skipped = 0;
  let errors = 0;

  for (const link of links) {
    // Descriptografar phone apenas para envio — nunca persistir
    const rawPhone = decryptPhone(link.phone);

    if (!rawPhone) {
      skipped++;
      continue; // membro sem telefone
    }

    try {
      // Cria sessão no engine usando waId baseado no phone normalizado
      // O waId é um identificador temporário de sessão, não vinculado às respostas
      const normalizedPhone = gateway.normalizePhone(rawPhone);
      if (!normalizedPhone) {
        skipped++;
        continue;
      }

      const waId = `${normalizedPhone}@s.whatsapp.net`;

      // Se já tem sessão ativa (ex: pesquisa re-enviada), não sobrescreve
      if (engine.hasSession(waId)) {
        skipped++;
        continue;
      }

      const { introMessage } = engine.startSession(
        waId,
        link.token,
        link.segmentId,
        instrument,
        surveyTitle
      );

      // Envia pelo gateway — rawPhone sai de escopo após isso
      const result = await gateway.sendText(rawPhone, introMessage);

      if (result.ok) {
        dispatched++;
        if (result.targetJid && result.targetJid !== waId && !engine.hasSession(result.targetJid)) {
          engine.startSession(result.targetJid, link.token, link.segmentId, instrument, surveyTitle);
        }
      } else {
        // Falha no envio — remove sessão criada para evitar sessão órfã
        engine.processMessage(waId, 'N');
        errors++;
        console.error(`[WA-DISPATCH] Falha ao enviar para membro (sem identificação): ${result.error}`);
      }
    } catch (err) {
      errors++;
      console.error('[WA-DISPATCH] Erro inesperado:', err.message);
    }
  }

  console.log(`[WA-DISPATCH] Pesquisa "${surveyTitle}": ${dispatched} enviados, ${skipped} sem telefone, ${errors} erros.`);
  return { dispatched, skipped, errors };
}

/**
 * Processa uma mensagem recebida de um colaborador via webhook.
 * Retorna a resposta que deve ser enviada de volta.
 *
 * @param {string} waId  - remoteJid do WhatsApp
 * @param {string} text  - texto da mensagem recebida
 * @param {Function} submitAnswers - função para submeter respostas (injetada para testabilidade)
 * @returns {Promise<{ reply: string | null, submitted: boolean }>}
 */
async function handleIncomingMessage(waId, text, submitAnswers) {
  const result = engine.processMessage(waId, text);

  let submitted = false;

  // Quando o engine sinaliza conclusão com token+answers, submete anonimamente
  if (result.done && result.token && result.answers) {
    try {
      await submitAnswers({
        token: result.token,
        answers: result.answers,
        segmentId: result.segmentId
      });
      submitted = true;
    } catch (err) {
      console.error('[WA-SUBMIT] Erro ao submeter respostas:', err.message);
      // Resposta de fallback — mesmo com erro, não re-tentamos para preservar anonimato
      return {
        reply: '✅ Pesquisa finalizada. Obrigado pela participação!',
        submitted: false
      };
    }
  }

  return {
    reply: result.reply,
    submitted
  };
}

module.exports = { dispatchSurveyViaWhatsApp, handleIncomingMessage };

