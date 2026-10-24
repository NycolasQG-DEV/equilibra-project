// tests/phase4-today.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { computeDecisionQueue, getGreeting, formatPortugueseDate } = require('../src/services/todayService');

test('Fase 4.1: todayService - saudação temporal e data em português', () => {
  const morning = new Date('2026-10-22T09:00:00-03:00');
  const afternoon = new Date('2026-10-22T14:30:00-03:00');
  const night = new Date('2026-10-22T20:00:00-03:00');

  assert.equal(getGreeting('Nycolas Silva', morning), 'Bom dia, Nycolas.');
  assert.equal(getGreeting('Maria Clara', afternoon), 'Boa tarde, Maria.');
  assert.equal(getGreeting('Carlos', night), 'Boa noite, Carlos.');

  const formatted = formatPortugueseDate(morning);
  assert.match(formatted, /2026/);
  assert.match(formatted, /outubro/i);
});

test('Fase 4.1: todayService - fila vazia e estado tudo em dia', () => {
  const account = { id: 'acc_1', name: 'Ana Gestora' };
  const result = computeDecisionQueue(account, {
    surveys: [],
    reports: [],
    assessments: [],
    actions: [],
    members: [{ id: 'm1' }],
    groups: [{ id: 'g1' }]
  });

  assert.equal(result.queue.length, 0);
  assert.match(result.summaryMessage, /Nenhuma pendência crítica hoje/);
  assert.equal(result.isEmpty, false);
});

test('Fase 4.1: todayService - detecta relatório pendente de aceite com prioridade alta', () => {
  const account = { id: 'acc_1', name: 'Ana Gestora' };
  const reports = [
    {
      id: 'rep_1',
      title: 'Ciclo Q3',
      cycle: '2026.3',
      published: true,
      responseCount: 15,
      acceptance: null
    }
  ];

  const result = computeDecisionQueue(account, { reports });
  const item = result.queue.find(q => q.type === 'report_pending_acceptance');
  assert.ok(item);
  assert.equal(item.priority, 'high');
  assert.match(item.title, /Formalizar aceite/);
});

test('Fase 4.1: todayService - detecta relatório publicado sem nenhuma avaliação', () => {
  const account = { id: 'acc_1', name: 'Ana Gestora' };
  const reports = [
    {
      id: 'rep_1',
      title: 'Ciclo Q3',
      cycle: '2026.3',
      published: true,
      acceptance: { acceptedAt: '2026-10-01' },
      result: [{ key: 'demandas', label: 'Demandas', average: 2.3 }]
    }
  ];

  const result = computeDecisionQueue(account, { reports, assessments: [] });
  const item = result.queue.find(q => q.type === 'report_without_assessment');
  assert.ok(item);
  assert.equal(item.priority, 'medium_high');
  assert.match(item.description, /crítica/);
});

test('Fase 4.1: todayService - detecta pesquisa próxima do encerramento com baixa adesão (< 70%)', () => {
  const account = { id: 'acc_1', name: 'Ana Gestora' };
  const now = new Date('2026-10-22T12:00:00-03:00');
  const surveys = [
    {
      id: 'srv_open',
      title: 'Pesquisa Clima e Trabalho',
      status: 'open',
      closesAt: '2026-10-24T23:59:59-03:00', // 2 dias restantes
      invitedCount: 100,
      responseCount: 40 // 40% < 70%
    }
  ];

  const result = computeDecisionQueue(account, { surveys }, now);
  const item = result.queue.find(q => q.type === 'survey_low_participation');
  assert.ok(item);
  assert.equal(item.priority, 'medium');
  assert.match(item.description, /40% de participação/);
});

test('Fase 4.1: todayService - detecta ações atrasadas e ações aguardando revisão de eficácia', () => {
  const account = { id: 'acc_1', name: 'Ana Gestora' };
  const now = new Date('2026-10-22T12:00:00-03:00');
  const actions = [
    {
      id: 'act_overdue',
      title: 'Ajustar escala de turno',
      status: 'in_progress',
      dueDate: '2026-10-15', // atrasada
      owner: 'Carlos Gerente'
    },
    {
      id: 'act_review',
      title: 'Treinamento de liderança',
      status: 'implemented',
      reviewDate: '2026-10-20' // data de revisão atingida
    }
  ];

  const result = computeDecisionQueue(account, { actions }, now);
  const overdue = result.queue.find(q => q.type === 'action_overdue');
  assert.ok(overdue);
  assert.equal(overdue.priority, 'high');
  assert.match(overdue.description, /atrasada há \d+ dia/i);

  const review = result.queue.find(q => q.type === 'action_review_due');
  assert.ok(review);
  assert.equal(review.priority, 'medium');
});

test('Fase 4.1: todayService - ordenação estrita por criticidade (high > medium_high > medium)', () => {
  const account = { id: 'acc_1', name: 'Ana Gestora' };
  const now = new Date('2026-10-22T12:00:00-03:00');
  const reports = [
    { id: 'rep_1', published: true, acceptance: null, cycle: 'C1' },
    { id: 'rep_2', published: true, acceptance: { at: 'ok' }, cycle: 'C2', result: [] }
  ];
  const actions = [
    { id: 'act_1', status: 'planned', dueDate: '2026-10-10', title: 'Ação 1' },
    { id: 'act_2', status: 'implemented', reviewDate: '2026-10-20', title: 'Ação 2' }
  ];

  const result = computeDecisionQueue(account, { reports, actions, assessments: [] }, now);
  const priorities = result.queue.map(q => q.priority);
  
  // Confirma que high vem antes de medium_high, e medium_high vem antes de medium
  assert.ok(priorities.indexOf('high') <= priorities.indexOf('medium_high'));
  assert.ok(priorities.indexOf('medium_high') <= priorities.indexOf('medium'));
});

test('Fase 4.1: Integração HTTP - GET /api/today autenticado retorna fila e kpis', async (t) => {
  const fs = require('node:fs');
  const os = require('node:os');
  const path = require('node:path');
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'equilibra-phase4-'));
  process.env.EQUILIBRA_DATA_DIR = directory;
  const app = require('../src/server');
  const storage = require('../src/config/equilibraStorage');
  storage.initializeStorage();

  let server;
  let baseUrl;
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}/api`;
      resolve();
    });
  });
  t.after(() => new Promise((resolve) => server.close(resolve)));

  // Tenta sem auth -> 401
  const resUnauth = await fetch(`${baseUrl}/today`);
  assert.equal(resUnauth.status, 401);

  // Registra conta de teste
  const regRes = await fetch(`${baseUrl}/auth/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      company: 'Empresa Teste Hoje',
      name: 'Diretora RH',
      email: 'rh@empresahoje.com',
      password: 'SenhaForte1234!'
    })
  });
  assert.equal(regRes.status, 201);
  const cookie = regRes.headers.get('set-cookie');

  // Consulta /today autenticado
  const resToday = await fetch(`${baseUrl}/today`, {
    headers: { cookie }
  });
  assert.equal(resToday.status, 200);
  const data = await resToday.json();

  assert.ok(data.greeting.includes('Diretora'));
  assert.ok(Array.isArray(data.queue));
  assert.ok(data.kpis);
  assert.ok(data.charts);
});
