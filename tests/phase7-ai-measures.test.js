/**
 * FASE 07 — Assistente Inteligente & Biblioteca de Medidas (EQ-010, EQ-011)
 *
 * Testa o orquestrador de IA e a biblioteca de medidas preventivas:
 * - Estruturação em 4 camadas (dado -> interpretação -> hipótese -> medidas)
 * - Ausência de PII e garantia de dados agregados
 * - Isenção e advertência legal obrigatória (sem diagnóstico clínico)
 * - Catálogo de medidas 5W2H com hierarquia NR-1
 * - Proteção de rotas autenticadas
 */

'use strict';

const assert = require('node:assert/strict');
const { describe, it, before, after } = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'equilibra-phase7-ai-'));
process.env.EQUILIBRA_DATA_DIR = directory;
process.env.BILLING_ENFORCE = 'false';
process.env.GROQ_API_KEY = ''; // Garante execução determinística e offline no teste

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
    name: 'Engenheiro SST',
    email,
    password: 'Senha@Forte123!SST',
    company: 'Indústria Exemplo SA',
  });
  assert.equal(r.status, 201, `Registro falhou: ${JSON.stringify(r.body)}`);
  return { cookie: r.cookie, account: r.body };
}

describe('FASE 07 — Assistente de IA & Biblioteca de Medidas 5W2H', () => {
  let server, base, user;

  before(async () => {
    server = app.listen(0);
    await new Promise((res) => server.once('listening', res));
    base = `http://127.0.0.1:${server.address().port}/api`;
    user = await register(base, `sst-ai-${Date.now()}@exemplo.com`);
  });

  after(() => server.close());

  // ── 1. Catálogo de Medidas ──────────────────────────────────────────
  it('disponibiliza catálogo completo de medidas preventivas com 5W2H', async () => {
    const res = await call(base, '/management/measures', 'GET', null, user.cookie);
    assert.equal(res.status, 200);
    assert.ok(typeof res.body === 'object');
    assert.ok(Array.isArray(res.body.demandas), 'Catálogo deve conter medidas para demandas');
    assert.ok(Array.isArray(res.body.autonomia), 'Catálogo deve conter medidas para autonomia');

    const first = res.body.demandas[0];
    assert.ok(first.id);
    assert.ok(first.title);
    assert.ok(first.hierarchy, 'Deve especificar categoria hierárquica NR-1');
    assert.ok(first.fiveWtwoH.what, 'Deve conter What');
    assert.ok(first.fiveWtwoH.why, 'Deve conter Why');
    assert.ok(first.fiveWtwoH.who, 'Deve conter Who');
  });

  // ── 2. Geração de Análise de Fator em 4 Camadas ─────────────────────
  it('gera análise estruturada em 4 camadas sem dados pessoais (PII)', async () => {
    const res = await call(
      base,
      '/management/ai-analysis',
      'POST',
      {
        factorKey: 'demandas',
        factorLabel: 'Exigências e Carga de Trabalho',
        score: 2.15,
        previousScore: 3.2,
        groupName: 'Setor de Produção',
        contextDescription: 'Turnos com metas elevadas no fechamento do trimestre',
      },
      user.cookie,
    );

    assert.equal(res.status, 200, JSON.stringify(res.body));
    const data = res.body;

    // 1ª camada: Dado observado
    assert.ok(data.observedData);
    assert.equal(data.observedData.score, 2.15);
    assert.equal(data.observedData.delta, -1.05);

    // 2ª camada: Interpretação descritiva
    assert.ok(data.descriptiveInterpretation);
    assert.equal(data.riskLevel, 'critico');

    // 3ª camada: Hipótese técnica
    assert.ok(data.technicalHypothesis);
    assert.ok(data.technicalHypothesis.length > 20);

    // 4ª camada: Medidas sugeridas (5W2H)
    assert.ok(Array.isArray(data.suggestedMeasures));
    assert.ok(data.suggestedMeasures.length >= 1);
    assert.equal(data.suggestedMeasures[0].status, 'draft_suggestion');

    // Validação humana explícita & Disclaimer regulatório
    assert.equal(data.requiresHumanValidation, true);
    assert.ok(data.limitations.includes('Não substitui'));
    assert.ok(data.sources.some((s) => s.includes('NR-1')));
  });

  // ── 3. Validação de Parâmetros Obrigatórios ─────────────────────────
  it('rejeita requisição de análise sem factorKey', async () => {
    const res = await call(base, '/management/ai-analysis', 'POST', { score: 3.5 }, user.cookie);
    assert.equal(res.status, 400);
    assert.ok(res.body.error?.includes('factorKey'));
  });

  // ── 4. Proteção de Rota Não Autenticada ─────────────────────────────
  it('bloqueia acesso não autenticado com 401/403', async () => {
    const res = await call(
      base,
      '/management/ai-analysis',
      'POST',
      { factorKey: 'demandas', score: 2.5 },
      null,
    );
    assert.ok([401, 403].includes(res.status));
  });
});
