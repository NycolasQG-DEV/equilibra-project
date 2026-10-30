/**
 * WhatsApp Gateway Client
 * Suporta:
 * 1. Conexão Direta Nativa (QR Code no Terminal com Baileys)
 * 2. Evolution API (self-hosted REST)
 * 3. Modo DRY-RUN (simulação segura se nenhum dos anteriores estiver ativo)
 */

function getLocalClient() {
  try {
    return require('./whatsappLocalClient');
  } catch {
    return null;
  }
}

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
 * Prioridade: 1) Conexão Direta (QR Code) 2) Gateway REST 3) DRY-RUN
 *
 * @param {string} phone - número do destinatário (qualquer formato)
 * @param {string} text  - conteúdo da mensagem
 * @returns {Promise<{ ok: boolean, messageId?: string, dryRun?: boolean, channel?: string }>}
 */
async function sendText(phone, text) {
  const normalized = normalizePhone(phone);
  if (!normalized) return { ok: false, error: 'phone_invalid' };

  // 1. Tenta envio pelo cliente direto (conectado via QR Code no terminal)
  const client = getLocalClient();
  if (client) {
    const localStatus = client.getStatus();
    if (localStatus.connected) {
      const res = await client.sendDirect(normalized, text);
      if (res.ok) {
        return { ok: true, channel: 'direct_terminal_qr', messageId: res.messageId };
      }
      console.warn(`[WA-DIRECT] Falha ao enviar diretamente: ${res.error}. Tentando fallback...`);
    }
  }

  // 2. Tenta gateway REST externo se configurado
  if (!DRY_RUN) {
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
    return { ok: true, channel: 'rest_gateway', messageId: data.key?.id || data.id || null };
  }

  // 3. Fallback: Modo DRY-RUN (simulação)
  if (process.env.NODE_ENV === 'production') {
    const client = getLocalClient();
    const localStatus = client ? client.getStatus() : null;
    if (!localStatus || !localStatus.connected) {
      console.warn(`[WA-GATEWAY] Falha: WhatsApp não está conectado em produção para enviar para ${normalized}.`);
      return { ok: false, error: 'whatsapp_not_connected', message: 'Aparelho WhatsApp não está conectado. Escaneie o QR Code em /wa/connect para ativar os envios.' };
    }
  }
  console.log(`[WA-DRY-RUN] → ${normalized}: ${text.slice(0, 80)}...`);
  return { ok: true, dryRun: true, phone: normalized };
}

/**
 * Extrai a payload relevante de um webhook POST da Evolution API (caso usada).
 */
function parseWebhook(body) {
  if (!body || typeof body !== 'object') return null;

  const event = body.event || body.type;
  if (event && event !== 'messages.upsert' && event !== 'MESSAGES_UPSERT') return null;

  const msg = body.data?.message || body.message;
  if (!msg) return null;

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
  const waId = remoteJid;

  return { waId, phone, text };
}

/**
 * Verifica conectividade do WhatsApp (local Baileys ou Gateway REST).
 */
async function healthCheck() {
  // Verifica cliente direto (QR Code)
  const client = getLocalClient();
  if (client) {
    const localStatus = client.getStatus();
    if (localStatus.connected) {
      const phone = localStatus.user?.id ? localStatus.user.id.split(':')[0] : 'Conectado';
      return {
        connected: true,
        mode: 'direct_terminal_qr',
        phone,
        user: localStatus.user?.name || 'Equilibra',
        state: 'open'
      };
    }
    if (localStatus.connecting) {
      return {
        connected: false,
        mode: 'direct_terminal_qr',
        state: 'connecting',
        waitingQr: Boolean(localStatus.lastQr)
      };
    }
  }

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
