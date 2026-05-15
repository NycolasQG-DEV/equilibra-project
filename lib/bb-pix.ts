/**
 * Banco do Brasil — PIX API Client
 * Documentação: https://developers.bb.com.br/
 *
 * Sandbox: https://api.hm.bb.com.br
 * Produção: https://api.bb.com.br
 */

const BB_SANDBOX = "https://api.hm.bb.com.br";
const BB_PROD = "https://api.bb.com.br";
const BB_OAUTH_SANDBOX = "https://oauth.hm.bb.com.br/oauth/token";
const BB_OAUTH_PROD = "https://oauth.bb.com.br/oauth/token";

function getBaseUrl(): string {
  return process.env.BB_ENVIRONMENT === "production" ? BB_PROD : BB_SANDBOX;
}

function getOAuthUrl(): string {
  return process.env.BB_ENVIRONMENT === "production" ? BB_OAUTH_PROD : BB_OAUTH_SANDBOX;
}

/** Obtém access token via OAuth2 client_credentials */
export async function getBBAccessToken(): Promise<string> {
  const clientId = process.env.BB_CLIENT_ID;
  const clientSecret = process.env.BB_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("BB_CLIENT_ID e BB_CLIENT_SECRET são obrigatórios no .env");
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const res = await fetch(getOAuthUrl(), {
    method: "POST",
    headers: {
      "Authorization": `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials&scope=cob.read cob.write pix.read pix.write",
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Erro OAuth BB: ${res.status} — ${err}`);
  }

  const data = await res.json();
  return data.access_token;
}

/** Gera txid único (32 caracteres alfanuméricos) */
export function generateTxId(): string {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "EQ";
  for (let i = 0; i < 30; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export interface BBPixCharge {
  txid: string;
  status: string;
  location: string;
  brCode?: string;
  qrCodeImage?: string;
}

/** Cria uma cobrança PIX no Banco do Brasil */
export async function createBBPixCharge(params: {
  amount: number;
  description: string;
  txId?: string;
}): Promise<BBPixCharge> {
  const token = await getBBAccessToken();
  const appKey = process.env.BB_APP_KEY;
  const pixKey = process.env.BB_PIX_KEY;

  if (!appKey || !pixKey) {
    throw new Error("BB_APP_KEY e BB_PIX_KEY são obrigatórios no .env");
  }

  const txid = params.txId || generateTxId();
  const baseUrl = getBaseUrl();

  // Criar cobrança
  const res = await fetch(`${baseUrl}/pix/v2/cob/${txid}?gw-dev-app-key=${appKey}`, {
    method: "PUT",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      calendario: { expiracao: 3600 }, // 1 hora
      valor: { original: params.amount.toFixed(2) },
      chave: pixKey,
      solicitacaoPagador: params.description,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Erro ao criar cobrança BB: ${res.status} — ${err}`);
  }

  const charge = await res.json();

  // Buscar QR Code
  let brCode = "";
  let qrCodeImage = "";

  if (charge.location) {
    try {
      const qrRes = await fetch(`${baseUrl}/pix/v2/loc/${charge.loc?.id}/qrcode?gw-dev-app-key=${appKey}`, {
        headers: { "Authorization": `Bearer ${token}` },
      });
      if (qrRes.ok) {
        const qrData = await qrRes.json();
        brCode = qrData.qrcode || "";
        qrCodeImage = qrData.imagemQrcode || "";
      }
    } catch {
      // QR code endpoint may not be available in sandbox
    }
  }

  return {
    txid: charge.txid,
    status: charge.status,
    location: charge.location || "",
    brCode,
    qrCodeImage,
  };
}

/** Consulta status de uma cobrança PIX */
export async function checkBBPixStatus(txid: string): Promise<{
  status: string;
  paid: boolean;
}> {
  const token = await getBBAccessToken();
  const appKey = process.env.BB_APP_KEY;

  if (!appKey) throw new Error("BB_APP_KEY obrigatório.");

  const baseUrl = getBaseUrl();

  const res = await fetch(`${baseUrl}/pix/v2/cob/${txid}?gw-dev-app-key=${appKey}`, {
    headers: { "Authorization": `Bearer ${token}` },
  });

  if (!res.ok) {
    throw new Error(`Erro ao consultar cobrança: ${res.status}`);
  }

  const data = await res.json();

  return {
    status: data.status,
    paid: data.status === "CONCLUIDA",
  };
}
