/**
 * FASE 06 — Motor de Avaliação de Riscos Psicossociais (EQ-009)
 *
 * Testa a matriz NR-1 (severidade × probabilidade):
 * - Criação de achado vinculado a resultado publicado
 * - Separação de 4 camadas (status inicia como 'investigating', nunca auto-avaliado)
 * - Validação explícita pelo avaliador (status → 'evaluated')
 * - Isolamento multilocatário
 * - Validações de campos
 */

'use strict';

const assert = require('node:assert/strict');
const { describe, it, before, after } = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'equilibra-phase6-risk-'));
process.env.EQUILIBRA_DATA_DIR = directory;
process.env.BILLING_ENFORCE = 'false';
process.env.GROQ_API_KEY = '';
process.env.AI_MODEL = '';

const app = require('../src/server');

// ─── Helper ───────────────────────────────────────────────────────────────────
async function call(base, route, method = 'GET', body, session) {
  const response = await fetch(base + route, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(session ? { Cookie: session } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return {
    status: response.status,
    body: response.status === 204 ? null : await response.json().catch(() => null),
    cookie: response.headers.get('set-cookie')?.split(';')[0],
  };
}

async function register(base, email) {
  const r = await call(base, '/auth/register', 'POST', {
    name: 'Avaliador Teste',
    email,
    password: 'Senha@123!ABC',
    company: 'Empresa Teste',
  });
  assert.equal(r.status, 201, `Registro falhou: ${JSON.stringify(r.body)}`);
  return { cookie: r.cookie, account: r.body };
}

/** Cria ciclo completo e retorna reportId publicado */
async function createPublishedReport(base, cookie) {
  // Criar 5 membros
  const memberIds = [];
  for (let i = 0; i < 5; i++) {
    const m = await call(base, '/members', 'POST', { name: `Colaborador ${i}`, email: `c${i}-${Date.now()}@test.com` }, cookie);
    assert.equal(m.status, 201);
    memberIds.push(m.body.id);
  }

  // Criar grupo
  const g = await call(base, '/groups', 'POST', { name: 'Grupo Teste', memberIds }, cookie);
  assert.equal(g.status, 201);

  // Criar e abrir pesquisa
  const sv = await call(base, '/surveys', 'POST', {
    title: 'Pesquisa Risco Fase 06',
    model: 'Pulso mensal',
    cycle: 'Ciclo Fase 06',
    groupId: g.body.id,
    endsAt: new Date(Date.now() + 86400000).toISOString(),
  }, cookie);
  assert.equal(sv.status, 201);

  const opened = await call(base, `/surveys/${sv.body.id}/open`, 'POST', {}, cookie);
  assert.equal(opened.status, 200);

  // Responder (5 respostas)
  const answers = { demandas: 1, autonomia: 1, apoio: 1, relacoes: 1, reconhecimento: 1, jornada: 1, mudancas: 1, seguranca: 1 };
  for (const link of opened.body.links) {
    const r = await call(base, `/respond/${link.token}`, 'POST', { answers });
    assert.equal(r.status, 201);
  }

  // Fechar pesquisa
  const closed = await call(base, `/surveys/${sv.body.id}/close`, 'POST', {}, cookie);
  assert.equal(closed.status, 200);

  // Relatório gerado automaticamente no encerramento
  const reports = await call(base, '/reports', 'GET', null, cookie);
  assert.equal(reports.status, 200);
  const report = reports.body.find((r) => r.surveyId === sv.body.id);
  assert.ok(report, 'Relatório não encontrado após fechar pesquisa');
  assert.equal(report.published, true, 'Relatório com quórum atingido deve nascer publicado');

  return { reportId: report.id, report };
}

// ─── Suíte ───────────────────────────────────────────────────────────────────

describe('FASE 06 — Motor de Avaliação de Riscos NR-1', () => {
  let server, base, tenantA, tenantB, reportId;

  before(async () => {
    server = app.listen(0);
    await new Promise((res) => server.once('listening', res));
    base = `http://127.0.0.1:${server.address().port}/api`;
    tenantA = await register(base, `risk-a-${Date.now()}@test.com`);
    tenantB = await register(base, `risk-b-${Date.now()}@test.com`);
    // Criar ciclo completo para tenant A
    const result = await createPublishedReport(base, tenantA.cookie);
    reportId = result.reportId;
  });

  after(() => server.close());

  // ── 1. Criar achado de risco — status inicial = 'investigating' ───────
  it('cria achado de risco com status inicial "investigating" (nunca auto-avaliado)', async () => {
    const r = await call(base, '/management/assessments', 'POST', {
      reportId,
      factor: 'demandas',
      title: 'Alta demanda cognitiva — setor operacional',
      severity: 4,
      probability: 3,
      riskScore: 12,
      riskLevel: 'medio',
      groupExposed: 'Setor Operacional',
      hazard: 'Sobrecarga de tarefas simultâneas',
      consequence: 'Esgotamento emocional, afastamentos',
      context: 'Dados observados: média de demandas abaixo de 3.0',
      existingMeasures: 'Apenas pausas formais, sem programa estruturado',
      classification: 'high',
      status: 'investigating',
    }, tenantA.cookie);

    assert.equal(r.status, 201, JSON.stringify(r.body));
    assert.ok(r.body.id);
    assert.equal(r.body.status, 'investigating', 'Status deve iniciar como investigating');
    assert.notEqual(r.body.status, 'evaluated', 'Sistema NUNCA auto-avalia achado de risco');
  });

  // ── 2. Listar achados — tenant A vê os seus ───────────────────────────
  it('lista achados do workspace do tenant A', async () => {
    const ws = await call(base, '/management/workspace', 'GET', null, tenantA.cookie);
    assert.equal(ws.status, 200);
    assert.ok(Array.isArray(ws.body.assessments));
    assert.ok(ws.body.assessments.length >= 1);
  });

  // ── 3. Isolamento — tenant B não vê achados de A ─────────────────────
  it('tenant B tem workspace isolado — não vê achados de A', async () => {
    const ws = await call(base, '/management/workspace', 'GET', null, tenantB.cookie);
    assert.equal(ws.status, 200);
    assert.equal(ws.body.assessments.length, 0, 'Tenant B não deve ver achados de Tenant A');
  });

  // ── 4. Status 'evaluated' só via ação humana explícita ───────────────
  it('concluir avaliação com status "evaluated" exige contexto e decisão', async () => {
    // Buscar o achado criado
    const ws = await call(base, '/management/workspace', 'GET', null, tenantA.cookie);
    const achado = ws.body.assessments.find((a) => a.status === 'investigating');
    assert.ok(achado, 'Achado em investigação não encontrado');

    // Tentar avaliar sem decisão — deve falhar
    const sem = await call(base, `/management/assessments/${achado.id}`, 'PUT', {
      reportId: achado.reportId,
      factor: achado.factor,
      title: achado.title,
      classification: achado.classification,
      status: 'evaluated',
      version: achado.version,
      // Sem context e decision
    }, tenantA.cookie);
    assert.equal(sem.status, 400, 'Deve rejeitar avaliação sem contexto/decisão');
    assert.ok(sem.body.error?.toLowerCase().includes('context') || sem.body.error?.toLowerCase().includes('decisão') || sem.body.error?.toLowerCase().includes('context'),
      `Esperado erro de validação, obtido: ${sem.body.error}`);
  });

  // ── 5. Avaliação bem-sucedida com decisão técnica ─────────────────────
  it('conclui avaliação com decisão técnica explícita → status "evaluated"', async () => {
    const ws = await call(base, '/management/workspace', 'GET', null, tenantA.cookie);
    const achado = ws.body.assessments.find((a) => a.status === 'investigating');
    assert.ok(achado);

    const r = await call(base, `/management/assessments/${achado.id}`, 'PUT', {
      reportId: achado.reportId,
      factor: achado.factor,
      title: achado.title,
      classification: achado.classification,
      context: 'Média de demandas abaixo do limiar operacional; histórico de afastamentos confirma.',
      decision: 'Encaminhar para programa de gestão de demandas — responsável: RH, prazo: 30 dias.',
      existingMeasures: achado.existingMeasures,
      status: 'evaluated',
      version: achado.version,
    }, tenantA.cookie);

    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal(r.body.status, 'evaluated');
  });

  // ── 6. Fator fora do resultado deve ser rejeitado ─────────────────────
  it('rejeita fator que não pertence ao resultado da pesquisa', async () => {
    const r = await call(base, '/management/assessments', 'POST', {
      reportId,
      factor: 'fator_inexistente_xyzw',
      title: 'Achado inválido',
      status: 'investigating',
      classification: 'pending',
    }, tenantA.cookie);
    assert.equal(r.status, 400);
  });

  // ── 7. Duplicate assessment para mesmo fator+report rejeitado ────────
  it('rejeita achado duplicado para mesmo fator e resultado', async () => {
    // O factor 'demandas' já tem achado ativo (criado no teste 1 e avaliado no 5)
    // O sistema proíbe duplicatas ativas
    const r = await call(base, '/management/assessments', 'POST', {
      reportId,
      factor: 'demandas',
      title: 'Duplicata de demandas',
      status: 'investigating',
      classification: 'pending',
    }, tenantA.cookie);
    // Deve retornar 409 pois já existe achado ativo (evaluated) para esse fator
    assert.equal(r.status, 409, `Esperado 409 para duplicata, obtido ${r.status}: ${JSON.stringify(r.body)}`);
  });

  // ── 8. Acesso sem sessão retorna 401 ─────────────────────────────────
  it('retorna 401 ao acessar assessments sem sessão', async () => {
    const r = await call(base, '/management/workspace', 'GET', null, null);
    assert.ok([401, 403].includes(r.status), `Esperado 401/403, obtido ${r.status}`);
  });
});
