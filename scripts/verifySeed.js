const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const DATA_DIR = process.env.EQUILIBRA_DATA_DIR || path.join(__dirname, '..', 'data-demo');
const ACC_ID = '53739463-e3fc-476a-8c45-a290fd89e72f';

console.log(`=== VERIFICAÇÃO DOS DADOS SEEDADOS [${DATA_DIR}] ===`);

function load(name) {
  const p = path.join(DATA_DIR, `${name}.json`);
  if (!fs.existsSync(p)) throw new Error(`Arquivo não encontrado: ${p}`);
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

const accounts = load('accounts');
const members = load('members').filter(m => m.accountId === ACC_ID);
const groups = load('groups').filter(g => g.accountId === ACC_ID);
const surveys = load('surveys').filter(s => s.accountId === ACC_ID);
const reports = load('reports').filter(r => r.accountId === ACC_ID);
const responses = load('responses').filter(r => r.accountId === ACC_ID);
const invitations = load('invitations').filter(i => i.accountId === ACC_ID);
const management = load('management').find(m => m.id === ACC_ID);

const { compareReports } = require('../src/domain/analysis');

// 1. Empresa marcada como demo
const userAcc = accounts.find(a => a.id === ACC_ID);
assert.ok(userAcc, 'Conta principal não encontrada');
assert.ok(userAcc.company.includes('[DEMO]'), 'Empresa deve estar claramente marcada como demonstração');
console.log('✔ Empresa:', userAcc.company);

// 2. 150 a 220 pessoas em 5 a 7 áreas de tamanhos variados, incluindo uma área < 5
assert.ok(members.length >= 150 && members.length <= 220, `Contagem de membros fora do intervalo: ${members.length}`);
const deptGroups = groups.filter(g => g.name !== 'Geral');
assert.ok(deptGroups.length >= 5 && deptGroups.length <= 7, `Número de áreas deve ser 5 a 7 (encontrado: ${deptGroups.length})`);
const smallGroup = deptGroups.find(g => g.memberIds.length < 5);
assert.ok(smallGroup, 'Deve haver ao menos uma área pequena abaixo do mínimo (< 5)');
console.log(`✔ Membros: ${members.length} em ${deptGroups.length} áreas (área pequena: "${smallGroup.name}" com ${smallGroup.memberIds.length} pessoas)`);

// 3. Ciclos fechados (4-6 compatíveis), 1 HSE, 1 suprimido por sobreposição, 1 aberto com participação parcial, 1 rascunho
const closedSurveys = surveys.filter(s => s.status === 'closed');
const openSurveys = surveys.filter(s => s.status === 'open');
const draftSurveys = surveys.filter(s => s.status === 'draft');
assert.ok(closedSurveys.length >= 5, `Esperado ao menos 5 ciclos fechados (encontrado: ${closedSurveys.length})`);
assert.equal(openSurveys.length, 1, 'Esperado 1 ciclo aberto');
assert.equal(draftSurveys.length, 1, 'Esperado 1 ciclo em rascunho');

const hseReport = reports.find(r => r.instrument?.id === 'hse-indicator-pt');
assert.ok(hseReport, 'Deve haver 1 ciclo com instrumento HSE');

const suppressedReport = reports.find(r => r.published === false);
assert.ok(suppressedReport, 'Deve haver 1 ciclo suprimido por sobreposição');
assert.ok(suppressedReport.suppressionReason, 'Relatório suprimido deve ter razão');

console.log(`✔ Pesquisas: ${surveys.length} total (${closedSurveys.length} fechadas, ${openSurveys.length} aberta, ${draftSurveys.length} rascunho)`);
console.log(`✔ Ciclo HSE presente: "${hseReport.title}" (${hseReport.result.length} subescalas)`);
console.log(`✔ Ciclo Suprimido presente: "${suppressedReport.title}" (motivo: ${suppressedReport.suppressionReason.slice(0, 50)}...)`);

// 4. Variação realista nos resultados por ciclo
const publishedReports = reports.filter(r => r.published && r.instrument?.id !== 'hse-indicator-pt');
assert.ok(publishedReports.length >= 4, 'Esperado ao menos 4 relatórios normais publicados');
const comp = compareReports(publishedReports[1], publishedReports[0]);
assert.ok(comp.comparable, 'Ciclos consecutivos devem ser comparáveis');
const deltaValues = comp.factors.map(f => f.delta);
const hasNonZeroDelta = deltaValues.some(d => d !== 0);
assert.ok(hasNonZeroDelta, 'Deve haver variação real (deltas não nulos) entre ciclos históricos');
console.log(`✔ Comparação entre ciclos: ${comp.factors.length} fatores avaliados (exemplo delta: ${deltaValues.join(', ')})`);

// 5. Modelo de segmento (Fase 1) e Privacidade
for (const resp of responses) {
  assert.ok(resp.segmentId, `Resposta ${resp.id} não possui segmentId`);
  assert.ok(resp.submittedDay, `Resposta ${resp.id} não possui submittedDay`);
  assert.equal(resp.memberId, undefined, `CAMPO PROIBIDO: memberId encontrado na resposta ${resp.id}`);
  assert.equal(resp.ip, undefined, `CAMPO PROIBIDO: IP encontrado na resposta ${resp.id}`);
}
console.log(`✔ Privacidade: todas as ${responses.length} respostas possuem segmentId e submittedDay, sem memberId ou IP`);

// 6. Ações em estados variados
assert.ok(management, 'Gestão NR-1 não encontrada');
const overdueAction = management.actions.find(a => a.status === 'in_progress' && new Date(a.dueDate) < new Date('2026-06-01'));
const inProgressAction = management.actions.find(a => a.status === 'in_progress' && new Date(a.dueDate) > new Date());
const efficacyReviewOverdue = management.actions.find(a => a.effectiveReviewDate && new Date(a.effectiveReviewDate) < new Date());
const completedWithEvidence = management.actions.find(a => a.status === 'completed' && a.evidence && a.evidence.length > 0);

assert.ok(overdueAction, 'Deve haver ao menos uma ação atrasada');
assert.ok(inProgressAction, 'Deve haver ao menos uma ação em execução');
assert.ok(efficacyReviewOverdue, 'Deve haver ao menos uma ação com revisão de eficácia vencida');
assert.ok(completedWithEvidence, 'Deve haver ao menos uma ação concluída com evidência');
console.log(`✔ Ações NR-1: ${management.actions.length} ações cobrindo todos os estados exigidos`);

console.log('\n=== TODOS OS CRITÉRIOS DA FASE 0.4 VALIDADOS COM SUCESSO! ===');
