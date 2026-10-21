const express = require("express");
const {
  repo,
  validateAssessment,
  DomainError,
  reportFor,
} = require("./context");
module.exports = function createRouter() {
  const router = express.Router();
  router.post("/assessments", (req, res) => {
    const fields = validateAssessment(
      req.body,
      reportFor(req.account, req.body.reportId),
    );
    const result = repo.transaction(
      req.account,
      "assessment.created",
      (data) => {
        if (
          data.assessments.some(
            (row) =>
              row.reportId === fields.reportId &&
              row.factor === fields.factor &&
              row.status !== "dismissed",
          )
        )
          throw new DomainError(
            "Já existe uma avaliação ativa desse fator neste ciclo.",
            409,
          );
        const row = repo.create(fields);
        data.assessments.push(row);
        return row;
      },
    );
    res.status(201).json(result);
  });
  router.put("/assessments/:id", (req, res) =>
    res.json(
      repo.transaction(req.account, "assessment.updated", (data) => {
        const row = repo.find(data.assessments, req.params.id);
        const fields = validateAssessment(
          { ...req.body, reportId: row.reportId, factor: row.factor },
          reportFor(req.account, row.reportId),
        );
        if (
          fields.status !== "evaluated" &&
          data.actions.some((action) => action.assessmentId === row.id)
        )
          throw new DomainError(
            "Avaliação vinculada a ações precisa permanecer avaliada.",
            409,
          );
        return repo.update(row, fields, req.body.version);
      }),
    ),
  );
  return router;
};
