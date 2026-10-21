const storage = require("../config/equilibraStorage");
const repo = require("../repositories/managementRepository");
const { DomainError } = require("../domain/workflow");
function preview(accountId) {
  const months = repo.get(accountId).retentionMonths || 0;
  const cutoff = new Date();
  cutoff.setUTCMonth(cutoff.getUTCMonth() - months);
  const reportIds = new Set(
    storage
      .read("reports")
      .filter((row) => row.accountId === accountId)
      .map((row) => row.surveyId),
  );
  const eligible = months
    ? storage
        .read("surveys")
        .filter(
          (row) =>
            row.accountId === accountId &&
            row.status === "closed" &&
            reportIds.has(row.id) &&
            Date.parse(row.closedAt) < cutoff.getTime(),
        )
        .map((row) => row.id)
    : [];
  return {
    months,
    cutoff: months ? cutoff.toISOString() : null,
    surveyIds: eligible,
    responses: storage
      .read("responses")
      .filter(
        (row) => row.accountId === accountId && eligible.includes(row.surveyId),
      ).length,
    invitations: storage
      .read("invitations")
      .filter(
        (row) => row.accountId === accountId && eligible.includes(row.surveyId),
      ).length,
  };
}
function purge(account) {
  const review = preview(account.id);
  if (!review.months)
    throw new DomainError("Defina a política de retenção antes de purgar.");
  const keep = (row) =>
    row.accountId !== account.id || !review.surveyIds.includes(row.surveyId);
  storage.writeMany({
    responses: storage.read("responses").filter(keep),
    invitations: storage.read("invitations").filter(keep),
  });
  repo.transaction(account, "privacy.raw_data_purged", () => ({
    id: account.id,
  }));
  return review;
}
module.exports = { preview, purge };
