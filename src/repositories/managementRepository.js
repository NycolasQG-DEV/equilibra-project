const crypto = require("node:crypto");
const storage = require("../config/equilibraStorage");
const { DomainError } = require("../domain/workflow");
function empty(accountId) {
  return {
    id: accountId,
    assessments: [],
    actions: [],
    audit: [],
    invitations: [],
    schedules: [],
    subscriptions: [],
    recovery: [],
  };
}
function get(accountId) {
  return (
    storage.read("management").find((row) => row.id === accountId) ||
    empty(accountId)
  );
}
// A synchronous transaction reads fresh state and commits the whole management document once.
// This repository is single-process only; PostgreSQL must replace it before multiple writers.
function transaction(account, event, mutate) {
  const all = storage.read("management");
  let state = all.find((row) => row.id === account.id);
  if (!state) {
    state = empty(account.id);
    all.push(state);
  }
  const previousRecords = [...state.assessments, ...state.actions].map((row) =>
    structuredClone(row),
  );
  const result = mutate(state);
  const entry = {
    id: crypto.randomUUID(),
    at: new Date().toISOString(),
    actorId: account.userId || account.id,
    actor: account.name || "Sistema",
    event,
    entityId: result?.id || null,
    previousHash: state.audit.at(-1)?.hash || null,
  };
  if (event.startsWith("assessment.") || event.startsWith("action.")) {
    entry.before = previousRecords.find((row) => row.id === result?.id) || null;
    entry.after = result ? structuredClone(result) : null;
  }
  entry.hash = crypto
    .createHash("sha256")
    .update(JSON.stringify(entry))
    .digest("hex");
  state.audit.push(entry);
  storage.write("management", all);
  return result;
}
function find(rows, entityId) {
  const item = rows.find((row) => row.id === entityId);
  if (!item) throw new DomainError("Registro não encontrado.", 404);
  return item;
}
function update(item, fields, version) {
  if (!Number.isInteger(version) || item.version !== version)
    throw new DomainError(
      "Registro atualizado por outra pessoa. Recarregue antes de salvar.",
      409,
    );
  Object.assign(item, fields, {
    version: item.version + 1,
    updatedAt: new Date().toISOString(),
  });
  return item;
}
function create(fields) {
  return {
    id: crypto.randomUUID(),
    ...fields,
    version: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}
module.exports = { get, transaction, find, update, create };
