const express = require("express");
const repo = require("../repositories/managementRepository");
const storage = require("../config/equilibraStorage");
const { DomainError, required, text, dateOnly } = require("../domain/workflow");
const { compareReports } = require("../domain/analysis");
const assistant = require("../services/assistantService");
const ai = require("../integrations/ai");
const { reportFor, ownerOnly } = require("./management/context");
function createRouter(protectedRoute) {
  const router = express.Router();
  router.use(protectedRoute);
  router.use(require("./management/assessmentRoutes")());
  router.use(require("./management/actionRoutes")());
  router.use(require("./management/teamRoutes")());
  router.use(require("./management/billingRoutes").createRouter());
  router.get("/retention", (req, res) => {
    ownerOnly(req);
    res.json(require("../services/retentionService").preview(req.account.id));
  });
  router.put("/retention", (req, res) => {
    ownerOnly(req);
    const months = Number(req.body.months);
    if (!Number.isInteger(months) || months < 0 || months > 60)
      throw new DomainError(
        "Escolha retenção entre 1 e 60 meses, ou 0 para desativar.",
      );
    repo.transaction(req.account, "privacy.retention_configured", (data) => {
      data.retentionMonths = months;
      return { id: data.id };
    });
    res.json(require("../services/retentionService").preview(req.account.id));
  });
  router.post("/retention/purge", (req, res) => {
    ownerOnly(req);
    if (req.body.confirmation !== "PURGAR")
      throw new DomainError("Confirme digitando PURGAR.");
    res.json(require("../services/retentionService").purge(req.account));
  });
  router.post("/account/password", (req, res) => {
    const password = require("../services/passwordService");
    password.validate(req.body.password);
    const accounts = storage.read("accounts"),
      actor = accounts.find((row) => row.id === req.account.userId);
    if (!password.verify(req.body.currentPassword, actor?.passwordHash))
      throw new DomainError("Senha atual incorreta.");
    actor.passwordHash = password.derive(req.body.password);
    storage.writeMany({
      accounts,
      sessions: storage
        .read("sessions")
        .filter((row) => row.accountId !== actor.id),
    });
    repo.transaction(req.account, "account.password_changed", () => ({
      id: actor.id,
    }));
    res.status(204).end();
  });
  router.get("/workspace", (req, res) => {
    const data = repo.get(req.account.id);
    const today = require("../domain/dates").today();
    const terminal = ["effective", "ineffective", "cancelled"];
    res.json({
      assessments: data.assessments,
      actions: data.actions,
      schedules: data.schedules,
      audit: data.audit.slice(-100).reverse(),
      aiHistory: data.aiHistory.slice(-20).reverse(),
      ai: ai.configuration(),
      workflow: {
        actionTransitions: require("../domain/workflow").TRANSITIONS,
      },
      entitlement: require("../services/entitlementService").entitlement(
        req.account.id,
      ),
      summary: {
        investigating: data.assessments.filter(
          (row) => row.status === "investigating",
        ).length,
        overdue: data.actions.filter(
          (row) =>
            !terminal.includes(row.status) &&
            row.status !== "implemented" &&
            row.dueDate < today,
        ).length,
        reviewDue: data.actions.filter(
          (row) => row.status === "implemented" && row.reviewDate <= today,
        ).length,
        activeActions: data.actions.filter(
          (row) => !terminal.includes(row.status),
        ).length,
      },
    });
  });
  router.get("/compare", (req, res) =>
    res.json(
      compareReports(
        reportFor(req.account, req.query.current),
        reportFor(req.account, req.query.previous),
      ),
    ),
  );
  router.post("/assistant", async (req, res) => {
    const result = await assistant.explain(
      req.account.id,
      reportFor(req.account, req.body.reportId),
      req.body,
      reportFor(req.account, req.body.previousReportId),
    );
    const saved = repo.transaction(
      req.account,
      "assistant.generated",
      (data) => {
        const row = repo.create({
          ...result,
          question: text(req.body.question, 1200),
        });
        data.aiHistory.push(row);
        return row;
      },
    );
    res.json(saved);
  });
  router.post("/schedules", (req, res) =>
    res.status(201).json(
      repo.transaction(req.account, "schedule.created", (data) => {
        const survey = storage
          .read("surveys")
          .find(
            (row) =>
              row.accountId === req.account.id &&
              row.id === req.body.surveyId &&
              row.status === "closed",
          );
        if (!survey)
          throw new DomainError(
            "Selecione uma pesquisa encerrada como referência.",
          );
        const row = repo.create({
          surveyId: survey.id,
          title: required(req.body.title, "o título", 160),
          nextDate: dateOnly(req.body.nextDate, "a próxima data"),
          intervalMonths: Number(req.body.intervalMonths),
          enabled: true,
        });
        if (![1, 3, 6, 12].includes(row.intervalMonths))
          throw new DomainError("Escolha uma frequência válida.");
        if (
          data.schedules.some(
            (item) =>
              item.enabled &&
              item.surveyId === row.surveyId &&
              item.intervalMonths === row.intervalMonths,
          )
        )
          throw new DomainError(
            "Já existe um agendamento ativo dessa pesquisa com essa frequência.",
            409,
          );
        data.schedules.push(row);
        return row;
      }),
    ),
  );
  router.delete("/schedules/:id", (req, res) => {
    repo.transaction(req.account, "schedule.disabled", (data) => {
      const row = repo.find(data.schedules, req.params.id);
      row.enabled = false;
      return row;
    });
    res.status(204).end();
  });
  router.get("/dossier", (req, res) => {
    const state = repo.get(req.account.id);
    res.json({
      generatedAt: new Date().toISOString(),
      organization: req.account.company,
      limitations:
        "Documentação de apoio. Não substitui avaliação técnica ou documentos ocupacionais exigíveis.",
      reports: storage
        .read("reports")
        .filter((row) => row.accountId === req.account.id),
      assessments: state.assessments,
      actions: state.actions,
      audit: state.audit,
    });
  });
  router.use((error, _req, res, _next) => {
    if (error instanceof DomainError)
      return res.status(error.status).json({ error: error.message });
    console.error("Falha no módulo de gestão:", error.name);
    res.status(500).json({ error: "Não foi possível concluir esta operação." });
  });
  return router;
}
module.exports = {
  createRouter,
  webhook: require("./management/billingRoutes").webhook,
};
