const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const ExcelJS = require('exceljs');

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'equilibra-phase3-'));
process.env.EQUILIBRA_DATA_DIR = tempDir;

const app = require('../src/server');
const storage = require('../src/config/equilibraStorage');
const { derive } = require('../src/services/passwordService');
const { generateCsv, generateXlsx, generatePdf, generateJson } = require('../src/services/reportExportService');

let server;
let baseUrl;

async function call(urlPath, method = 'GET', body, cookie) {
  const headers = {};
  if (cookie) headers.cookie = cookie;
  if (body !== undefined) headers['content-type'] = 'application/json';
  const res = await fetch(`${baseUrl}${urlPath}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch (_) {}
  return { status: res.status, headers: res.headers, body: json, text };
}

test('Fase 3: Exportação e Aceite do Relatório', async (t) => {
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}/api`;
      resolve();
    });
  });

  t.after(() => {
    server.close();
    try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch (_) {}
  });

  // 1. Cadastra conta Owner e Viewer
  const ownerReg = await call('/auth/register', 'POST', {
    name: 'Gestor SST',
    company: 'Empresa Teste Export',
    email: 'gestor@export.test',
    password: 'senha-segura-123'
  });
  assert.equal(ownerReg.status, 201);
  const ownerCookie = ownerReg.headers.get('set-cookie')?.split(';')[0];
  const accountId = ownerReg.body.id;

  // Cria usuário viewer para teste de papéis
  const accounts = storage.read('accounts');
  const viewerAccount = {
    id: 'user-viewer-1',
    organizationId: accountId,
    name: 'Auditor Visualizador',
    company: 'Empresa Teste Export',
    email: 'viewer@export.test',
    passwordHash: derive('senha-segura-123'),
    role: 'viewer',
    createdAt: new Date().toISOString()
  };
  accounts.push(viewerAccount);
  storage.write('accounts', accounts);

  const viewerLogin = await call('/auth/login', 'POST', {
    email: 'viewer@export.test',
    password: 'senha-segura-123'
  });
  const viewerCookie = viewerLogin.headers.get('set-cookie')?.split(';')[0];

  // 2. Prepara dados sintéticos com ciclo fechado publicado e ciclo protegido
  const publishedReport = {
    schemaVersion: 2,
    id: 'rep-pub-123',
    accountId,
    surveyId: 'srv-pub-123',
    title: 'Pesquisa Clima e SST 2026',
    cycle: '2026-Q1',
    model: 'organizacao',
    groupName: 'Operações, Vendas',
    groupNames: ['Operações', 'Vendas'],
    closedAt: '2026-03-31T00:00:00Z',
    published: true,
    publication: { status: 'published', reasons: [] },
    suppressionReason: null,
    responseCount: 15,
    invitedCount: 20,
    participationRate: 0.75,
    factors: [
      { key: 'demandas', label: 'Demandas', average: 3.8, n: 15, level: 'adequado', levelLabel: 'Adequado', levelIcon: '✓', delta: 0.2, trend: 'melhorou' },
      { key: 'autonomia', label: 'Autonomia', average: 2.5, n: 15, level: 'atencao', levelLabel: 'Atenção', levelIcon: '❗', delta: -0.4, trend: 'piorou' }
    ],
    result: [
      { key: 'demandas', label: 'Demandas', average: 3.8 },
      { key: 'autonomia', label: 'Autonomia', average: 2.5 }
    ],
    distribution: [
      { key: 'demandas', label: 'Demandas', counts: [1, 2, 2, 5, 5], suppressed: false },
      { key: 'autonomia', label: 'Autonomia', counts: null, suppressed: true }
    ],
    segmentation: {
      hasMatrix: true,
      buckets: [
        {
          id: 'seg-1',
          name: 'Operações',
          n: 10,
          invited: 12,
          rate: 0.83,
          band: '≥70%',
          isMerged: false,
          factors: [{ key: 'demandas', average: 3.5, levelLabel: 'Cuidado' }, { key: 'autonomia', average: 2.2, levelLabel: 'Atenção' }]
        },
        {
          id: 'seg-2',
          name: 'Demais áreas (agrupadas)',
          n: 5,
          invited: 8,
          rate: 0.63,
          band: '50–70%',
          isMerged: true,
          factors: [{ key: 'demandas', average: 4.4, levelLabel: 'Adequado' }, { key: 'autonomia', average: 3.1, levelLabel: 'Cuidado' }]
        }
      ],
      notes: 'Áreas pequenas foram agrupadas por partição para proteção de sigilo.'
    },
    participation: {
      total: { invited: 20, responded: 15, rate: 0.75, band: '≥70%' },
      segments: [
        { name: 'Operações', invited: 12, responded: 10, rate: 0.83, band: '≥70%', isMerged: false },
        { name: 'Demais áreas (agrupadas)', invited: 8, responded: 5, rate: 0.63, band: '50–70%', isMerged: true }
      ],
      disclaimer: 'Cinco respostas protegem a divulgação; não demonstram representatividade estatística.'
    },
    comparison: {
      comparable: true,
      previousCycle: '2025-Q4',
      factors: [
        { key: 'demandas', label: 'Demandas', average: 3.8, previous: 3.6, delta: 0.2, trend: 'melhorou' },
        { key: 'autonomia', label: 'Autonomia', average: 2.5, previous: 2.9, delta: -0.4, trend: 'piorou' }
      ]
    },
    summary: {
      text: 'Resumo analítico: 1 fator em atenção (Autonomia). Participação geral de 75%.',
      highlights: [{ type: 'warning', text: 'Autonomia em faixa de atenção.' }]
    },
    methodologyDetails: {
      instrumentName: 'Organização e Condições de Trabalho',
      version: 1,
      limitation: 'Instrumento descritivo sem comprovação isolada de conformidade.',
      disclaimer: 'Não constitui laudo técnico ou diagnóstico clínico individual.'
    }
  };

  const suppressedReport = {
    schemaVersion: 2,
    id: 'rep-sup-456',
    accountId,
    surveyId: 'srv-sup-456',
    title: 'Pesquisa Protegida 2026',
    cycle: '2026-SUP',
    model: 'organizacao',
    groupName: 'Diretoria',
    groupNames: ['Diretoria'],
    closedAt: '2026-04-10T00:00:00Z',
    published: false,
    publication: {
      status: 'suppressed',
      reasons: [{
        code: 'below_min_responses',
        message: 'Menos de 5 respostas recebidas (3 registradas).',
        action: 'Convide ao menos 5 pessoas.'
      }]
    },
    suppressionReason: 'Menos de 5 respostas recebidas (3 registradas).',
    responseCount: null,
    invitedCount: 4,
    participationRate: 0.75,
    factors: null,
    segmentation: null,
    participation: {
      total: { invited: 4, responded: 3, rate: 0.75, band: '≥70%' },
      segments: [],
      disclaimer: 'Cinco respostas protegem a divulgação; não demonstram representatividade estatística.'
    }
  };

  const reports = storage.read('reports');
  reports.push(publishedReport, suppressedReport);
  storage.write('reports', reports);

  // 3. Teste Formato CSV
  const csvText = generateCsv(publishedReport);
  assert.ok(csvText.startsWith('\uFEFF'), 'CSV deve conter BOM UTF-8');
  assert.ok(csvText.includes('"Demandas";"Total Coletivo";"3,80";"15";"Adequado";"Publicado"'));
  assert.ok(csvText.includes('Demais áreas (agrupadas)'));

  // 4. Teste Formato Excel (.xlsx)
  const xlsxBuffer = await generateXlsx(publishedReport);
  assert.ok(Buffer.isBuffer(xlsxBuffer));
  assert.ok(xlsxBuffer.length > 2000, 'Excel deve ter tamanho válido');

  const testWorkbook = new ExcelJS.Workbook();
  await testWorkbook.xlsx.load(xlsxBuffer);
  const sheetNames = testWorkbook.worksheets.map(ws => ws.name);
  assert.deepEqual(sheetNames, [
    'Resumo',
    'Fatores',
    'Distribuição',
    'Segmento x Fator',
    'Participação',
    'Comparação',
    'Metodologia'
  ]);

  // 5. Teste Formato PDF
  const pdfBuffer = await generatePdf(publishedReport, { name: 'Dr. SST' });
  assert.ok(Buffer.isBuffer(pdfBuffer));
  assert.ok(pdfBuffer.slice(0, 5).toString('ascii').startsWith('%PDF-'), 'PDF deve iniciar com cabeçalho %PDF-');
  assert.ok(pdfBuffer.length > 2000, 'PDF deve ter tamanho vetorial consistente');

  // 6. Teste de Vazamento em Relatório Protegido
  // Gera todos os formatos para o relatório suprimido e confirma que números não aparecem
  const supCsv = generateCsv(suppressedReport);
  assert.ok(supCsv.includes('Protegido: Menos de 5 respostas'));
  assert.ok(!supCsv.includes('3,80'));

  const supPdf = await generatePdf(suppressedReport, { name: 'Dr. SST' });
  assert.ok(supPdf.slice(0, 5).toString('ascii').startsWith('%PDF-'));

  const supXlsx = await generateXlsx(suppressedReport);
  const supWb = new ExcelJS.Workbook();
  await supWb.xlsx.load(supXlsx);
  const fatoresSheet = supWb.getWorksheet('Fatores');
  const row2 = fatoresSheet.getRow(2).values;
  assert.ok(JSON.stringify(row2).includes('sigilo estatístico'));

  // 7. Teste de Endpoint HTTP GET /reports/:id/export
  // 7.1 Viewer pode exportar
  const viewerRes = await call(`/reports/${publishedReport.id}/export?format=csv`, 'GET', undefined, viewerCookie);
  assert.equal(viewerRes.status, 200);
  assert.ok(viewerRes.headers.get('content-type').includes('text/csv'));
  assert.ok(viewerRes.headers.get('content-disposition').includes('attachment; filename='));

  // 7.2 Outra conta não tem acesso (404 por isolamento)
  const otherReg = await call('/auth/register', 'POST', {
    name: 'Invasor',
    company: 'Outra Empresa',
    email: 'invasor@export.test',
    password: 'senha-segura-123'
  });
  const otherCookie = otherReg.headers.get('set-cookie')?.split(';')[0];
  const forbiddenRes = await call(`/reports/${publishedReport.id}/export?format=csv`, 'GET', undefined, otherCookie);
  assert.equal(forbiddenRes.status, 404);

  // 8. Teste de Aceite do Relatório
  // Viewer NÃO pode registrar aceite (403)
  const viewerAccept = await call(`/reports/${publishedReport.id}/accept`, 'POST', {}, viewerCookie);
  assert.equal(viewerAccept.status, 403);

  // Owner registra aceite com sucesso (200)
  const ownerAccept = await call(`/reports/${publishedReport.id}/accept`, 'POST', {}, ownerCookie);
  assert.equal(ownerAccept.status, 200);
  assert.equal(ownerAccept.body.ok, true);
  assert.equal(ownerAccept.body.report.acceptance.userName, 'Gestor SST');
  assert.ok(ownerAccept.body.report.acceptance.statement.includes('PGR e as medidas'));

  // 9. Auditoria registrada no management.json
  const management = storage.read('management').find(m => m.id === accountId);
  assert.ok(management, 'Deve existir registro de gestão da conta');
  assert.ok(management.audit.some(a => a.event === 'report.exported'));
  assert.ok(management.audit.some(a => a.event === 'report.accepted'));
});
