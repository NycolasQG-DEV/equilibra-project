/**
 * Asaas — PIX Payment API Client
 * Docs: https://docs.asaas.com
 *
 * Sandbox: https://sandbox.asaas.com/api/v3
 * Produção: https://api.asaas.com/api/v3
 *
 * Para obter API Key:
 * 1. Crie conta em https://www.asaas.com (sandbox: https://sandbox.asaas.com)
 * 2. Vá em: Configurações > Integrações > Gerar API Key
 */

function getBaseUrl(): string {
  return process.env.ASAAS_ENVIRONMENT === "production"
    ? "https://api.asaas.com/api/v3"
    : "https://sandbox.asaas.com/api/v3";
}

function getHeaders(): Record<string, string> {
  const apiKey = process.env.ASAAS_API_KEY;
  if (!apiKey) throw new Error("ASAAS_API_KEY não configurada no .env");
  return {
    "Content-Type": "application/json",
    "access_token": apiKey,
  };
}

/** Cria ou busca um customer no Asaas */
export async function findOrCreateCustomer(name: string, email: string): Promise<string> {
  const base = getBaseUrl();
  const headers = getHeaders();

  // Tentar encontrar por email
  const searchRes = await fetch(`${base}/customers?email=${encodeURIComponent(email)}`, { headers });
  if (searchRes.ok) {
    const searchData = await searchRes.json();
    if (searchData.data?.length > 0) return searchData.data[0].id;
  }

  // Criar novo
  const createRes = await fetch(`${base}/customers`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      name: name || "Usuário Equilibra",
      email: email || "usuario@equilibra.com",
      notificationDisabled: true,
    }),
  });

  if (!createRes.ok) {
    const err = await createRes.text();
    throw new Error(`Erro ao criar customer Asaas: ${err}`);
  }

  const customer = await createRes.json();
  return customer.id;
}

/** Cria uma cobrança PIX no Asaas */
export async function createAsaasPixPayment(params: {
  customerId: string;
  amount: number;
  description: string;
}): Promise<{
  paymentId: string;
  status: string;
}> {
  const base = getBaseUrl();
  const headers = getHeaders();

  // Data de vencimento: hoje
  const today = new Date().toISOString().split("T")[0];

  const res = await fetch(`${base}/payments`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      customer: params.customerId,
      billingType: "PIX",
      value: params.amount,
      dueDate: today,
      description: params.description,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Erro ao criar cobrança: ${err}`);
  }

  const payment = await res.json();
  return { paymentId: payment.id, status: payment.status };
}

/** Busca QR Code PIX de uma cobrança */
export async function getAsaasPixQrCode(paymentId: string): Promise<{
  encodedImage: string;
  payload: string;
  expirationDate: string;
}> {
  const base = getBaseUrl();
  const headers = getHeaders();

  const res = await fetch(`${base}/payments/${paymentId}/pixQrCode`, { headers });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Erro ao buscar QR Code: ${err}`);
  }

  const data = await res.json();
  return {
    encodedImage: data.encodedImage || "",
    payload: data.payload || "",
    expirationDate: data.expirationDate || "",
  };
}

/** Consulta status de um pagamento */
export async function checkAsaasPaymentStatus(paymentId: string): Promise<{
  status: string;
  paid: boolean;
}> {
  const base = getBaseUrl();
  const headers = getHeaders();

  const res = await fetch(`${base}/payments/${paymentId}`, { headers });

  if (!res.ok) {
    throw new Error(`Erro ao consultar pagamento: ${res.status}`);
  }

  const data = await res.json();
  const paidStatuses = ["CONFIRMED", "RECEIVED", "RECEIVED_IN_CASH"];

  return {
    status: data.status,
    paid: paidStatuses.includes(data.status),
  };
}
