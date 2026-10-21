const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const crypto = require("node:crypto");
const directory = fs.mkdtempSync(
  path.join(os.tmpdir(), "equilibra-management-"),
);
process.env.EQUILIBRA_DATA_DIR = directory;
process.env.GROQ_API_KEY = "";
process.env.AI_MODEL = "";
process.env.MERCADOPAGO_ACCESS_TOKEN = "";
process.env.MERCADOPAGO_WEBHOOK_SECRET = "";
process.env.BILLING_ENFORCE = "false";
process.env.BILLING_PLANS_JSON = "";
const app = require("../src/server");
const storage = require("../src/config/equilibraStorage");
const ai = require("../src/integrations/ai");
const { nextMonth, tick } = require("../src/services/scheduler");
const { compareReports } = require("../src/domain/analysis");

test("jornada de avaliação, ação, evidência, eficácia, equipe e isolamento", async () => {
  const server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  async function call(route, method = "GET", body, session = "") {
    const response = await fetch(base + route, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(session ? { Cookie: session } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    return {
      status: response.status,
      body:
        response.status === 204
          ? null
          : await (response.headers
              .get("content-type")
              ?.includes("application/json")
              ? response.json()
              : response.text()),
      cookie: response.headers.get("set-cookie")?.split(";")[0],
    };
  }
  const password = "senha-teste-forte-123";
  try {
    const account = await call("/auth/register", "POST", {
      name: "Ana",
      company: "QA",
      email: "qa@local.test",
      password,
    });
    const other = await call("/auth/register", "POST", {
      name: "Outra",
      company: "Outra",
      email: "other@local.test",
      password,
    });
    const cookie = account.cookie;
    const ids = [];
    for (let i = 0; i < 5; i++)
      ids.push(
        (await call("/members", "POST", { name: `Pessoa ${i}` }, cookie)).body
          .id,
      );
    const group = (
      await call(
        "/groups",
        "POST",
        { name: "Operação", memberIds: ids },
        cookie,
      )
    ).body;
    async function cycle(title, answer) {
      const created = await call(
        "/surveys",
        "POST",
        {
          title,
          model: "Pulso mensal",
          cycle: title,
          groupId: group.id,
          endsAt: new Date(Date.now() + 86400000).toISOString(),
        },
        cookie,
      );
      const opened = await call(
        `/surveys/${created.body.id}/open`,
        "POST",
        {},
        cookie,
      );
      const answers = Object.fromEntries(
        [
          "demandas",
          "autonomia",
          "apoio",
          "relacoes",
          "reconhecimento",
          "jornada",
          "mudancas",
          "seguranca",
        ].map((key) => [key, answer]),
      );
      for (const link of opened.body.links)
        assert.equal(
          (await call(`/respond/${link.token}`, "POST", { answers })).status,
          201,
        );
      const live = (await call("/surveys", "GET", undefined, cookie)).body.find(
        (row) => row.id === created.body.id,
      );
      assert.equal(live.result, null);
      assert.equal(live.liveResult, null);
      assert.equal(
        (
          await call(
            `/surveys/${created.body.id}/simulate-responses`,
            "POST",
            {},
            cookie,
          )
        ).status,
        404,
      );
      await call(`/surveys/${created.body.id}/close`, "POST", {}, cookie);
      return (await call("/reports", "GET", undefined, cookie)).body.find(
        (row) => row.surveyId === created.body.id,
      );
    }
    const baseline = await cycle("Base", 2);
    const later = await cycle("Revisão", 4);
    const dashboard = (await call("/dashboard", "GET", undefined, cookie)).body;
    assert.equal(
      dashboard.result[0].average,
      4,
      "painel usa último ciclo, não média de todos",
    );
    const comparison = (
      await call(
        `/management/compare?current=${later.id}&previous=${baseline.id}`,
        "GET",
        undefined,
        cookie,
      )
    ).body;
    assert.equal(comparison.comparable, true);
    assert.equal(comparison.factors[0].delta, 2);
    assert.equal(
      compareReports({ ...later, audienceFingerprint: "outro" }, baseline)
        .comparable,
      false,
    );
    const assessmentInput = {
      reportId: baseline.id,
      factor: "demandas",
      title: "Investigar volume",
      status: "investigating",
    };
    assert.equal(
      (
        await call(
          "/management/assessments",
          "POST",
          assessmentInput,
          other.cookie,
        )
      ).status,
      400,
    );
    let assessment = (
      await call("/management/assessments", "POST", assessmentInput, cookie)
    ).body;
    assert.equal(assessment.version, 1);
    assert.equal(
      (await call("/management/assessments", "POST", assessmentInput, cookie))
        .status,
      409,
    );
    const actionInput = {
      assessmentId: assessment.id,
      title: "Redistribuir demandas",
      owner: "Gestão operacional",
      dueDate: "2026-01-01",
      reviewDate: "2026-01-02",
      priority: "high",
      successCriteria:
        "Reduzir horas extras e verificar percepção no ciclo seguinte",
    };
    assert.equal(
      (await call("/management/actions", "POST", actionInput, cookie)).status,
      400,
    );
    assessment = (
      await call(
        `/management/assessments/${assessment.id}`,
        "PUT",
        {
          ...assessment,
          status: "evaluated",
          context: "Volume e capacidade examinados",
          decision: "Redistribuir tarefas",
          classification: "high",
        },
        cookie,
      )
    ).body;
    let action = (
      await call("/management/actions", "POST", actionInput, cookie)
    ).body;
    assert.equal(
      (
        await call(
          `/management/actions/${action.id}`,
          "PUT",
          { ...action, status: "in_progress", version: 99 },
          cookie,
        )
      ).status,
      409,
    );
    action = (
      await call(
        `/management/actions/${action.id}`,
        "PUT",
        { ...action, status: "in_progress" },
        cookie,
      )
    ).body;
    assert.equal(
      (
        await call(
          `/management/actions/${action.id}`,
          "PUT",
          { ...action, status: "implemented" },
          cookie,
        )
      ).status,
      400,
    );
    assert.equal(
      (
        await call(
          `/management/actions/${action.id}/evidence`,
          "POST",
          {
            version: action.version,
            description: "Registro",
            url: "javascript:alert(1)",
          },
          cookie,
        )
      ).status,
      400,
    );
    action = (
      await call(
        `/management/actions/${action.id}/evidence`,
        "POST",
        {
          version: action.version,
          description: "Escalas e atividades reorganizadas",
          url: "https://example.com/evidencia",
        },
        cookie,
      )
    ).body;
    action = (
      await call(
        `/management/actions/${action.id}`,
        "PUT",
        { ...action, status: "implemented" },
        cookie,
      )
    ).body;
    assert.equal(
      (
        await call(
          `/management/actions/${action.id}`,
          "PUT",
          { ...action, status: "effective" },
          cookie,
        )
      ).status,
      400,
    );
    action = (
      await call(
        `/management/actions/${action.id}/measurement`,
        "POST",
        { version: action.version, reportId: later.id },
        cookie,
      )
    ).body;
    assert.equal(action.measurementDelta, 2);
    action = (
      await call(
        `/management/actions/${action.id}`,
        "PUT",
        {
          ...action,
          status: "effective",
          review:
            "Medidas revistas; registros operacionais e nova percepção favoráveis.",
        },
        cookie,
      )
    ).body;
    assert.equal(action.status, "effective");
    assert.equal(
      (
        await call(
          `/management/actions/${action.id}`,
          "PUT",
          { ...action, status: "in_progress" },
          cookie,
        )
      ).status,
      400,
    );
    assert.equal(
      (await call("/management/workspace", "GET", undefined, other.cookie)).body
        .actions.length,
      0,
    );
    const revokedInvite = (
      await call(
        "/management/team/invitations",
        "POST",
        { email: "revoked@local.test", role: "editor" },
        cookie,
      )
    ).body;
    assert.equal(
      (
        await call(
          `/management/team/invitations/${revokedInvite.id}`,
          "DELETE",
          undefined,
          other.cookie,
        )
      ).status,
      404,
    );
    assert.equal(
      (
        await call(
          `/management/team/invitations/${revokedInvite.id}`,
          "DELETE",
          undefined,
          cookie,
        )
      ).status,
      204,
    );
    assert.equal(
      (
        await call("/auth/register", "POST", {
          name: "Revogado",
          company: "QA",
          email: "revoked@local.test",
          password,
          invitationToken: revokedInvite.token,
        })
      ).status,
      400,
    );
    const invite = (
      await call(
        "/management/team/invitations",
        "POST",
        { email: "viewer@local.test", role: "viewer" },
        cookie,
      )
    ).body;
    const viewer = await call("/auth/register", "POST", {
      name: "Leitura",
      company: "Ignorada",
      email: "viewer@local.test",
      password,
      invitationToken: invite.token,
    });
    assert.equal(viewer.body.id, account.body.id);
    assert.equal(viewer.body.role, "viewer");
    assert.equal(
      (await call("/management/actions", "POST", actionInput, viewer.cookie))
        .status,
      403,
    );
    assert.equal(
      (await call("/management/team", "GET", undefined, viewer.cookie)).status,
      403,
    );
    assert.equal(
      (await call("/members", "GET", undefined, viewer.cookie)).body.length,
      0,
    );
    assert.equal(
      (await call("/management/workspace", "GET", undefined, viewer.cookie))
        .body.actions.length,
      1,
    );
    const team = (await call("/management/team", "GET", undefined, cookie))
      .body;
    assert.equal(JSON.stringify(team).includes(invite.token), false);
    await call(
      `/management/team/${viewer.body.userId}`,
      "PUT",
      { role: "viewer", disabled: true },
      cookie,
    );
    assert.equal(
      (await call("/management/workspace", "GET", undefined, viewer.cookie))
        .status,
      401,
    );
    let sent;
    ai.registerProvider("test", () => ({
      generate: async (messages) => {
        sent = JSON.stringify(messages);
        return "Hipótese a investigar. Revisão humana necessária.";
      },
    }));
    process.env.AI_PROVIDER = "test";
    assert.equal(
      (
        await call(
          "/management/assistant",
          "POST",
          { reportId: baseline.id, question: "Como agir?" },
          cookie,
        )
      ).status,
      400,
    );
    const answer = await call(
      "/management/assistant",
      "POST",
      { reportId: baseline.id, question: "Como agir?", allowExternal: true },
      cookie,
    );
    assert.equal(answer.status, 200);
    assert.equal(answer.body.humanReviewRequired, true);
    assert.equal(sent.includes("Pessoa 0"), false);
    assert.equal(sent.includes(group.id), false);
    assert.equal(sent.includes("qa@local.test"), false);
    assert.equal(
      (
        await call(
          "/management/assistant",
          "POST",
          {
            reportId: baseline.id,
            question: "Novamente?",
            allowExternal: true,
          },
          cookie,
        )
      ).status,
      429,
    );
    delete process.env.AI_PROVIDER;
    const schedule = await call(
      "/management/schedules",
      "POST",
      {
        surveyId: baseline.surveyId,
        title: "Pulso recorrente",
        nextDate: "2026-01-01",
        intervalMonths: 1,
      },
      cookie,
    );
    assert.equal(schedule.status, 201);
    tick();
    tick();
    assert.equal(
      storage
        .read("surveys")
        .filter((row) => row.scheduleKey?.startsWith(schedule.body.id)).length,
      1,
    );
    assert.equal(nextMonth("2026-01-31", 1), "2026-02-28");
    assert.equal(
      (await call(`/surveys/${baseline.surveyId}`, "DELETE", undefined, cookie))
        .status,
      204,
    );
    assert.ok(
      (await call("/reports", "GET", undefined, cookie)).body.some(
        (row) => row.id === baseline.id,
      ),
    );
    const dossier = (
      await call("/management/dossier", "GET", undefined, cookie)
    ).body;
    assert.equal(dossier.actions.length, 1);
    assert.ok(dossier.audit.length > 5);
    const billing = (
      await call("/management/billing", "GET", undefined, cookie)
    ).body;
    assert.equal(billing.mode, "test");
    assert.equal(billing.plans[0].aiMonthly, 0);
    assert.ok(billing.plans[1].aiMonthly > 0);
    assert.equal(
      (
        await call(
          "/management/billing/checkout",
          "POST",
          { planId: "popular" },
          cookie,
        )
      ).status,
      503,
    );
    const webhook = await call("/billing/webhook?data.id=123", "POST", {
      type: "subscription_preapproval",
      data: { id: "123" },
    });
    assert.equal(webhook.status, 401);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("assinatura de webhook: HMAC, divergência e replay expirado", () => {
  const { validateSignature } = require("../src/integrations/mercadoPago");
  process.env.MERCADOPAGO_WEBHOOK_SECRET = "segredo-sintetico-de-teste";
  const ts = String(Date.now()),
    requestId = "request-qa",
    dataId = "abc123";
  const signature = crypto
    .createHmac("sha256", process.env.MERCADOPAGO_WEBHOOK_SECRET)
    .update(`id:${dataId};request-id:${requestId};ts:${ts};`)
    .digest("hex");
  const req = {
    query: { "data.id": dataId },
    body: { data: { id: dataId } },
    get: (name) =>
      name === "x-request-id" ? requestId : `ts=${ts},v1=${signature}`,
  };
  assert.equal(validateSignature(req), true);
  assert.equal(
    validateSignature({ ...req, body: { data: { id: "outro" } } }),
    false,
  );
  assert.equal(
    validateSignature({
      ...req,
      get: (name) =>
        name === "x-request-id" ? requestId : `ts=1,v1=${signature}`,
    }),
    false,
  );
  delete process.env.MERCADOPAGO_WEBHOOK_SECRET;
});

test("proposta de IA estruturada, sem aprovação ou efeitos automáticos", async () => {
  const { explain } = require("../src/services/assistantService");
  const previous = process.env.AI_PROVIDER;
  process.env.AI_PROVIDER = "structured-test";
  const report = {
    id: "report",
    published: true,
    responseCount: 10,
    result: [{ key: "demandas", label: "Demandas", average: 2 }],
  };
  ai.registerProvider("structured-test", () => ({
    generate: async () =>
      JSON.stringify({
        title: "Revisar prioridades",
        description: "Revisar capacidade e distribuição de tarefas.",
        successCriteria: "Acompanhar volume e pausas.",
        rationale: "Investigar condições antes de aprovar.",
      }),
  }));
  try {
    const result = await explain("structured-account", report, {
      question: "Proponha uma medida",
      mode: "action",
      allowExternal: true,
    });
    assert.equal(result.suggestion.title, "Revisar prioridades");
    assert.equal(result.humanReviewRequired, true);
    assert.equal(result.suggestion.owner, undefined);
    ai.registerProvider("invalid-test", () => ({
      generate: async () => "texto inválido",
    }));
    process.env.AI_PROVIDER = "invalid-test";
    await assert.rejects(
      explain("invalid-account", report, {
        question: "Proponha uma medida",
        mode: "action",
        allowExternal: true,
      }),
      /formato inválido/,
    );
  } finally {
    process.env.AI_PROVIDER = previous || "groq";
  }
});

test("limites de pessoas, grupos, usuários e IA são aplicados no servidor", () => {
  const limits = require("../src/services/entitlementService");
  process.env.LOCAL_PLAN = "essencial";
  storage.writeMany({
    members: Array.from({ length: 50 }, (_, i) => ({
      id: `m${i}`,
      accountId: "limited",
    })),
    groups: [
      { id: "general", accountId: "limited", isDefault: true },
      ...Array.from({ length: 3 }, (_, i) => ({
        id: `g${i}`,
        accountId: "limited",
      })),
    ],
    accounts: [
      { id: "limited" },
      { id: "collaborator", organizationId: "limited" },
    ],
  });
  try {
    assert.throws(() => limits.limit("limited", "members"), /50 pessoas/);
    assert.throws(() => limits.limit("limited", "groups"), /3 grupos/);
    assert.throws(() => limits.checkUserLimit("limited"), /2 usuários/);
    assert.throws(
      () =>
        limits.check({
          method: "POST",
          path: "/assistant",
          account: { id: "limited" },
        }),
      /Popular/,
    );
    process.env.BILLING_ENFORCE = "true";
    assert.throws(
      () =>
        limits.check({
          method: "POST",
          path: "/actions",
          account: { id: "limited" },
        }),
      /período pago/,
    );
    assert.doesNotThrow(() =>
      limits.check({
        method: "POST",
        path: "/billing/checkout",
        account: { id: "limited" },
      }),
    );
    assert.doesNotThrow(() =>
      limits.check({
        method: "GET",
        path: "/workspace",
        account: { id: "limited" },
      }),
    );
  } finally {
    process.env.LOCAL_PLAN = "avancado";
    process.env.BILLING_ENFORCE = "false";
    if (
      path.resolve(directory).startsWith(path.resolve(os.tmpdir()) + path.sep)
    )
      fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("públicos quase iguais não publicam médias nem distribuições do recorte", async () => {
  const { FACTORS, INSTRUMENT } = require("../src/domain/instruments");
  const { aggregate } = require("../src/domain/analysis");
  const server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  try {
    const signup = await fetch(base + "/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Privacidade QA",
        company: "QA",
        email: "privacy@local.test",
        password: "senha-teste-123",
      }),
    });
    const cookie = signup.headers.get("set-cookie").split(";")[0],
      account = await signup.json();
    const makeResponses = (surveyId, count) =>
      Array.from({ length: count }, (_, i) => ({
        id: `${surveyId}-${i}`,
        accountId: account.id,
        surveyId,
        answers: Object.fromEntries(FACTORS.map(([key]) => [key, 3])),
      }));
    const firstResponses = makeResponses("first", 5),
      secondResponses = makeResponses("second", 6),
      result = aggregate(firstResponses);
    const first = {
      id: "first",
      accountId: account.id,
      title: "Primeiro",
      cycle: "Base",
      status: "closed",
      closedAt: "2026-01-01",
      endsAt: "2026-01-01",
      memberIds: ["a", "b", "c", "d", "e"],
      result,
      instrument: INSTRUMENT,
    };
    const second = {
      ...first,
      id: "second",
      title: "Segundo",
      memberIds: [...first.memberIds, "f"],
      result: null,
      closedAt: "2026-02-01",
    };
    storage.writeMany({
      surveys: [first, second],
      responses: [...firstResponses, ...secondResponses],
      reports: [
        {
          id: "first-report",
          accountId: account.id,
          surveyId: first.id,
          published: true,
          result,
          closedAt: first.closedAt,
        },
      ],
    });
    const response = await fetch(base + "/reports", {
      headers: { Cookie: cookie },
    });
    const reports = await response.json(),
      suppressed = reports.find((row) => row.surveyId === second.id);
    assert.equal(suppressed.published, false);
    assert.equal(suppressed.result, null);
    assert.equal(suppressed.distribution, null);
    assert.match(suppressed.suppressionReason, /sobrepostos/);
    assert.deepEqual(
      reports.find((row) => row.surveyId === first.id).result,
      result,
    );
  } finally {
    await new Promise((resolve) => server.close(resolve));
    if (
      path.resolve(directory).startsWith(path.resolve(os.tmpdir()) + path.sep)
    )
      fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("recuperação consome token e invalida todas as sessões", async () => {
  const password = require("../src/services/passwordService");
  const repo = require("../src/repositories/managementRepository");
  const actor = {
    id: "recovery-account",
    name: "Recuperação QA",
    company: "QA",
    email: "recovery@local.test",
    passwordHash: password.derive("senha-anterior-123"),
  };
  const token = crypto.randomBytes(32).toString("hex");
  storage.writeMany({
    accounts: [actor],
    sessions: [
      {
        accountId: actor.id,
        tokenHash: "old-session",
        expiresAt: Date.now() + 60000,
      },
    ],
  });
  repo.transaction(actor, "account.recovery_issued", (data) => {
    data.recovery.push({
      userId: actor.id,
      tokenHash: crypto.createHash("sha256").update(token).digest("hex"),
      expiresAt: Date.now() + 60000,
    });
    return actor;
  });
  const server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  try {
    const url = `http://127.0.0.1:${server.address().port}/api/auth/reset-password`;
    const reset = () =>
      fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password: "senha-nova-forte-123" }),
      });
    assert.equal((await reset()).status, 204);
    assert.equal(storage.read("sessions").length, 0);
    assert.equal(
      password.verify(
        "senha-nova-forte-123",
        storage.read("accounts")[0].passwordHash,
      ),
      true,
    );
    assert.equal((await reset()).status, 400);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    if (
      path.resolve(directory).startsWith(path.resolve(os.tmpdir()) + path.sep)
    )
      fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("checkout, confirmação autoritativa, idempotência e cancelamento com provedor simulado", async () => {
  const originalFetch = global.fetch;
  const previous = {
    token: process.env.MERCADOPAGO_ACCESS_TOKEN,
    secret: process.env.MERCADOPAGO_WEBHOOK_SECRET,
    url: process.env.APP_URL,
  };
  process.env.MERCADOPAGO_ACCESS_TOKEN = "token-sintetico";
  process.env.MERCADOPAGO_WEBHOOK_SECRET = "segredo-sintetico";
  process.env.APP_URL = "https://app.example.test";
  let external,
    invoiceAmount = 349,
    requests = 0;
  global.fetch = async (url, options) => {
    if (!String(url).startsWith("https://api.mercadopago.com/"))
      return originalFetch(url, options);
    requests++;
    let data;
    if (options?.method === "POST") {
      const input = JSON.parse(options.body);
      external = {
        id: "subscription-qa",
        external_reference: input.external_reference,
        auto_recurring: input.auto_recurring,
        status: "pending",
        init_point:
          "https://www.mercadopago.com.br/subscriptions/checkout?preapproval_id=subscription-qa",
      };
      data = external;
    } else if (options?.method === "PUT") {
      external.status = "cancelled";
      data = external;
    } else if (String(url).includes("/authorized_payments/"))
      data = {
        id: "invoice-qa",
        preapproval_id: external.id,
        transaction_amount: invoiceAmount,
        date_created: new Date().toISOString(),
        payment: {
          status: "approved",
          date_approved: new Date().toISOString(),
        },
      };
    else data = external;
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };
  const server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  let cookie;
  async function call(route, method = "GET", body, headers = {}) {
    const result = await originalFetch(base + route, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(cookie ? { Cookie: cookie } : {}),
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (result.headers.get("set-cookie"))
      cookie = result.headers.get("set-cookie").split(";")[0];
    return { status: result.status, body: await result.json() };
  }
  try {
    await call("/auth/register", "POST", {
      name: "Cobrança QA",
      company: "QA",
      email: "billing@local.test",
      password: "senha-teste-123",
    });
    const checkout = await call("/management/billing/checkout", "POST", {
      planId: "popular",
      amountCents: 1,
    });
    assert.equal(checkout.status, 200);
    assert.equal(external.auto_recurring.transaction_amount, 349);
    const countAfterCreate = requests;
    assert.equal(
      (
        await call("/management/billing/checkout", "POST", {
          planId: "popular",
        })
      ).body.url,
      checkout.body.url,
    );
    assert.equal(requests, countAfterCreate);
    assert.equal(
      (
        await call("/management/billing/checkout", "POST", {
          planId: "avancado",
        })
      ).status,
      409,
    );
    const local = (await call("/management/billing")).body.subscriptions[0];
    external.status = "authorized";
    const sync = await call(`/management/billing/${local.id}/sync`, "POST", {});
    assert.equal(sync.body.status, "authorized");
    assert.equal(
      sync.body.paidUntil,
      undefined,
      "autorização não comprova pagamento",
    );
    const ts = String(Date.now()),
      requestId = "billing-qa-request";
    const signature = crypto
      .createHmac("sha256", process.env.MERCADOPAGO_WEBHOOK_SECRET)
      .update(`id:invoice-qa;request-id:${requestId};ts:${ts};`)
      .digest("hex");
    const headers = {
      "x-request-id": requestId,
      "x-signature": `ts=${ts},v1=${signature}`,
    };
    const notification = {
      type: "subscription_authorized_payment",
      data: { id: "invoice-qa" },
    };
    invoiceAmount = 1;
    assert.equal(
      (
        await call(
          "/billing/webhook?data.id=invoice-qa",
          "POST",
          notification,
          headers,
        )
      ).status,
      200,
    );
    assert.equal(
      (await call("/management/billing")).body.subscriptions[0].paidUntil,
      undefined,
    );
    invoiceAmount = 349;
    await call(
      "/billing/webhook?data.id=invoice-qa",
      "POST",
      notification,
      headers,
    );
    const confirmed = (await call("/management/billing")).body.subscriptions[0];
    assert.ok(Date.parse(confirmed.paidUntil) > Date.now());
    await call(
      "/billing/webhook?data.id=invoice-qa",
      "POST",
      notification,
      headers,
    );
    assert.equal(
      (await call("/management/billing")).body.subscriptions[0]
        .processedInvoices.length,
      1,
    );
    const cancelled = await call(
      `/management/billing/${local.id}/cancel`,
      "POST",
      {},
    );
    assert.equal(cancelled.body.status, "cancelled");
    assert.equal(cancelled.body.paidUntil, confirmed.paidUntil);
  } finally {
    global.fetch = originalFetch;
    process.env.MERCADOPAGO_ACCESS_TOKEN = previous.token || "";
    process.env.MERCADOPAGO_WEBHOOK_SECRET = previous.secret || "";
    process.env.APP_URL = previous.url || "";
    await new Promise((resolve) => server.close(resolve));
    if (
      path.resolve(directory).startsWith(path.resolve(os.tmpdir()) + path.sep)
    )
      fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("retenção preserva relatórios e transação interrompida é recuperada", () => {
  const repo = require("../src/repositories/managementRepository");
  const retention = require("../src/services/retentionService");
  storage.initializeStorage();
  storage.writeMany({
    surveys: [
      {
        id: "cycle",
        accountId: "org",
        status: "closed",
        closedAt: "2020-01-01",
      },
    ],
    responses: [
      { surveyId: "cycle", accountId: "org" },
      { surveyId: "other", accountId: "other" },
    ],
    invitations: [{ surveyId: "cycle", accountId: "org" }],
    reports: [
      {
        id: "report",
        accountId: "org",
        surveyId: "cycle",
        published: true,
        result: [{ key: "demandas", average: 3 }],
      },
    ],
  });
  const account = { id: "org", userId: "user", name: "Responsável" };
  repo.transaction(account, "privacy.retention_configured", (data) => {
    data.retentionMonths = 12;
    return { id: "org" };
  });
  assert.equal(retention.preview("org").responses, 1);
  retention.purge(account);
  assert.equal(storage.read("reports")[0].result[0].average, 3);
  assert.equal(storage.read("responses").length, 1);
  assert.equal(storage.read("responses")[0].accountId, "other");
  fs.writeFileSync(
    path.join(directory, ".transaction.json"),
    JSON.stringify({ groups: [{ id: "recovered" }], sessions: [] }),
  );
  assert.equal(storage.read("groups")[0].id, "recovered");
  assert.equal(fs.existsSync(path.join(directory, ".transaction.json")), false);
  const snapshot = path.join(
    directory,
    "backups",
    new Date().toISOString().slice(0, 10),
  );
  assert.ok(fs.existsSync(path.join(snapshot, ".complete")));
  assert.ok(fs.existsSync(path.join(snapshot, "reports.json")));
  if (path.resolve(directory).startsWith(path.resolve(os.tmpdir()) + path.sep))
    fs.rmSync(directory, { recursive: true, force: true });
});
