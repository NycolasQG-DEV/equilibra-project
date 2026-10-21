const express = require("express");
const billing = require("../../integrations/mercadoPago");
const { repo, storage, DomainError, ownerOnly } = require("./context");
function createRouter() {
  const router = express.Router();
  router.get("/billing", (req, res) => {
    ownerOnly(req);
    res.json({
      ...billing.config(),
      plans: billing.plans(),
      subscriptions: repo.get(req.account.id).subscriptions,
    });
  });
  router.post("/billing/checkout", async (req, res) => {
    ownerOnly(req);
    const plan = billing.plans().find((row) => row.id === req.body.planId);
    if (!plan) throw new DomainError("Plano indisponível.");
    const snapshot = repo.get(req.account.id).subscriptions;
    if (snapshot.some((row) => ["authorized", "creating"].includes(row.status)))
      throw new DomainError(
        "Já existe assinatura ativa ou checkout em criação.",
        409,
      );
    let subscription = snapshot.find(
      (row) =>
        row.plan.id === plan.id && row.status === "pending" && row.checkoutUrl,
    );
    if (subscription) return res.json({ url: subscription.checkoutUrl });
    if (snapshot.some((row) => row.status === "pending"))
      throw new DomainError(
        "Cancele o checkout pendente antes de escolher outro plano.",
        409,
      );
    subscription = repo.transaction(
      req.account,
      "billing.checkout_requested",
      (data) => {
        const row = repo.create({ plan, status: "creating" });
        data.subscriptions.push(row);
        return row;
      },
    );
    try {
      const external = await billing.checkout(subscription, req.account.email);
      const url = billing.safeCheckoutUrl(external.init_point);
      if (!external.id || !url)
        throw new DomainError("Checkout retornou dados inválidos.", 502);
      repo.transaction(req.account, "billing.checkout_created", (data) =>
        Object.assign(repo.find(data.subscriptions, subscription.id), {
          providerId: external.id,
          checkoutUrl: url,
          status: "pending",
        }),
      );
      res.json({ url });
    } catch (error) {
      repo.transaction(req.account, "billing.checkout_failed", (data) =>
        Object.assign(repo.find(data.subscriptions, subscription.id), {
          status: "failed",
        }),
      );
      throw error;
    }
  });
  router.post("/billing/:id/sync", async (req, res) => {
    ownerOnly(req);
    const local = repo.find(
      repo.get(req.account.id).subscriptions,
      req.params.id,
    );
    if (!local.providerId)
      throw new DomainError("Assinatura ainda não foi criada no provedor.");
    const external = await billing.request(
      `/preapproval/${encodeURIComponent(local.providerId)}`,
    );
    validateSubscription(external, local);
    res.json(
      repo.transaction(req.account, "billing.synchronized", (data) =>
        Object.assign(repo.find(data.subscriptions, local.id), {
          status: external.status,
          syncedAt: new Date().toISOString(),
        }),
      ),
    );
  });
  router.post("/billing/:id/cancel", async (req, res) => {
    ownerOnly(req);
    const local = repo.find(
      repo.get(req.account.id).subscriptions,
      req.params.id,
    );
    if (!local.providerId)
      throw new DomainError("Assinatura não vinculada ao provedor.");
    const external = await billing.request(
      `/preapproval/${encodeURIComponent(local.providerId)}`,
      { method: "PUT", body: JSON.stringify({ status: "cancelled" }) },
    );
    validateSubscription(external, local);
    res.json(
      repo.transaction(req.account, "billing.cancelled", (data) =>
        Object.assign(repo.find(data.subscriptions, local.id), {
          status: external.status,
        }),
      ),
    );
  });
  return router;
}
function validateSubscription(external, local) {
  const recurring = external.auto_recurring;
  if (
    String(external.id) !== String(local.providerId) ||
    external.external_reference !== local.id ||
    recurring?.currency_id !== "BRL" ||
    Math.round(Number(recurring.transaction_amount) * 100) !==
      local.plan.amountCents ||
    recurring.frequency !== 1 ||
    recurring.frequency_type !== "months"
  )
    throw new DomainError("Assinatura não corresponde ao contrato local.", 409);
}
async function webhook(req, res, next) {
  try {
    if (!billing.validateSignature(req))
      return res
        .status(401)
        .json({ error: "Assinatura de notificação inválida." });
    const topic = req.body.type || req.query.type;
    if (
      !["subscription_preapproval", "subscription_authorized_payment"].includes(
        topic,
      )
    )
      return res.json({ received: true, ignored: true });
    const dataId = String(req.query["data.id"]);
    const invoice =
      topic === "subscription_authorized_payment"
        ? await billing.request(
            `/authorized_payments/${encodeURIComponent(dataId)}`,
          )
        : null;
    const providerId = invoice?.preapproval_id || dataId;
    const all = storage.read("management");
    const state = all.find((item) =>
      item.subscriptions.some(
        (row) => String(row.providerId) === String(providerId),
      ),
    );
    if (!state) return res.json({ received: true, ignored: true });
    const local = state.subscriptions.find(
      (row) => String(row.providerId) === String(providerId),
    );
    const external = await billing.request(
      `/preapproval/${encodeURIComponent(providerId)}`,
    );
    validateSubscription(external, local);
    const approvalDate = new Date(
      invoice?.payment?.date_approved || invoice?.date_created,
    );
    const approved =
      invoice?.payment?.status === "approved" &&
      Math.round(Number(invoice.transaction_amount) * 100) ===
        local.plan.amountCents &&
      Number.isFinite(approvalDate.getTime());
    repo.transaction(
      { id: state.id, name: "Mercado Pago" },
      "billing.webhook",
      (data) => {
        const row = repo.find(data.subscriptions, local.id);
        row.status = external.status;
        if (approved && !row.processedInvoices?.includes(String(invoice.id))) {
          const until = require("../../domain/dates").addMonths(approvalDate, 1);
          row.paidUntil = new Date(
            Math.max(Date.parse(row.paidUntil) || 0, until.getTime()),
          ).toISOString();
          row.processedInvoices = [
            ...(row.processedInvoices || []),
            String(invoice.id),
          ];
        }
        row.syncedAt = new Date().toISOString();
        return row;
      },
    );
    res.json({ received: true });
  } catch (error) {
    next(error);
  }
}
module.exports = { createRouter, webhook };
