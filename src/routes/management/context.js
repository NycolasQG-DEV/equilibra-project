const crypto = require("node:crypto");
const repo = require("../../repositories/managementRepository");
const storage = require("../../config/equilibraStorage");
const {
  DomainError,
  required,
  text,
  oneOf,
  validateAssessment,
  validateAction,
} = require("../../domain/workflow");
const { compareReports } = require("../../domain/analysis");
const hash = (value) => crypto.createHash("sha256").update(value).digest("hex");
const reportFor = (account, id) =>
  storage
    .read("reports")
    .find((row) => row.accountId === account.id && row.id === id);
const ownerOnly = (req) => {
  if (req.account.role !== "owner")
    throw new DomainError(
      "Somente o administrador pode realizar esta operação.",
      403,
    );
};

module.exports = {
  repo,
  storage,
  DomainError,
  required,
  text,
  oneOf,
  validateAssessment,
  validateAction,
  compareReports,
  reportFor,
  ownerOnly,
  hash,
};
