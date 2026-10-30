/**
 * WhatsApp Gateway Client
 * Adapter HTTP para Evolution API (self-hosted) ou qualquer gateway
 * compatível com REST que aceite envio de texto e devolva webhooks.
 *
 * Variáveis de ambiente:
 *   WA_GATEWAY_URL   — URL base do gateway (ex: http://localhost:8080)
 *   WA_GATEWAY_KEY   — API key do gateway
 *   WA_INSTANCE_NAME — nome da instância no gateway (ex: equilibra)
 *
 * Se WA_GATEWAY_URL não estiver definida, o gateway opera em modo DRY-RUN:
 * todas as chamadas são logadas mas não enviadas.
 */

const DRY_RUN = !process.env.WA_GATEWAY_URL;

/**
 * Formata número de telefone para E.164 sem o sinal +.
 * Aceita: "+55 (11) 98765-4321", "5511987654321", "11987654321"
 * @param {string} raw
 * @returns {string} apenas dígitos, sem +
 */
function normalizePhone(raw) {
  if (!raw || typeof raw !== 'string') return '';
  const digits = raw.replace(/\D/g, '');
  // Brasil: adiciona DDI 55 se não tiver e tiver 10-11 dígitos
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return digits;
}

/**
 * Envia uma mensagem de texto para um número WhatsApp.
 * @param {string} phone - número do destinatário (qualquer formato)
 * @param {string} text  - conteúdo da mensagem
 * @returns {Promise<{ ok: boolean, messageId?: string, dryRun?: boolean }>}
 */
async function sendText(phone, text) {
  const normalized = normalizePhone(phone);
  if (!normalized) return { ok: false, error: 'phone_invalid' };

  if (DRY_RUN) {
    console.log(`[WA-DRY-RUN] → ${normalized}: ${text.slice(0, 80)}...`);
    return { ok: true, dryRun: true, phone: normalized };
  }

  const url = process.env.WA_GATEWAY_URL.replace(/\/+$/, '');
  const instance = process.env.WA_INSTANCE_NAME || 'equilibra';
  const key = process.env.WA_GATEWAY_KEY || '';

  let response;
  try {
    response = await fetch(`${url}/message/sendText/${instance}`, {
      method: 'POST',
      signal: AbortSignal.timeout(15000),
      headers: {
        'Content-Type': 'application/json',
        apikey: key
      },
      body: JSON.stringify({
        number: `${normalized}@s.whatsapp.net`,
        text
      })
    });
  } catch (err) {
    console.error('[WA-GATEWAY] Erro de rede ao enviar:', err.message);
    return { ok: false, error: 'network_error' };
  }

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    console.error(`[WA-GATEWAY] Resposta ${response.status}: ${body.slice(0, 200)}`);
    return { ok: false, error: `gateway_${response.status}` };
  }

  const data = await response.json().catch(() => ({}));
  return { ok: true, messageId: data.key?.id || data.id || null };
}

/**
 * Extrai a payload relevante de um webhook POST da Evolution API.
 * Retorna null se não for uma mensagem de texto recebida.
 *
 * @param {object} body - corpo da requisição HTTP do webhook
 * @returns {{ waId: string, phone: string, text: string } | null}
 */
function parseWebhook(body) {
  if (!body || typeof body !== 'object') return null;

  // Evolution API v2 — evento MESSAGES_UPSERT
  const event = body.event || body.type;
  if (event && event !== 'messages.upsert' && event !== 'MESSAGES_UPSERT') return null;

  const msg = body.data?.message || body.message;
  if (!msg) return null;

  // Ignora mensagens enviadas pelo próprio bot
  if (body.data?.key?.fromMe || body.key?.fromMe) return null;

  const remoteJid = body.data?.key?.remoteJid || body.key?.remoteJid || '';
  const phone = remoteJid.replace(/@.+/, '').replace(/\D/g, '');
  const text = (
    msg.conversation ||
    msg.extendedTextMessage?.text ||
    msg.text ||
    ''
  ).trim();

  if (!phone || !text) return null;

  // waId é o remoteJid completo — identificador de sessão no ConversationEngine
  const waId = remoteJid;

  return { waId, phone, text };
}

/**
 * Verifica conectividade com o gateway.
 * @returns {Promise<{ connected: boolean, instance?: string, dryRun?: boolean }>}
 */
async function healthCheck() {
  if (DRY_RUN) return { connected: false, dryRun: true };

  const url = process.env.WA_GATEWAY_URL.replace(/\/+$/, '');
  const instance = process.env.WA_INSTANCE_NAME || 'equilibra';
  const key = process.env.WA_GATEWAY_KEY || '';

  try {
    const response = await fetch(`${url}/instance/fetchInstances`, {
      signal: AbortSignal.timeout(5000),
      headers: { apikey: key }
    });
    if (!response.ok) return { connected: false, status: response.status };
    const data = await response.json().catch(() => []);
    const inst = Array.isArray(data)
      ? data.find((i) => i.instance?.instanceName === instance)
      : null;
    return {
      connected: inst?.instance?.state === 'open',
      instance: inst?.instance?.instanceName || instance,
      state: inst?.instance?.state || 'unknown'
    };
  } catch (err) {
    return { connected: false, error: err.message };
  }
}

module.exports = { sendText, parseWebhook, healthCheck, normalizePhone };

