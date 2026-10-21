const storage = require("../config/equilibraStorage");
const repo = require("../repositories/managementRepository");
const billing = require("../integrations/mercadoPago");
const { DomainError } = require("../domain/workflow");
function entitlement(accountId) {
  const data = repo.get(accountId);
  const paid = data.subscriptions
    .filter((row) => row.paidUntil && Date.parse(row.paidUntil) > Date.now())
    .sort((a, b) => Date.parse(b.paidUntil) - Date.parse(a.paidUntil))[0];
  if (paid)
    return {
      plan: paid.plan,
      paid: true,
      paidUntil: paid.paidUntil,
      source: "subscription",
    };
  if (!billing.config().enforced)
    return {
      plan:
        billing
          .plans()
          .find((row) => row.id === (process.env.LOCAL_PLAN || "avancado")) ||
        billing.plans()[0],
      paid: false,
      source: "local_preview",
    };
  return { plan: null, paid: false, source: "no_subscription" };
}
function limit(accountId, resource, added = 1) {
  const { plan } = entitlement(accountId);
  if (!plan)
    throw new DomainError(
      "Ative uma assinatura para adicionar registros.",
      402,
    );
  let used;
  if (resource === "users")
    used = storage
      .read("accounts")
      .filter(
        (row) => (row.organizationId || row.id) === accountId && !row.disabled,
      ).length;
  else
    used = storage
      .read(resource)
      .filter((row) => row.accountId === accountId && !row.isDefault).length;
  if (used + added > plan[resource])
    throw new DomainError(
      `Limite do plano: ${plan[resource]} ${resource === "members" ? "pessoas" : resource === "groups" ? "grupos personalizados" : "usuários"}.`,
      402,
    );
}
function check(req) {
  if (
    ["GET", "HEAD"].includes(req.method) ||
    req.path.startsWith("/auth/") ||
    req.path === "/account/password" ||
    req.path.startsWith("/retention") ||
    req.path.startsWith("/billing") ||
    req.path.startsWith("/team") ||
    req.path === "/dossier"
  )
    return;
  if (!entitlement(req.account.id).plan)
    throw new DomainError(
      "Assinatura sem período pago ativo. Seus dados continuam disponíveis para consulta e exportação.",
      402,
    );
  if (req.method === "POST" && req.path === "/members")
    limit(req.account.id, "members");
  if (req.method === "POST" && req.path === "/groups")
    limit(req.account.id, "groups");
  if (req.method === "POST" && req.path === "/assistant") {
    const { plan } = entitlement(req.account.id);
    if (!plan.aiMonthly)
      throw new DomainError(
        "Assistente de IA disponível a partir do plano Popular.",
        402,
      );
    const month = new Date().toISOString().slice(0, 7);
    if (
      repo
        .get(req.account.id)
        .aiHistory.filter((row) => row.createdAt.startsWith(month)).length >=
      plan.aiMonthly
    )
      throw new DomainError("Cota mensal de IA atingida.", 402);
  }
}
module.exports = {
  entitlement,
  limit,
  check,
  checkUserLimit: (accountId) => limit(accountId, "users"),
};
