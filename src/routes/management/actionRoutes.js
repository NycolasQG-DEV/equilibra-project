const express = require("express");
const {
  repo,
  validateAction,
  DomainError,
  required,
  text,
  compareReports,
  reportFor,
} = require("./context");
module.exports = function createRouter() {
  const router = express.Router();
  router.post("/actions", (req, res) =>
    res.status(201).json(
      repo.transaction(req.account, "action.created", (data) => {
        const assessment = repo.find(data.assessments, req.body.assessmentId);
        const fields = validateAction(req.body, assessment);
        const source = req.body.aiSourceId
          ? data.aiHistory.find(
              (row) =>
                row.id === req.body.aiSourceId &&
                row.reportId === assessment.reportId &&
                row.suggestion,
            )
          : null;
        if (req.body.aiSourceId && !source)
          throw new DomainError("Proposta de IA não corresponde à avaliação.");
        const row = repo.create({
          ...fields,
          aiSourceId: source?.id || null,
          evidence: [],
        });
        data.actions.push(row);
        return row;
      }),
    ),
  );
  router.put("/actions/:id", (req, res) =>
    res.json(
      repo.transaction(req.account, "action.updated", (data) => {
        const row = repo.find(data.actions, req.params.id);
        return repo.update(
          row,
          validateAction(
            { ...req.body, assessmentId: row.assessmentId },
            repo.find(data.assessments, row.assessmentId),
            row,
          ),
          req.body.version,
        );
      }),
    ),
  );
  router.post("/actions/:id/evidence", (req, res) =>
    res.status(201).json(
      repo.transaction(req.account, "action.evidence_added", (data) => {
        const row = repo.find(data.actions, req.params.id);
        if (["effective", "ineffective", "cancelled"].includes(row.status))
          throw new DomainError(
            "Ação encerrada não recebe novas evidências.",
            409,
          );
        const url = text(req.body.url, 1000);
        if (url) {
          try {
            if (new URL(url).protocol !== "https:") throw new Error();
          } catch {
            throw new DomainError("Informe um link HTTPS válido.");
          }
        }
        const evidence = repo.create({
          description: required(
            req.body.description,
            "a descrição da evidência",
          ),
          url,
          actor: req.account.name,
        });
        return repo.update(
          row,
          { evidence: [...row.evidence, evidence] },
          req.body.version,
        );
      }),
    ),
  );
  router.post("/actions/:id/measurement", (req, res) =>
    res.json(
      repo.transaction(req.account, "action.measurement_linked", (data) => {
        const row = repo.find(data.actions, req.params.id);
        const assessment = repo.find(data.assessments, row.assessmentId);
        const baseline = reportFor(req.account, assessment.reportId),
          measurement = reportFor(req.account, req.body.reportId);
        const comparison = compareReports(measurement, baseline);
        if (!comparison.comparable) throw new DomainError(comparison.reason);
        return repo.update(
          row,
          {
            measurementReportId: measurement.id,
            measurementDelta: comparison.factors.find(
              (factor) => factor.key === assessment.factor,
            )?.delta,
          },
          req.body.version,
        );
      }),
    ),
  );
  return router;
};
