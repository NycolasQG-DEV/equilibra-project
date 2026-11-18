/**
 * FASE 10 — Privacidade (LGPD), Operação & Modelo SaaS (EQ-013, EQ-014, EQ-015)
 *
 * Testa:
 * - Configuração de política de retenção de dados (1 a 60 meses)
 * - Expurgo irreversível de dados brutos de respostas com confirmação obrigatória "PURGAR"
 * - Catálogo de planos e checkout de assinatura SaaS
 * - Mecanismos de backup e integridade de storage
 * - Isolamento multi-tenant das configurações de privacidade e cobrança
 */

'use strict';

const assert = require('node:assert/strict');
const { describe, it, before, after } = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'equilibra-phase10-lgpd-'));
process.env.EQUILIBRA_DATA_DIR = directory;
process.env.BILLING_ENFORCE = 'false';
process.env.GROQ_API_KEY = '';

const app = require('../src/server');
const storage = require('../src/config/equilibraStorage');

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
    name: 'DPO / Gestor',
    email,
    password: 'Senha@Forte123!DPO',
    company,
  });
  assert.equal(r.status, 201, `Registro falhou: ${JSON.stringify(r.body)}`);
  return { cookie: r.cookie, account: r.body };
}

describe('FASE 10 — Privacidade LGPD, Operação & Modelo SaaS', () => {
  let server, base, userA, userB;

  before(async () => {
    server = app.listen(0);
    await new Promise((res) => server.once('listening', res));
    base = `http://127.0.0.1:${server.address().port}/api`;

    userA = await register(base, `dpo-a-${Date.now()}@corp-a.test`, 'Empresa Alpha SaaS');
    userB = await register(base, `dpo-b-${Date.now()}@corp-b.test`, 'Empresa Beta SaaS');
  });

  after(() => server.close());

  // ── 1. Configuração da Política de Retenção LGPD ─────────────────────
  it('configura política de retenção de dados entre 1 e 60 meses', async () => {
    // Configura 12 meses para o Tenant A
    const res = await call(base, '/management/retention', 'PUT', { months: 12 }, userA.cookie);
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.months, 12);
    assert.ok(res.body.cutoff);

    // Consulta e confirma
    const preview = await call(base, '/management/retention', 'GET', null, userA.cookie);
    assert.equal(preview.status, 200);
    assert.equal(preview.body.months, 12);

    // Tenant B mantém política padrão isolada (0 = desativada)
    const prevB = await call(base, '/management/retention', 'GET', null, userB.cookie);
    assert.equal(prevB.status, 200);
    assert.equal(prevB.body.months, 0, 'Tenant B não deve herdar política do Tenant A');
  });

  // ── 2. Validação de Limites de Retenção ──────────────────────────────
  it('rejeita configuração de retenção com valores fora do intervalo permitido', async () => {
    const invalid = await call(base, '/management/retention', 'PUT', { months: 99 }, userA.cookie);
    assert.equal(invalid.status, 400);
    assert.ok(invalid.body.error?.includes('retenção'));
  });

  // ── 3. Proteção e Confirmação de Expurgo Irreversível ─────────────────
  it('exige palavra de confirmação exata "PURGAR" para executar expurgo de dados brutos', async () => {
    // Tentativa com confirmação errada
    const errRes = await call(
      base,
      '/management/retention/purge',
      'POST',
      { confirmation: 'CONFIRMAR' },
      userA.cookie,
    );
    assert.equal(errRes.status, 400);
    assert.ok(errRes.body.error?.includes('PURGAR'));

    // Tentativa válida com PURGAR
    const okRes = await call(
      base,
      '/management/retention/purge',
      'POST',
      { confirmation: 'PURGAR' },
      userA.cookie,
    );
    assert.equal(okRes.status, 200);
    assert.equal(okRes.body.months, 12);
  });

  // ── 4. Consulta de Planos SaaS e Configuração de Cobrança ─────────────
  it('disponibiliza planos de assinatura B2B no endpoint /management/billing', async () => {
    const res = await call(base, '/management/billing', 'GET', null, userA.cookie);
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.plans), 'Deve retornar lista de planos');
    assert.ok(res.body.plans.length >= 1, 'Deve conter pelo menos um plano configurado');

    const firstPlan = res.body.plans[0];
    assert.ok(firstPlan.id);
    assert.ok(firstPlan.name);
    assert.ok(firstPlan.amountCents !== undefined, 'Plano deve conter amountCents');
    assert.ok(firstPlan.members !== undefined, 'Plano deve conter limite de membros');
  });

  // ── 5. Mecanismo de Backup e Integridade de Dados ────────────────────
  it('executa rotina de backup no storage com snapshot atômico', () => {
    const backupDir = storage.backup();
    assert.ok(backupDir, 'Diretório de backup deve ser retornado');
    assert.ok(fs.existsSync(backupDir), 'Pasta do backup deve existir no disco');

    // Valida que o marcador .complete foi gravado
    assert.ok(fs.existsSync(path.join(backupDir, '.complete')));
  });

  // ── 6. Proteção de Acesso Não Autenticado ───────────────────────────
  it('bloqueia endpoints de privacidade e billing para requisições sem sessão', async () => {
    const ret = await call(base, '/management/retention', 'GET', null, null);
    assert.ok([401, 403].includes(ret.status));

    const bill = await call(base, '/management/billing', 'GET', null, null);
    assert.ok([401, 403].includes(bill.status));
  });
});
