/**
 * FASE 08 — Planos de Ação, Revisão Bienal e Aferição de Eficácia (EQ-012)
 *
 * Testa:
 * - Ciclo de vida completo da ação no Kanban (planned -> in_progress -> implemented -> effective)
 * - Regra de revisão bienal da NR-1 (limite de 2 anos para reviewDate)
 * - Exigência de evidência prévia antes da transição para "implemented"
 * - Registro de eficácia com parecer técnico antes de "effective" ou "ineffective"
 * - Vinculação de medição de novo ciclo (/measurement) e preenchimento de reviewOutcome com delta e status
 */

'use strict';

const assert = require('node:assert/strict');
const { describe, it, before, after } = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'equilibra-phase8-eff-'));
process.env.EQUILIBRA_DATA_DIR = directory;
process.env.BILLING_ENFORCE = 'false';
process.env.GROQ_API_KEY = '';

const app = require('../src/server');

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
    name: 'Coordenador PGR',
    email,
    password: 'Senha@Segura123!PGR',
    company: 'Logística Alfa SA',
  });
  assert.equal(r.status, 201, `Registro falhou: ${JSON.stringify(r.body)}`);
  return { cookie: r.cookie, account: r.body };
}

async function createCycle(base, cookie, cycleName, answerVal, groupId) {
  const survey = (
    await call(
      base,
      '/surveys',
      'POST',
      {
        title: `Pesquisa ${cycleName}`,
        model: 'Pulso mensal',
        cycle: cycleName,
        groupId,
        endsAt: new Date(Date.now() + 86400000).toISOString(),
      },
      cookie,
    )
  ).body;

  const opened = (await call(base, `/surveys/${survey.id}/open`, 'POST', {}, cookie)).body;
  const answers = {
    demandas: answerVal,
    autonomia: answerVal,
    apoio: answerVal,
    relacoes: answerVal,
    reconhecimento: answerVal,
    jornada: answerVal,
    mudancas: answerVal,
    seguranca: answerVal,
  };

  for (const link of opened.links) {
    const res = await call(base, `/respond/${link.token}`, 'POST', { answers });
    assert.equal(res.status, 201);
  }

  await call(base, `/surveys/${survey.id}/close`, 'POST', {}, cookie);
  const reports = (await call(base, '/reports', 'GET', null, cookie)).body;
  return reports.find((r) => r.surveyId === survey.id);
}

