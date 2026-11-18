const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const directory = fs.mkdtempSync(
  path.join(os.tmpdir(), "equilibra-phase2-tenant-"),
);
process.env.EQUILIBRA_DATA_DIR = directory;
process.env.BILLING_ENFORCE = "false";

const app = require("../src/server");

test("EQ-005: Isolamento multi-tenant rigoroso e proteção contra IDOR em todas as entidades", async () => {
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
    // 1. Cadastrar Tenant A
    const tenantA = await call("/auth/register", "POST", {
      name: "Gestor A",
      company: "Empresa Alfa SA",
      email: "gestor.alfa@alfa.test",
      password: "SenhaSeguraAlfa123!",
    });
    const cookieA = tenantA.cookie;

    // 2. Cadastrar Tenant B (Atacante ou outra empresa legítima)
    const tenantB = await call("/auth/register", "POST", {
      name: "Gestor B",
      company: "Empresa Beta Ltda",
      email: "gestor.beta@beta.test",
      password: "SenhaSeguraBeta456!",
    });
    const cookieB = tenantB.cookie;

    // 3. Tenant A popula dados: membros, grupo, pesquisa e ciclo
    const idsA = [];
    for (let i = 0; i < 5; i++) {
      const p = await call("/members", "POST", { name: `Colaborador Alfa ${i}`, email: `colab${i}@alfa.test` }, cookieA);
      idsA.push(p.body.id);
    }
    const memberAId = idsA[0];

    const groupA = (await call("/groups", "POST", { name: "Operação Alfa", memberIds: idsA }, cookieA)).body;

    const surveyA = (await call("/surveys", "POST", {
      title: "Pesquisa Alfa 2026",
      model: "Pulso mensal",
      cycle: "Ciclo Alfa 1",
      groupId: groupA.id,
      endsAt: new Date(Date.now() + 86400000).toISOString(),
    }, cookieA)).body;

    const openedA = (await call(`/surveys/${surveyA.id}/open`, "POST", {}, cookieA)).body;

    // Responder questionários de Alfa
    const answers = { demandas: 3, autonomia: 3, apoio: 3, relacoes: 3, reconhecimento: 3, jornada: 3, mudancas: 3, seguranca: 3 };
    for (const link of openedA.links) {
      await call(`/respond/${link.token}`, "POST", { answers });
    }

    // Fechar e publicar relatório
    await call(`/surveys/${surveyA.id}/close`, "POST", {}, cookieA);
    const reportsA = (await call("/reports", "GET", undefined, cookieA)).body;
    const reportA = reportsA.find(r => r.surveyId === surveyA.id);
    assert.ok(reportA, "Relatório da Empresa Alfa deve existir");

    // Avaliação e ação em Alfa
    const factorKey = reportA.result[0].key;
    const assessmentA = (await call("/management/assessments", "POST", {
      reportId: reportA.id,
      factor: factorKey,
      title: `Avaliação Alfa - ${factorKey}`,
      context: "Contexto validado pela engenharia de segurança.",
      existingMeasures: "Pausas regulares.",
      decision: "Redistribuição de demandas.",
      classification: "high",
      status: "evaluated",
    }, cookieA)).body;

    const actionA = (await call("/management/actions", "POST", {
      assessmentId: assessmentA.id,
      title: "Ação Alfa de Prevenção",
      owner: "RH Alfa",
      dueDate: "2026-12-01",
      reviewDate: "2026-12-15",
      priority: "high",
      successCriteria: "Melhoria no clima",
    }, cookieA)).body;

    // ────────────────────────────────────────────────────────────────
    // TESTES NEGATIVOS DE ISOLAMENTO (TENANT B TENTANDO ACESSAR TENANT A)
    // ────────────────────────────────────────────────────────────────

    // 1. Membros
    assert.equal((await call("/members", "GET", undefined, cookieB)).body.length, 0);
    assert.equal((await call(`/members/${memberAId}`, "GET", undefined, cookieB)).status, 404);
    assert.equal((await call(`/members/${memberAId}`, "PUT", { name: "Hacked" }, cookieB)).status, 404);
    assert.equal((await call(`/members/${memberAId}`, "DELETE", undefined, cookieB)).status, 404);

    // 2. Grupos
    const groupsB = (await call("/groups", "GET", undefined, cookieB)).body;
    assert.equal(groupsB.filter(g => !g.isDefault).length, 0, "Tenant B não deve ter grupos customizados");
    assert.equal(groupsB.some(g => g.id === groupA.id), false, "Tenant B não deve ver o grupo da Empresa Alfa");
    assert.equal((await call(`/groups/${groupA.id}`, "GET", undefined, cookieB)).status, 404);
    assert.equal((await call(`/groups/${groupA.id}`, "PUT", { name: "Grupo Beta Hack" }, cookieB)).status, 404);
    assert.equal((await call(`/groups/${groupA.id}`, "DELETE", undefined, cookieB)).status, 404);

    // 3. Pesquisas
    assert.equal((await call("/surveys", "GET", undefined, cookieB)).body.length, 0);
    assert.equal((await call(`/surveys/${surveyA.id}`, "GET", undefined, cookieB)).status, 404);
    assert.equal((await call(`/surveys/${surveyA.id}/open`, "POST", {}, cookieB)).status, 404);
    assert.equal((await call(`/surveys/${surveyA.id}/links`, "GET", undefined, cookieB)).status, 404);
    assert.equal((await call(`/surveys/${surveyA.id}/close`, "POST", {}, cookieB)).status, 404);

    // 4. Relatórios e Exports
    assert.equal((await call("/reports", "GET", undefined, cookieB)).body.length, 0);
    assert.equal((await call(`/reports/${reportA.id}`, "GET", undefined, cookieB)).status, 404);
    assert.equal((await call(`/reports/${reportA.id}/export?format=pdf`, "GET", undefined, cookieB)).status, 404);
    assert.equal((await call(`/reports/${reportA.id}/export?format=xlsx`, "GET", undefined, cookieB)).status, 404);
    assert.equal((await call(`/reports/${reportA.id}/export?format=csv`, "GET", undefined, cookieB)).status, 404);
    assert.equal((await call(`/reports/${reportA.id}/export?format=json`, "GET", undefined, cookieB)).status, 404);

    // 5. Gestão de Riscos e Planos de Ação (NR-1)
    // Tenant B tentando criar assessment apontando para report da Empresa Alfa
    const crossReportAssess = await call("/management/assessments", "POST", {
      reportId: reportA.id,
      factor: factorKey,
      title: "Ataque Cross-Tenant",
      context: "Contexto",
      decision: "Decisao",
      status: "evaluated",
    }, cookieB);
    assert.equal(crossReportAssess.status, 400, "Tentativa de criar avaliação em report alheio deve falhar");

    // Tenant B tentando alterar avaliação da Empresa Alfa
    const crossAssessPut = await call(`/management/assessments/${assessmentA.id}`, "PUT", {
      title: "Alterado por Beta",
      context: "Invasão",
      decision: "Hack",
      status: "evaluated",
      version: assessmentA.version,
    }, cookieB);
    assert.equal(crossAssessPut.status, 404, "Tentativa de alterar avaliação alheia deve retornar 404 (não encontrada no tenant)");

    // Tenant B tentando vincular ação à avaliação da Empresa Alfa
    const crossActionCreate = await call("/management/actions", "POST", {
      assessmentId: assessmentA.id,
      title: "Ação Invasora",
      owner: "Beta",
      dueDate: "2026-12-01",
      reviewDate: "2026-12-15",
      priority: "high",
      successCriteria: "Violação",
    }, cookieB);
    assert.equal(crossActionCreate.status, 404, "Tentativa de criar ação em avaliação alheia deve retornar 404 (avaliação não encontrada no tenant)");

    // Tenant B tentando editar ação da Empresa Alfa
    const crossActionPut = await call(`/management/actions/${actionA.id}`, "PUT", {
      title: "Ação Alfa Adulterada",
      owner: "Beta",
      dueDate: "2026-12-01",
      reviewDate: "2026-12-15",
      priority: "high",
      status: "in_progress",
      successCriteria: "Alterado",
    }, cookieB);
    assert.equal(crossActionPut.status, 404, "Tentativa de editar ação alheia deve retornar 404 (não encontrada no tenant)");

  } finally {
    server.close();
  }
});
