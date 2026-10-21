const crypto = require("node:crypto");
const { DomainError } = require("../domain/workflow");
function plans() {
  let value;
  try {
    value = process.env.BILLING_PLANS_JSON
      ? JSON.parse(process.env.BILLING_PLANS_JSON)
      : require("../config/plans");
  } catch {
    throw new DomainError("Catálogo de planos inválido no servidor.", 503);
  }
  if (
    !Array.isArray(value) ||
    value.some(
      (plan) =>
        !/^[a-z0-9_-]{1,40}$/.test(plan.id) ||
        typeof plan.name !== "string" ||
        !Number.isSafeInteger(plan.amountCents) ||
        plan.amountCents <= 0 ||
        !Number.isInteger(plan.members) ||
        plan.members < 5 ||
        !Number.isInteger(plan.users) ||
        plan.users < 1 ||
        plan.organizations !== 1,
    ) ||
    new Set(value.map((plan) => plan.id)).size !== value.length
  )
    throw new DomainError(
      "Configure planos válidos; esta versão suporta uma empresa por assinatura.",
      503,
    );
  if (
    value.some(
      (plan) =>
        !Number.isInteger(plan.groups) ||
        plan.groups < 1 ||
        !Number.isInteger(plan.aiMonthly) ||
        plan.aiMonthly < 0,
    )
  )
    throw new DomainError("Limites de grupos e IA inválidos.", 503);
  return value.map(
    ({
      id,
      name,
      amountCents,
      members,
      groups,
      users,
      organizations,
      aiMonthly,
    }) => ({
      id,
      name,
      amountCents,
      members,
      groups,
      users,
      organizations,
      aiMonthly,
    }),
  );
}
function config() {
  return {
    configured: Boolean(
      process.env.MERCADOPAGO_ACCESS_TOKEN &&
        process.env.MERCADOPAGO_WEBHOOK_SECRET &&
        process.env.APP_URL &&
        plans().length,
    ),
    mode: process.env.MERCADOPAGO_MODE || "test",
    enforced: process.env.BILLING_ENFORCE === "true",
  };
}
async function request(path, options = {}) {
  if (!process.env.MERCADOPAGO_ACCESS_TOKEN)
    throw new DomainError("Configure Mercado Pago no servidor.", 503);
  let response;
  try {
    response = await fetch(`https://api.mercadopago.com${path}`, {
      ...options,
      signal: AbortSignal.timeout(15000),
      headers: {
        Authorization: `Bearer ${process.env.MERCADOPAGO_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
        ...options.headers,
      },
    });
  } catch {
    throw new DomainError(
      "Mercado Pago indisponível. Tente sincronizar novamente.",
      503,
    );
  }
  if (!response.ok)
    throw new DomainError(
      "Mercado Pago recusou a operação. Confira a configuração no servidor.",
      502,
    );
  return response.json();
}
function validateSignature(req) {
  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
  const dataId = String(req.query["data.id"] || "").toLowerCase();
  const requestId = req.get("x-request-id");
  const signature = Object.fromEntries(
    String(req.get("x-signature") || "")
      .split(",")
      .map((part) => part.trim().split("=")),
  );
  const timestamp = Number(signature.ts);
  const millis = timestamp < 1e12 ? timestamp * 1000 : timestamp;
  if (
    !secret ||
    !dataId ||
    !requestId ||
    !/^\d+$/.test(signature.ts || "") ||
    !/^[a-f0-9]{64}$/i.test(signature.v1 || "") ||
    Math.abs(Date.now() - millis) > 5 * 60000
  )
    return false;
  if (req.body?.data?.id && String(req.body.data.id).toLowerCase() !== dataId)
    return false;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(`id:${dataId};request-id:${requestId};ts:${signature.ts};`)
    .digest();
  return crypto.timingSafeEqual(expected, Buffer.from(signature.v1, "hex"));
}
async function checkout(subscription, payerEmail) {
  if (!config().configured)
    throw new DomainError(
      "Configure credenciais, APP_URL e planos antes de abrir o checkout.",
      503,
    );
  const base = new URL(process.env.APP_URL);
  if (base.protocol !== "https:")
    throw new DomainError(
      "APP_URL precisa ser uma URL HTTPS pública para o Mercado Pago.",
      503,
    );
  return request("/preapproval", {
    method: "POST",
    headers: { "X-Idempotency-Key": subscription.id },
    body: JSON.stringify({
      reason: `Equilibra - ${subscription.plan.name}`,
      external_reference: subscription.id,
      payer_email: payerEmail,
      auto_recurring: {
        frequency: 1,
        frequency_type: "months",
        transaction_amount: subscription.plan.amountCents / 100,
        currency_id: "BRL",
      },
      back_url: `${base.origin}/#assinatura`,
      notification_url: `${base.origin}/api/billing/webhook`,
      status: "pending",
    }),
  });
}
function safeCheckoutUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" &&
      [
        "www.mercadopago.com.br",
        "www.mercadopago.com",
        "www.mercadopago.com.ar",
      ].includes(url.hostname)
      ? url.href
      : null;
  } catch {
    return null;
  }
}
module.exports = {
  plans,
  config,
  request,
  validateSignature,
  checkout,
  safeCheckoutUrl,
};
