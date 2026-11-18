const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const directory = fs.mkdtempSync(
  path.join(os.tmpdir(), "equilibra-phase0-gov-"),
);
process.env.EQUILIBRA_DATA_DIR = directory;
process.env.BILLING_ENFORCE = "false";

const app = require("../src/server");

test("EQ-002: Proposta de medida não valida avaliação automaticamente nem cria ação sem validação humana", async () => {
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

  try {
    const reg = await call("/auth/register", "POST", {
      name: "Gestor SST",
      company: "Empresa Piloto NR-1",
      email: "sst-piloto@local.test",
      password: "SenhaForte1234!",
    });
    const cookie = reg.cookie;

    // Criar 5 pessoas e grupo para compor quórum
    const ids = [];
    for (let i = 0; i < 5; i++) {
      const p = await call("/members", "POST", { name: `Colaborador ${i}` }, cookie);
      ids.push(p.body.id);
    }
    const group = (await call("/groups", "POST", { name: "Operacional", memberIds: ids }, cookie)).body;

    // Abrir e fechar pesquisa para gerar relatório publicado
    const created = await call("/surveys", "POST", {
      title: "Escuta Inicial",
      model: "Pulso mensal",
      cycle: "Ciclo 1",
      groupId: group.id,
      endsAt: new Date(Date.now() + 86400000).toISOString(),
    }, cookie);
    assert.equal(created.status, 201, "Criação de pesquisa deve retornar 201");
    const s = created.body;

    const opened = await call(`/surveys/${s.id}/open`, "POST", {}, cookie);
    assert.equal(opened.status, 200);

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
      ].map((key) => [key, 2]),
    );

    for (const link of opened.body.links) {
      const resp = await call(`/respond/${link.token}`, "POST", { answers });
      assert.equal(resp.status, 201);
    }

    // Obter relatório publicado após fechar a coleta com 5 respostas
    await call(`/surveys/${s.id}/close`, "POST", {}, cookie);
    const reports = (await call("/reports", "GET", undefined, cookie)).body;
    const report = reports.find((r) => r.surveyId === s.id);
    assert.ok(report, "Relatório publicado deve existir");

    const factorKey = report.result[0].key;

    // 1. Criar proposta de investigação (o que quick-add-solution agora faz)
    const proposalRes = await call("/management/assessments", "POST", {
      reportId: report.id,
      factor: factorKey,
      title: `Investigação: ${factorKey}`,
      context: "Sinal identificado na escuta psicossocial NR-1. Proposta sugerida.",
      existingMeasures: "Em levantamento preliminar pelo SESMT/RH.",
      decision: "Proposta preliminar. Pendente de avaliação técnica formal.",
      classification: "pending",
      status: "investigating",
    }, cookie);

    assert.equal(proposalRes.status, 201);
    const assessment = proposalRes.body;
    assert.equal(assessment.status, "investigating", "Proposta deve ter status 'investigating'");

    // 2. Tentar criar ação preventiva vinculada a essa avaliação ainda NÃO avaliada
    const actionAttempt = await call("/management/actions", "POST", {
      assessmentId: assessment.id,
      title: "Medida Não Validada",
      owner: "Gestor",
      dueDate: "2026-12-01",
      reviewDate: "2026-12-15",
      priority: "high",
      successCriteria: "Redução de queixas",
    }, cookie);

    assert.equal(
      actionAttempt.status,
      400,
      "Sistema deve bloquear criação de ação se a avaliação não estiver 'evaluated'",
    );
    assert.match(
      actionAttempt.body.error,
      /Conclua a avaliação do achado antes de planejar a ação/,
    );

    // 3. Tentar marcar como 'evaluated' sem contexto/decisão válidos
    const invalidEval = await call(`/management/assessments/${assessment.id}`, "PUT", {
      title: assessment.title,
      context: "",
      decision: "",
      status: "evaluated",
      version: assessment.version,
    }, cookie);
    assert.equal(invalidEval.status, 400, "Deve exigir contexto e decisão para avaliar");

    // 4. Realizar avaliação técnica humana formal
    const validEval = await call(`/management/assessments/${assessment.id}`, "PUT", {
      title: assessment.title,
      context: "Investigação in loco confirmou pico de demandas operacionais no fechamento mensal.",
      existingMeasures: "Pausas informais existentes sem padronização.",
      decision: "Aprovada redistribuição de tarefas e instituição de pausas regulares.",
      classification: "high",
      status: "evaluated",
      version: assessment.version,
    }, cookie);
    assert.equal(validEval.status, 200);
    assert.equal(validEval.body.status, "evaluated");

    // 5. Agora a ação pode ser planejada com integridade no PGR
    const validAction = await call("/management/actions", "POST", {
      assessmentId: assessment.id,
      title: "Redistribuição de tarefas e pausas ergonômicas",
      owner: "Eng. de Segurança / RH",
      dueDate: "2026-12-01",
      reviewDate: "2026-12-15",
      priority: "high",
      successCriteria: "Média do fator superior a 3,6 no ciclo seguinte",
    }, cookie);
    assert.equal(validAction.status, 201);
    assert.equal(validAction.body.status, "planned");
  } finally {
    server.close();
  }
});
