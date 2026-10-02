// End-to-end smoke test against the configured Supabase project. Creates and removes isolated data.
require("@next/env").loadEnvConfig(process.cwd());
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const jwt = require("jsonwebtoken");
const { createClient } = require("@supabase/supabase-js");

const base = process.env.PRODUCT_TEST_URL || "http://localhost:3107";
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const userId = randomUUID();
const created = { organizationId: "", templateId: "", runIds: [] };

async function call(path, method = "GET", input, token) {
  const response = await fetch(base + path, {
    method,
    headers: {
      Origin: base,
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(input === undefined ? {} : { body: JSON.stringify(input) }),
  });
  const data = await response.json();
  assert.equal(response.ok, true, `${method} ${path}: ${response.status} ${JSON.stringify(data)}`);
  return data;
}

async function expectError(path, method, input, token, status) {
  const response = await fetch(base + path, {
    method,
    headers: { Origin: base, "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(input === undefined ? {} : { body: JSON.stringify(input) }),
  });
  assert.equal(response.status, status, `${method} ${path} should return ${status}`);
}

async function cleanup() {
  const failures = [];
  const remove = async (table, column, value) => {
    const { error } = await db.from(table).delete().eq(column, value);
    if (error) failures.push(`${table}: ${error.message}`);
  };
  const { data: ownedRuns, error: ownedRunsError } = created.organizationId
    ? await db.from("product_runs").select("id").eq("organization_id", created.organizationId)
    : { data: [], error: null };
  if (ownedRunsError) failures.push(`product_runs: ${ownedRunsError.message}`);
  for (const runId of new Set([...created.runIds, ...(ownedRuns || []).map((run) => run.id)])) {
    await remove("management_actions", "batch_id", runId);
    await remove("product_answers", "run_id", runId);
    await remove("product_invites", "run_id", runId);
    await remove("product_runs", "id", runId);
  }
  if (created.organizationId) await remove("product_templates", "organization_id", created.organizationId);
  if (created.organizationId) await remove("product_organizations", "id", created.organizationId);
  await remove("users", "id", userId);
  if (failures.length) throw new Error(`Falha ao limpar teste: ${failures.join("; ")}`);
}

async function main() {
  const { error } = await db.from("users").insert({
    id: userId, name: "MVP Smoke", email: `${userId}@example.invalid`,
    password_hash: "unused", role: "admin", plan: "enterprise", max_colaboradores: 9999,
  });
  if (error) throw error;
  try {
    const token = jwt.sign({ userId, email: `${userId}@example.invalid`, role: "admin", name: "MVP Smoke", plan: "enterprise" }, process.env.JWT_SECRET, { algorithm: "HS256", expiresIn: "5m" });
    const organization = await call("/api/product", "POST", { action: "organization", name: "Empresa de teste MVP" }, token);
    created.organizationId = organization.id;
    await expectError("/api/product", "POST", { action: "organization", name: "Outra empresa" }, token, 409);
    const draft = await call("/api/product", "POST", { action: "draft", kind: "master" }, token);
    assert.ok(draft.questions.length >= 5);
    await expectError("/api/product", "POST", {
      action: "template", organizationId: organization.id, kind: "master", title: "Pesquisa insegura",
      questions: draft.questions.map((question, index) => index === 0 ? { ...question, text: "Qual é o seu nome e CPF para esta pesquisa?" } : question),
    }, token, 400);
    const template = await call("/api/product", "POST", {
      action: "template", organizationId: organization.id, kind: "master", title: "Avaliação de teste",
      questions: draft.questions, invitesPerRun: 5,
    }, token);
    created.templateId = template.id;
    await call("/api/product", "POST", {
      action: "save-sector", organizationId: organization.id, name: "Operação de teste",
      roles: ["Equipe"], routineDescription: "Rotina sintética de testes",
    }, token);
    const scheduled = await call("/api/product", "POST", {
      action: "schedule-run", templateId: template.id, sector: "Teste",
      scheduledAt: new Date(Date.now() + 86400000).toISOString(), repeat: "weekly", repeatCount: 2,
    }, token);
    assert.equal(scheduled.scheduled, 2);
    const run = await call("/api/product", "POST", { action: "run", templateId: template.id, sector: "Teste", quantity: 5 }, token);
    created.runIds.push(run.runId);
    assert.equal(run.tokens.length, 5);
    await call('/api/product', 'POST', { action: 'update-template', templateId: template.id, title: 'Modelo revisado', description: 'Revisão para novas campanhas', questions: draft.questions.map((q,i)=>i===0?{...q,text:'Nas últimas semanas você recebeu orientações claras para o trabalho?'}:q) }, token);
    const originalRun = await call(`/api/product/public/${run.tokens[0]}`);
    assert.equal(originalRun.questions[0].text, draft.questions[0].text, 'Edição da biblioteca não deve alterar campanha existente');
    const overview = await call("/api/product", "GET", undefined, token);
    assert.equal(overview.runs.find((item) => item.id === run.runId)?.invited, 5);
    for (const inviteToken of run.tokens) {
      const survey = await call(`/api/product/public/${inviteToken}`);
      const answers = Object.fromEntries(survey.questions.map((question) => [question.id, question.type === "likert" ? 3 : "Ambiente de trabalho bom"]));
      await call(`/api/product/public/${inviteToken}`, "POST", { consent: true, answers });
    }
    await expectError(`/api/product/public/${run.tokens[0]}`, "GET", undefined, undefined, 404);
    await call("/api/product", "POST", { action: "close", runId: run.runId }, token);
    const results = await call(`/api/product/results/${run.runId}`, "GET", undefined, token);
    assert.equal(results.released, true);
    assert.equal(results.completed, 5);
    assert.ok(results.questions.some((question) => question.count === 5));
    assert.ok(results.findings.length > 0);
    await call('/api/product/actions', 'POST', { runId: run.runId, dimensionId: results.findings[0].id, owner: 'Gestão de teste', dueDate: new Date(Date.now() + 86400000).toISOString().slice(0,10) }, token);
    const board = await call('/api/product/dashboard', 'GET', undefined, token);
    assert.equal(board.actions.length, 1);
    assert.equal(board.reports.find((item) => item.id === run.runId)?.completed, 5);
    await expectError('/api/product/actions', 'PATCH', { id: board.actions[0].id, status: 'done', evidence: '' }, token, 400);
    await call('/api/product/actions', 'PATCH', { id: board.actions[0].id, status: 'done', evidence: 'Revisão de prioridades registrada pela equipe.' }, token);
    const updatedBoard = await call('/api/product/dashboard', 'GET', undefined, token);
    assert.equal(updatedBoard.actions[0].status, 'done');
    const small = await call("/api/product", "POST", { action: "run", templateId: template.id, sector: "Teste pequeno", quantity: 4 }, token);
    created.runIds.push(small.runId);
    for (const inviteToken of small.tokens) {
      const survey = await call(`/api/product/public/${inviteToken}`);
      const answers = Object.fromEntries(survey.questions.map((question) => [question.id, question.type === "likert" ? 4 : "Carga elevada"]));
      await call(`/api/product/public/${inviteToken}`, "POST", { consent: true, answers });
    }
    await call("/api/product", "POST", { action: "close", runId: small.runId }, token);
    const protectedResults = await call(`/api/product/results/${small.runId}`, "GET", undefined, token);
    assert.equal(protectedResults.released, false);
    assert.ok(protectedResults.questions.every((question) => question.count === null));
    assert.equal(protectedResults.actionSuggestions.length, 0);
    await call('/api/product', 'POST', { action: 'disable', templateId: template.id }, token);
    await expectError('/api/product', 'POST', { action: 'run', templateId: template.id, sector: 'Teste', quantity: 5 }, token, 404);
    await expectError('/api/product/actions', 'POST', { runId: small.runId, dimensionId: results.findings[0].id, owner: 'Gestão', dueDate: '2099-01-01' }, token, 409);
    console.log("MVP smoke: organização, pesquisa, convites, respostas e resultados OK");
  } finally {
    await cleanup();
  }
}

main().catch((error) => { console.error("MVP smoke falhou:", error.message); process.exitCode = 1; });