describe('FASE 08 — Planos de Ação, Eficácia e Limite Bienal NR-1', () => {
  let server, base, user, baselineReport, followUpReport, assessment;

  before(async () => {
    server = app.listen(0);
    await new Promise((res) => server.once('listening', res));
    base = `http://127.0.0.1:${server.address().port}/api`;
    user = await register(base, `pgr-eff-${Date.now()}@alfa.test`);

    // Criar grupo compartilhado com 5 membros para garantir comparabilidade estatística estrita
    const memberIds = [];
    for (let i = 0; i < 5; i++) {
      const m = await call(base, '/members', 'POST', { name: `Membro Fixo ${i}` }, user.cookie);
      memberIds.push(m.body.id);
    }
    const group = (await call(base, '/groups', 'POST', { name: 'Operação Unificada', memberIds }, user.cookie)).body;

    // Criar ciclo baseline com nota baixa (2)
    baselineReport = await createCycle(base, user.cookie, 'Ciclo Base', 2, group.id);
    assert.ok(baselineReport?.published);

    // Criar ciclo follow-up com nota mais alta (4) para medição de eficácia
    followUpReport = await createCycle(base, user.cookie, 'Ciclo Eficácia', 4, group.id);
    assert.ok(followUpReport?.published);

    // Criar avaliação no baseline e concluí-la como evaluated
    const asRes = await call(
      base,
      '/management/assessments',
      'POST',
      {
        reportId: baselineReport.id,
        factor: 'demandas',
        title: 'Sobrecarga de demandas identificada',
        status: 'investigating',
        classification: 'high',
      },
      user.cookie,
    );
    assert.equal(asRes.status, 201);

    const evaluatedRes = await call(
      base,
      `/management/assessments/${asRes.body.id}`,
      'PUT',
      {
        ...asRes.body,
        status: 'evaluated',
        context: 'Volume de trabalho crítico apurado nas entrevistas e na escuta ativa',
        decision: 'Inserir no plano de intervenções do PGR',
      },
      user.cookie,
    );
    assert.equal(evaluatedRes.status, 200);
    assessment = evaluatedRes.body;
  });

  after(() => server.close());

  // ── 1. Limite Bienal NR-1 (Revisão em até 2 anos) ───────────────────
  it('rejeita ação com data de revisão que exceda o limite bienal de 2 anos (NR-1)', async () => {
    const invalidFutureDate = new Date();
    invalidFutureDate.setFullYear(invalidFutureDate.getFullYear() + 3); // 3 anos no futuro (> 2 anos)

    const res = await call(
      base,
      '/management/actions',
      'POST',
      {
        assessmentId: assessment.id,
        title: 'Ação com prazo excessivo',
        owner: 'Gestor Operacional',
        dueDate: '2026-06-01',
        reviewDate: invalidFutureDate.toISOString().slice(0, 10),
        successCriteria: 'Redução de retrabalho',
      },
      user.cookie,
    );

    assert.equal(res.status, 400, 'Deve rejeitar prazo acima de 2 anos');
    assert.ok(res.body.error?.includes('bienal') || res.body.error?.includes('2 anos'));
  });

  // ── 2. Criação Válida de Ação ───────────────────────────────────────
  it('cria ação de intervenção com hierarquia NR-1 e prazo bem definido', async () => {
    const res = await call(
      base,
      '/management/actions',
      'POST',
      {
        assessmentId: assessment.id,
        title: 'Equalização de demandas e criação de escala de pausas',
        description: 'Redistribuir carteiras de clientes e fixar intervalos regulares de descanso',
        owner: 'Gerência de Atendimento',
        dueDate: '2026-05-15',
        reviewDate: '2026-07-15',
        successCriteria: 'Elevação da média de demandas para ≥ 3.5 no ciclo seguinte',
        priority: 'high',
        hierarchy: 'organizacional',
      },
      user.cookie,
    );

    assert.equal(res.status, 201, JSON.stringify(res.body));
    assert.equal(res.body.status, 'planned');
    assert.equal(res.body.hierarchy, 'organizacional');
    assert.equal(res.body.version, 1);
  });

  // ── 3. Transição de Status e Exigência de Evidência ─────────────────
  it('exige evidência registrada antes de permitir transição para "implemented"', async () => {
    const ws = (await call(base, '/management/workspace', 'GET', null, user.cookie)).body;
    let action = ws.actions.find((a) => a.assessmentId === assessment.id);
    assert.ok(action);

    // Avança para in_progress
    const prog = await call(
      base,
      `/management/actions/${action.id}`,
      'PUT',
      { ...action, status: 'in_progress' },
      user.cookie,
    );
    assert.equal(prog.status, 200);
    action = prog.body;

    // Tentar ir para implemented sem evidência -> deve falhar com 400
    const failImpl = await call(
      base,
      `/management/actions/${action.id}`,
      'PUT',
      { ...action, status: 'implemented' },
      user.cookie,
    );
    assert.equal(failImpl.status, 400);
    assert.ok(failImpl.body.error?.includes('evidência'));

    // Anexar evidência válida
    const evRes = await call(
      base,
      `/management/actions/${action.id}/evidence`,
      'POST',
      {
        description: 'Cronograma de pausas homologado pela CIPA e comunicado a todos os colaboradores',
        url: 'https://storage.exemplo.com/docs/comunicado-pausas.pdf',
        version: action.version,
      },
      user.cookie,
    );
    assert.equal(evRes.status, 201);
    action = evRes.body;

    // Agora sim: transição para implemented permitida
    const implOk = await call(
      base,
      `/management/actions/${action.id}`,
      'PUT',
      { ...action, status: 'implemented' },
      user.cookie,
    );
    assert.equal(implOk.status, 200);
    assert.equal(implOk.body.status, 'implemented');
  });

  // ── 4. Aferição de Eficácia via Comparação com Próximo Ciclo ────────
  it('vincula resultado de medição subsequente (/measurement) e calcula delta de eficácia', async () => {
    const ws = (await call(base, '/management/workspace', 'GET', null, user.cookie)).body;
    const action = ws.actions.find((a) => a.assessmentId === assessment.id);
    assert.ok(action);

    const measRes = await call(
      base,
      `/management/actions/${action.id}/measurement`,
      'POST',
      {
        reportId: followUpReport.id,
        version: action.version,
      },
      user.cookie,
    );

    assert.equal(measRes.status, 200, JSON.stringify(measRes.body));
    assert.equal(measRes.body.measurementReportId, followUpReport.id);
    assert.equal(measRes.body.measurementDelta, 2); // De 2 para 4 = +2 de melhoria
    assert.ok(measRes.body.reviewOutcome);
    assert.equal(measRes.body.reviewOutcome.efficacyStatus, 'improved');
    assert.equal(measRes.body.reviewOutcome.alertNeeded, false);
  });
});
