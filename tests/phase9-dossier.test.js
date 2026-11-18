/**
 * FASE 09 — Documentos, Rastreabilidade & Dossiê Técnico PGR/AEP (EQ-013)
 *
 * Testa:
 * - Emissão de dossiê consolidado estruturado em JSON com hash de integridade
 * - Garantia das 4 camadas e limitações explícitas (não-diagnóstico / não-laudo)
 * - Exportação de dossiê em PDF (application/pdf)
 * - Isolamento estrito entre locatários (dados do Tenant A não vazam no dossiê de B)
 * - Proteção de rotas autenticadas
 */

'use strict';

const assert = require('node:assert/strict');
const { describe, it, before, after } = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'equilibra-phase9-dos-'));
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
  const contentType = response.headers.get('content-type') || '';
  let parsedBody = null;
  if (response.status !== 204) {
    if (contentType.includes('application/json')) {
      parsedBody = await response.json().catch(() => null);
    } else if (contentType.includes('application/pdf')) {
      parsedBody = Buffer.from(await response.arrayBuffer());
    } else {
      parsedBody = await response.text();
    }
  }

  return {
    status: response.status,
    body: parsedBody,
    headers: Object.fromEntries(response.headers.entries()),
    cookie: response.headers.get('set-cookie')?.split(';')[0],
  };
}

async function register(base, email, company) {
  const r = await call(base, '/auth/register', 'POST', {
    name: 'Auditor SST',
    email,
    password: 'Senha@Forte123!Audit',
    company,
  });
  assert.equal(r.status, 201, `Registro falhou: ${JSON.stringify(r.body)}`);
  return { cookie: r.cookie, account: r.body };
}

describe('FASE 09 — Dossiê Técnico PGR/AEP e Rastreabilidade', () => {
  let server, base, tenantA, tenantB;

  before(async () => {
    server = app.listen(0);
    await new Promise((res) => server.once('listening', res));
    base = `http://127.0.0.1:${server.address().port}/api`;

    tenantA = await register(base, `audit-a-${Date.now()}@alfa.test`, 'Alpha Logística SA');
    tenantB = await register(base, `audit-b-${Date.now()}@beta.test`, 'Beta Tech Ltda');

    // Popula dados para tenant A: membros, grupo e evidência
    const mRes = await call(base, '/members', 'POST', { name: 'Operador Alfa 1' }, tenantA.cookie);
    assert.equal(mRes.status, 201);
    await call(base, '/groups', 'POST', { name: 'Operações Alpha', memberIds: [mRes.body.id] }, tenantA.cookie);

    await call(
      base,
      '/evidence',
      'POST',
      {
        type: 'observacao',
        title: 'Verificação Ergonômica de Postos de Trabalho',
        collectionDate: '2026-11-10',
        responsibleName: 'Técnico de Segurança',
      },
      tenantA.cookie,
    );
  });

  after(() => server.close());

  // ── 1. Geração de Dossiê Estruturado JSON ────────────────────────────
  it('gera dossiê consolidado com snapshot SHA-256 e governança NR-1/NR-17', async () => {
    const res = await call(base, '/management/dossier', 'GET', null, tenantA.cookie);
    assert.equal(res.status, 200);

    const doc = res.body;
    assert.ok(doc.title.includes('Alpha Logística SA'));
    assert.ok(doc.snapshotHash, 'Dossiê deve conter hash imutável de snapshot');
    assert.ok(doc.limitations.includes('Não substitui laudo técnico'));
    assert.ok(doc.governance.framework.includes('NR-1'));
    assert.equal(doc.populationSummary.totalMembersMapped, 1);
    assert.ok(Array.isArray(doc.evidences));
    assert.equal(doc.evidences.length, 1);
    assert.equal(doc.evidences[0].title, 'Verificação Ergonômica de Postos de Trabalho');
  });

  // ── 2. Exportação em PDF ────────────────────────────────────────────
  it('exporta dossiê completo em formato PDF com headers corretos', async () => {
    const res = await call(base, '/management/dossier?format=pdf', 'GET', null, tenantA.cookie);
    assert.equal(res.status, 200);
    assert.ok(res.headers['content-type'].includes('application/pdf'));
    assert.ok(res.headers['content-disposition'].includes('attachment'));
    assert.ok(res.headers['content-disposition'].includes('.pdf'));

    // Verifica se os primeiros bytes correspondem ao header "%PDF"
    const isBuffer = Buffer.isBuffer(res.body);
    assert.ok(isBuffer, 'Corpo da resposta deve ser um Buffer');
    assert.equal(res.body.slice(0, 4).toString(), '%PDF', 'Arquivo gerado deve ser um PDF válido');
    assert.ok(res.body.length > 500, 'Tamanho do PDF deve ser plausível');
  });

  // ── 3. Isolamento Estrito de Locatários ──────────────────────────────
  it('dossiê do Tenant B não vaza dados, evidências ou membros do Tenant A', async () => {
    const res = await call(base, '/management/dossier', 'GET', null, tenantB.cookie);
    assert.equal(res.status, 200);

    const doc = res.body;
    assert.ok(doc.title.includes('Beta Tech Ltda'));
    assert.equal(doc.populationSummary.totalMembersMapped, 0, 'Tenant B não tem membros cadastrados');
    assert.equal(doc.evidences.length, 0, 'Tenant B não deve ver evidências de Tenant A');
  });

  // ── 4. Proteção Não Autenticada ─────────────────────────────────────
  it('rejeita emissão de dossiê sem sessão autenticada', async () => {
    const res = await call(base, '/management/dossier', 'GET', null, null);
    assert.ok([401, 403].includes(res.status));
  });
});
