class DomainError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}
const text = (value, limit = 2000) =>
  typeof value === "string" ? value.trim().slice(0, limit) : "";
function required(value, label, limit) {
  const result = text(value, limit);
  if (!result) throw new DomainError(`Informe ${label}.`);
  return result;
}
function dateOnly(value, label) {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(value || "") ||
    !Number.isFinite(Date.parse(value)) ||
    new Date(value).toISOString().slice(0, 10) !== value
  )
    throw new DomainError(`Informe ${label} válida.`);
  return value;
}
function oneOf(value, values, label) {
  if (!values.includes(value)) throw new DomainError(`${label} inválido.`);
  return value;
}
function validateAssessment(input, report) {
  if (!report?.published)
    throw new DomainError("Selecione um resultado publicado.");
  if (!report.result.some((row) => row.key === input.factor))
    throw new DomainError("Fator não pertence ao resultado.");
  const status = oneOf(
    input.status || "investigating",
    ["investigating", "evaluated", "dismissed"],
    "Estado",
  );
  const context = text(input.context),
    decision = text(input.decision);
  if (status !== "investigating" && (!context || !decision))
    throw new DomainError(
      "Registre contexto e decisão para concluir a avaliação.",
    );
  return {
    reportId: report.id,
    factor: input.factor,
    title: required(input.title, "o título", 160),
    context,
    existingMeasures: text(input.existingMeasures),
    decision,
    status,
    classification: oneOf(
      input.classification || "pending",
      ["pending", "low", "medium", "high"],
      "Prioridade técnica",
    ),
  };
}
const ACTION_STATES = [
  "planned",
  "in_progress",
  "implemented",
  "effective",
  "ineffective",
  "cancelled",
];
const TRANSITIONS = {
  planned: ["planned", "in_progress", "cancelled"],
  in_progress: ["in_progress", "implemented", "cancelled"],
  implemented: ["implemented", "effective", "ineffective", "in_progress"],
  effective: ["effective"],
  ineffective: ["ineffective", "in_progress"],
  cancelled: ["cancelled"],
};
function validateAction(input, assessment, previous) {
  if (assessment?.status !== "evaluated")
    throw new DomainError(
      "Conclua a avaliação do achado antes de planejar a ação.",
    );
  const status = oneOf(input.status || "planned", ACTION_STATES, "Estado");
  if (!previous && status !== "planned")
    throw new DomainError("Uma ação começa como planejada.");
  if (previous && !TRANSITIONS[previous.status].includes(status))
    throw new DomainError("Transição de ação não permitida.");
  const dueDate = dateOnly(input.dueDate, "uma data de execução");
  const reviewDate = dateOnly(input.reviewDate, "uma data de revisão");
  if (reviewDate < dueDate)
    throw new DomainError(
      "A revisão não pode ocorrer antes do prazo de execução.",
    );
  const review = text(input.review);
  if (
    ["implemented", "effective", "ineffective"].includes(status) &&
    !previous?.evidence?.length
  )
    throw new DomainError(
      "Adicione evidência antes de registrar a implementação.",
    );
  if (["effective", "ineffective"].includes(status) && !review)
    throw new DomainError("Registre a verificação de eficácia.");
  if (
    ["effective", "ineffective"].includes(status) &&
    reviewDate > require("./dates").today()
  )
    throw new DomainError(
      "Aguarde a data de revisão ou ajuste o prazo com justificativa.",
    );
  return {
    assessmentId: assessment.id,
    title: required(input.title, "o título", 160),
    description: text(input.description),
    owner: required(input.owner, "o responsável", 120),
    dueDate,
    reviewDate,
    successCriteria: required(input.successCriteria, "o critério de eficácia"),
    priority: oneOf(
      input.priority || "medium",
      ["low", "medium", "high"],
      "Prioridade",
    ),
    status,
    review,
  };
}
module.exports = {
  DomainError,
  text,
  required,
  dateOnly,
  oneOf,
  validateAssessment,
  validateAction,
  ACTION_STATES,
  TRANSITIONS,
};
