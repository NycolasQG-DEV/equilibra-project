/* Automated End-to-End Test Runner for Equilibra MVP */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');

// Setup isolated test environment
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'equilibra-e2e-'));
process.env.EQUILIBRA_DATA_DIR = tempDir;
process.env.NODE_ENV = 'test';
process.env.GROQ_API_KEY = '';
process.env.BILLING_ENFORCE = 'false';

const app = require('../src/server');
const storage = require('../src/config/equilibraStorage');
const { derive } = require('../src/services/passwordService');
const { runSeed, ACC_ID } = require('./seedConsolidatedCompany');

async function runE2E() {
  console.log('====================================================');
  console.log('   EQUILIBRA MVP — SUÍTE DE TESTES PONTA A PONTA    ');
  console.log('====================================================');
  console.log(`Ambiente isolado criado em: ${tempDir}`);

  // 1. Seed synthetic company
  runSeed();

  // Create test credentials
  const accounts = storage.read('accounts');
  accounts.push({
    id: 'user-qa-e2e',
    organizationId: ACC_ID,
    name: 'Coordenadora de SST',
    company: 'Zenai Soluções Tecnológicas',
    email: 'coordenadora@zenai.test',
    passwordHash: derive('senha-segura-123'),
    role: 'owner',
    createdAt: new Date().toISOString()
  });
  storage.write('accounts', accounts);

  // 2. Start HTTP server
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;
  console.log(`Servidor de teste ativo em ${baseUrl}\n`);

  let sessionCookie = '';

  async function api(endpoint, options = {}) {
    const url = `${baseUrl}${endpoint.startsWith('/api') ? endpoint : `/api${endpoint}`}`;
    const headers = {
      'Content-Type': 'application/json',
      ...(sessionCookie ? { Cookie: sessionCookie } : {}),
      ...(options.headers || {})
    };

    const res = await fetch(url, {
      ...options,
      headers
    });

    const setCookie = res.headers.get('set-cookie');
    if (setCookie && setCookie.includes('equilibra_session')) {
      sessionCookie = setCookie.split(';')[0];
    }

    if (options.raw) {
      return res;
    }

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      throw new Error(`HTTP ${res.status}: ${errBody.error || res.statusText}`);
    }

    if (res.status === 204) return null;
    return await res.json();
  }

  try {
    // Passo 1: Autenticação
    console.log('[1/10] Autenticando usuária RH / SST...');
    const loginRes = await api('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'nycolas@zenai.com.br', password: 'Equilibra2026!' })
    });
    if (!loginRes.id) throw new Error('Falha no login');
    console.log(`  ✔ Sessão iniciada para: ${loginRes.name} (${loginRes.role})`);

    // Passo 2: Acessar Visão Geral (#hoje)
    console.log('[2/10] Consultando cockpit Hoje (GET /api/today)...');
    const todayRes = await api('/today');
    if (!todayRes.greeting || !todayRes.kpis || !Array.isArray(todayRes.queue)) {
      throw new Error('Formato inválido de resposta de /today');
    }
    console.log(`  ✔ Saudação: "${todayRes.greeting}", Fila de decisão: ${todayRes.queue.length} itens pendentes`);

    // Passo 3: Criar Nova Pesquisa para 3 segmentos
    console.log('[3/10] Criando nova pesquisa multi-segmentos...');
    const groups = storage.read('groups').filter(g => g.accountId === ACC_ID && g.name !== 'Geral');
    const targetGroups = groups.slice(0, 3);
    const targetGroupIds = targetGroups.map(g => g.id);
    const targetMembers = targetGroups.flatMap(g => g.memberIds || []);

    const createdSurvey = await api('/surveys', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Pesquisa E2E de Clima e Fatores Psicossociais',
        cycle: 'Ciclo de Teste E2E 2026',
        model: 'Diagnóstico inicial',
        groupIds: targetGroupIds,
        memberIds: targetMembers,
        endsAt: new Date(Date.now() + 14 * 86400000).toISOString()
      })
    });
    console.log(`  ✔ Pesquisa criada: ID ${createdSurvey.id} com ${targetMembers.length} pessoas em 3 áreas`);

    // Passo 4: Abrir Pesquisa
    console.log('[4/10] Abrindo pesquisa para início da escuta...');
    // Fecha qualquer pesquisa que já estivesse aberta para liberar a audiência
    const existingSurveys = await api('/surveys');
    for (const s of existingSurveys.filter(s => s.status === 'open')) {
      await api(`/surveys/${s.id}/close`, {
        method: 'POST',
        body: JSON.stringify({ confirmEarlyClose: true, reason: 'Fechamento do ciclo anterior para teste E2E' })
      });
    }

    const openRes = await api(`/surveys/${createdSurvey.id}/open`, { method: 'POST' });
    if (openRes.survey?.status !== 'open') throw new Error('Pesquisa não foi aberta');
    console.log(`  ✔ Status alterado para: ${openRes.survey.status}`);

    // Passo 5: Exportar links individuais de convite
    console.log('[5/10] Obtendo links individuais pseudonimizados...');
    const linksCsvRes = await api(`/surveys/${createdSurvey.id}/invitation-links/export`, { raw: true });
    const csvContent = await linksCsvRes.text();
    if (!csvContent.includes('/responder/')) {
      throw new Error('CSV de convites não contém links de resposta');
    }
    console.log(`  ✔ Planilha de convites gerada (${csvContent.split('\n').length} linhas)`);

    // Passo 6: Submeter respostas confidenciais por segmento
    console.log('[6/10] Respondendo questionários confidenciais por token...');
    const generatedLinks = openRes.links || [];
    if (generatedLinks.length === 0) throw new Error('Nenhum link gerado ao abrir pesquisa');

    // Respond for at least 8 people across the 3 segments (ensures N >= 5 and valid partition)
    const respondents = generatedLinks.slice(0, 8);
    for (const inv of respondents) {
      await api(`/respond/${inv.token}`, {
        method: 'POST',
        body: JSON.stringify({
          answers: {
            demandas: 4,
            autonomia: 4,
            apoio: 4,
            relacoes: 5,
            reconhecimento: 4,
            jornada: 3,
            mudancas: 4,
            seguranca: 5
          }
        })
      });
    }
    console.log(`  ✔ ${respondents.length} questionários respondidos confidencialmente`);

    // Passo 7: Encerrar pesquisa antecipadamente
    console.log('[7/10] Encerrando pesquisa antecipadamente com justificativa...');
    const closeRes = await api(`/surveys/${createdSurvey.id}/close`, {
      method: 'POST',
      body: JSON.stringify({ confirmEarlyClose: true, reason: 'Quórum satisfatório obtido na bateria de testes E2E' })
    });
    console.log(`  ✔ Pesquisa encerrada: status ${closeRes.status}`);

    // Passo 8: Acessar Relatório Coletivo
    console.log('[8/10] Acessando relatório do ciclo...');
    const report = await api(`/reports/${createdSurvey.id}`);
    if (!report || report.suppression?.isSuppressed) {
      throw new Error('Relatório deveria estar publicado');
    }
    console.log(`  ✔ Relatório publicado: média geral ${report.generalAverage}, ${report.responsesCount} respostas`);

    // Passo 9: Exportar em todos os 4 formatos
    console.log('[9/10] Testando exportação nos 4 formatos regulamentares...');

    // PDF
    const pdfRes = await api(`/reports/${createdSurvey.id}/export?format=pdf`, { raw: true });
    const pdfBuf = await pdfRes.arrayBuffer();
    if (pdfRes.headers.get('content-type') !== 'application/pdf' || pdfBuf.byteLength < 1000) {
      throw new Error('Exportação PDF inválida');
    }
    console.log(`  ✔ PDF vetorial gerado: ${pdfBuf.byteLength} bytes`);

    // Excel
    const xlsxRes = await api(`/reports/${createdSurvey.id}/export?format=xlsx`, { raw: true });
    const xlsxBuf = await xlsxRes.arrayBuffer();
    if (!xlsxRes.headers.get('content-type').includes('spreadsheet') || xlsxBuf.byteLength < 1000) {
      throw new Error('Exportação Excel inválida');
    }
    console.log(`  ✔ Planilha Excel (7 abas) gerada: ${xlsxBuf.byteLength} bytes`);

    // CSV
    const csvRes = await api(`/reports/${createdSurvey.id}/export?format=csv`, { raw: true });
    const csvBuf = Buffer.from(await csvRes.arrayBuffer());
    const hasBOM = csvBuf[0] === 0xEF && csvBuf[1] === 0xBB && csvBuf[2] === 0xBF;
    const csvText = csvBuf.toString('utf8');
    if (!hasBOM || !csvText.includes(';')) {
      throw new Error('Exportação CSV inválida: ausência de BOM UTF-8 ou separador ";"');
    }
    console.log(`  ✔ CSV formatado (UTF-8 BOM + ';') gerado: ${csvText.length} caracteres`);

    // JSON
    const jsonRes = await api(`/reports/${createdSurvey.id}/export?format=json`, { raw: true });
    const jsonPayload = await jsonRes.json();
    if (!jsonPayload.id || jsonPayload.generalAverage === undefined) {
      throw new Error('Exportação JSON sanitizada inválida');
    }
    console.log(`  ✔ JSON sanitizado de auditoria gerado`);

    // Passo 10: Registrar Aceite Formal
    console.log('[10/10] Registrando aceite formal técnico da NR-1...');
    const acceptRes = await api(`/reports/${createdSurvey.id}/accept`, {
      method: 'POST',
      body: JSON.stringify({
        acceptedBy: 'Ana Silva - Eng. de Segurança do Trabalho (CREA 12345/SP)',
        notes: 'Relatório validado e anexado ao inventário de riscos psicossociais da NR-1.'
      })
    });
    if (!acceptRes.formalAcceptance) {
      throw new Error('Aceite formal não foi registrado');
    }
    console.log(`  ✔ Aceite formal registrado por: ${acceptRes.formalAcceptance.acceptedBy}`);

    console.log('\n====================================================');
    console.log('   TODOS OS PASSOS E2E FORAM CONCLUÍDOS COM SUCESSO!  ');
    console.log('====================================================\n');
  } finally {
    server.close();
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  }
}

runE2E().catch(err => {
  console.error('\n✖ Falha na execução dos testes E2E:', err);
  process.exit(1);
});
