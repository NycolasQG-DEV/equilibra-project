/**
 * FASE 05 — Coleta Multimétodo & Suporte à AEP (EQ-008)
 *
 * Testa o módulo de evidências complementares:
 * - CRUD de registros de evidências
 * - Supressão de quórum (< 5 participantes)
 * - Isolamento multilocatário (tenant A não vê dados de tenant B)
 * - Validações de campos obrigatórios
 */

'use strict';

const assert = require('node:assert/strict');
const { describe, it, before, after } = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

// ─── Setup isolado de storage ─────────────────────────────────────────────────
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'equilibra-phase5-ev-'));
process.env.EQUILIBRA_DATA_DIR = directory;
process.env.BILLING_ENFORCE = 'false';

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

async function register(base, email, company) {
  const r = await call(base, '/auth/register', 'POST', {
    name: 'Usuário Teste',
    email,
    password: 'Senha@123!ABC',
    company,
  });
  assert.equal(r.status, 201, `Registro falhou: ${JSON.stringify(r.body)}`);
  return { cookie: r.cookie, account: r.body };
}

// ─── Suíte ───────────────────────────────────────────────────────────────────

describe('FASE 05 — Coleta de Evidências Multimétodo', () => {
  let server, base, tenantA, tenantB;

  before(async () => {
    server = app.listen(0);
    await new Promise((res) => server.once('listening', res));
    base = `http://127.0.0.1:${server.address().port}/api`;
    tenantA = await register(base, `ev-a-${Date.now()}@test.com`, 'Empresa Alfa');
    tenantB = await register(base, `ev-b-${Date.now()}@test.com`, 'Empresa Beta');
  });

  after(() => server.close());

  // ── 1. Criar evidência válida ─────────────────────────────────────────
  it('cria evidência do tipo observacao com campos básicos', async () => {
    const r = await call(base, '/evidence', 'POST', {
      type: 'observacao',
      title: 'Observação de campo — setor Financeiro',
      collectionDate: '2026-11-01',
      responsibleName: 'Dr. Fulano',
      location: 'Andar 2, Sala B',
      activityDescription: 'Verificação de postos de trabalho e jornada',
    }, tenantA.cookie);
    assert.equal(r.status, 201, JSON.stringify(r.body));
    assert.ok(r.body.id);
    assert.equal(r.body.type, 'observacao');
    assert.equal(r.body.accountId, tenantA.account.id);
  });

  // ── 2. Listar evidências ─────────────────────────────────────────────
  it('lista evidências do próprio tenant', async () => {
    const r = await call(base, '/evidence', 'GET', null, tenantA.cookie);
    assert.equal(r.status, 200);
    assert.ok(Array.isArray(r.body));
    assert.ok(r.body.length >= 1);
    assert.ok(r.body.every((e) => e.accountId === tenantA.account.id));
  });

  // ── 3. Isolamento multilocatário ─────────────────────────────────────
  it('tenant B não vê evidências do tenant A', async () => {
    const r = await call(base, '/evidence', 'GET', null, tenantB.cookie);
    assert.equal(r.status, 200);
    // Tenant B não criou nada ainda — lista deve estar vazia
    assert.equal(r.body.length, 0);
  });

  // ── 4. Supressão de quórum — count < 5 ──────────────────────────────
  it('suprime participantCount quando < 5 e tipo tem quórum', async () => {
    const r = await call(base, '/evidence', 'POST', {
      type: 'grupo_focal',
      title: 'Grupo focal piloto — apenas 3 participantes',
      collectionDate: '2026-11-02',
      participantCount: 3,
    }, tenantA.cookie);
    assert.equal(r.status, 201, JSON.stringify(r.body));
    assert.equal(r.body.quorumSuppressed, true, 'quorumSuppressed deve ser true');
    assert.equal(r.body.participantCount, null, 'participantCount deve ser null (suprimido)');
  });

  // ── 5. Quórum OK — count >= 5 registra normalmente ──────────────────
  it('registra participantCount quando >= 5', async () => {
    const r = await call(base, '/evidence', 'POST', {
      type: 'entrevista',
      title: 'Entrevista coletiva — 7 participantes',
      collectionDate: '2026-11-03',
      participantCount: 7,
    }, tenantA.cookie);
    assert.equal(r.status, 201, JSON.stringify(r.body));
    assert.equal(r.body.quorumSuppressed, false);
    assert.equal(r.body.participantCount, 7);
  });

  // ── 6. Tipo observacao não aplica supressão ──────────────────────────
  it('observacao não aplica supressão de quórum mesmo com count < 5', async () => {
    const r = await call(base, '/evidence', 'POST', {
      type: 'observacao',
      title: 'Observação sem participantes contáveis',
      collectionDate: '2026-11-04',
      participantCount: 2,
    }, tenantA.cookie);
    assert.equal(r.status, 201);
    assert.equal(r.body.quorumSuppressed, false);
  });

  // ── 7. Validação — título obrigatório ────────────────────────────────
  it('rejeita evidência sem título', async () => {
    const r = await call(base, '/evidence', 'POST', {
      type: 'documento',
      collectionDate: '2026-11-01',
    }, tenantA.cookie);
    assert.equal(r.status, 400, JSON.stringify(r.body));
    assert.ok(r.body.error?.includes('título'));
  });

  // ── 8. Validação — tipo inválido ─────────────────────────────────────
  it('rejeita tipo de evidência desconhecido', async () => {
    const r = await call(base, '/evidence', 'POST', {
      type: 'tipo_inventado',
      title: 'Teste de tipo inválido',
      collectionDate: '2026-11-01',
    }, tenantA.cookie);
    assert.equal(r.status, 400);
    assert.ok(r.body.error?.includes('Tipo inválido'));
  });

  // ── 9. Validação — data obrigatória ─────────────────────────────────
  it('rejeita evidência sem data de coleta', async () => {
    const r = await call(base, '/evidence', 'POST', {
      type: 'documento',
      title: 'Evidência sem data',
    }, tenantA.cookie);
    assert.equal(r.status, 400);
    assert.ok(r.body.error?.includes('data'));
  });

  // ── 10. IDOR: tenant B não acessa registro de A ──────────────────────
  it('IDOR: tenant B não consegue acessar evidência de tenant A', async () => {
    // Criar evidência em tenant A
    const cr = await call(base, '/evidence', 'POST', {
      type: 'documento',
      title: 'Documento confidencial — Tenant A',
      collectionDate: '2026-11-05',
    }, tenantA.cookie);
    assert.equal(cr.status, 201);
    const id = cr.body.id;
    // Tenant B tenta acessar
    const r = await call(base, `/evidence/${id}`, 'GET', null, tenantB.cookie);
    assert.equal(r.status, 404, 'Tenant B não deve encontrar evidência de Tenant A');
  });

  // ── 11. DELETE — remove evidência própria ────────────────────────────
  it('exclui evidência própria com status 204', async () => {
    const cr = await call(base, '/evidence', 'POST', {
      type: 'indicador_agregado',
      title: 'Indicador de absenteísmo Q3',
      collectionDate: '2026-11-06',
    }, tenantA.cookie);
    assert.equal(cr.status, 201);
    const del = await call(base, `/evidence/${cr.body.id}`, 'DELETE', null, tenantA.cookie);
    assert.equal(del.status, 204);
    // Confirmar que sumiu da listagem
    const list = await call(base, '/evidence', 'GET', null, tenantA.cookie);
    assert.ok(list.body.every((e) => e.id !== cr.body.id));
  });

  // ── 12. Acesso sem autenticação deve retornar 401 ────────────────────
  it('retorna 401 ao tentar criar evidência sem sessão', async () => {
    const r = await call(base, '/evidence', 'POST', {
      type: 'observacao',
      title: 'Tentativa sem autenticação',
      collectionDate: '2026-11-01',
    }, null);
    assert.ok([401, 403].includes(r.status), `Esperado 401/403, obtido ${r.status}`);
  });
});
