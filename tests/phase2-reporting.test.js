const test = require('node:test');
const assert = require('node:assert/strict');
const {
  buildCycleReport,
  partitionSegments,
  buildParticipationSummary,
  generateRuleBasedSummary,
  preflightSurveyAudience,
  DEFAULT_MIN_RESULTS
} = require('../src/domain/reporting');
const { classifyFactor, evaluateTrend, REFERENCE_BANDS_CONFIG } = require('../src/config/referenceBands');
const { surveyInstrument, snapshotInstrument, instrumentForModel } = require('../src/domain/instruments');
const hseInstrument = require('../src/domain/hseInstrument');

test('Fase 2.1: Classificação de faixas de referência e tendências', () => {
  // Adequado (>= 3.6)
  const c1 = classifyFactor(3.60);
  assert.equal(c1.level, 'adequado');
  assert.equal(c1.icon, '✓');
  assert.ok(c1.disclaimer.includes('referência operacional'));

  // Cuidado (2.8 a 3.59)
  const c2 = classifyFactor(3.15);
  assert.equal(c2.level, 'cuidado');
  assert.equal(c2.icon, '⚠️');

  // Atenção (< 2.8)
  const c3 = classifyFactor(2.50);
  assert.equal(c3.level, 'atencao');
  assert.equal(c3.icon, '❗');

  // Direção ambígua ou não declarada: não classifica
  const c4 = classifyFactor(4.2, 'ambiguous');
  assert.equal(c4.level, 'unclassified');
  assert.equal(c4.label, 'Sem faixa de referência para este fator');

  // Tendências com tolerância de 0.10
  assert.equal(evaluateTrend(0.08), 'estavel');
  assert.equal(evaluateTrend(-0.10), 'estavel');
  assert.equal(evaluateTrend(0.12), 'melhorou');
  assert.equal(evaluateTrend(-0.25), 'piorou');
});

function makeValidAnswers(instrument, overrides = {}) {
  const ans = {};
  for (const [key] of instrument.factors) {
    ans[key] = overrides[key] !== undefined ? overrides[key] : 3;
  }
  return ans;
}

test('Fase 2.2: Partição de segmentos e proteção contra inferência residual', () => {
  const instrument = surveyInstrument({ model: 'organizacao' });

  // Cenário: 4 segmentos onde 2 são pequenos (A=2, B=3, C=6, D=8)
  // Subtrair C(6) e D(8) do total(19) resultaria em 5, mas se A e B fossem exibidos isoladamente haveria vazamento.
  // O algoritmo deve unir A(2) e B(3) em "Demais áreas (agrupadas)" com n=5 >= 5.
  const segments = [
    { id: 'seg-a', name: 'Área Alfa', invited: 4 },
    { id: 'seg-b', name: 'Área Beta', invited: 5 },
    { id: 'seg-c', name: 'Área Gama', invited: 10 },
    { id: 'seg-d', name: 'Área Delta', invited: 12 },
  ];

  const dummyAnswers = makeValidAnswers(instrument);

  const responses = [
    // 2 para Alfa
    { id: 'r1', segmentId: 'seg-a', answers: dummyAnswers },
    { id: 'r2', segmentId: 'seg-a', answers: dummyAnswers },
    // 3 para Beta
    { id: 'r3', segmentId: 'seg-b', answers: dummyAnswers },
    { id: 'r4', segmentId: 'seg-b', answers: dummyAnswers },
    { id: 'r5', segmentId: 'seg-b', answers: dummyAnswers },
    // 6 para Gama
    ...Array.from({ length: 6 }, (_, i) => ({ id: `rg-${i}`, segmentId: 'seg-c', answers: dummyAnswers })),
    // 8 para Delta
    ...Array.from({ length: 8 }, (_, i) => ({ id: `rd-${i}`, segmentId: 'seg-d', answers: dummyAnswers }))
  ];

  const partition = partitionSegments({ segments, responses, minResults: 5, instrument });

  assert.equal(partition.hasMatrix, true);
  assert.equal(partition.buckets.length, 3);

  // Nenhum bucket pode ter n < 5
  for (const bucket of partition.buckets) {
    assert.ok(bucket.n >= 5, `Bucket ${bucket.name} tem n=${bucket.n} < 5`);
  }

  const mergedBucket = partition.buckets.find(b => b.isMerged);
  assert.ok(mergedBucket, 'Deveria existir um bucket resultante da mesclagem');
  assert.equal(mergedBucket.name, 'Demais áreas (agrupadas)');
  assert.equal(mergedBucket.n, 5);
  assert.deepEqual(mergedBucket.originalSegments.sort(), ['Área Alfa', 'Área Beta'].sort());
});

test('Fase 2.3: Partição quando sobra apenas um único bucket (não há matriz)', () => {
  const instrument = surveyInstrument({ model: 'organizacao' });
  const segments = [
    { id: 'seg-x', name: 'Área Pequena 1', invited: 4 },
    { id: 'seg-y', name: 'Área Pequena 2', invited: 4 },
  ];
  const dummyAnswers = makeValidAnswers(instrument);
  const responses = [
    { id: 'r1', segmentId: 'seg-x', answers: dummyAnswers },
    { id: 'r2', segmentId: 'seg-x', answers: dummyAnswers },
    { id: 'r3', segmentId: 'seg-y', answers: dummyAnswers },
    { id: 'r4', segmentId: 'seg-y', answers: dummyAnswers },
    { id: 'r5', segmentId: 'seg-y', answers: dummyAnswers },
  ];

  const partition = partitionSegments({ segments, responses, minResults: 5, instrument });
  assert.equal(partition.hasMatrix, false);
  assert.equal(partition.buckets.length, 0);
  assert.ok(partition.notes.includes('total coletivo'));
});

test('Fase 2.4: Supressão por respostas abaixo do mínimo com razão clara e acionável', () => {
  const survey = {
    id: 'srv-sub-min',
    accountId: 'acc-1',
    title: 'Pesquisa Pequena',
    cycle: '2026-Q1',
    model: 'organizacao',
    memberIds: ['m1', 'm2', 'm3', 'm4']
  };
  const instrument = surveyInstrument(survey);
  const dummyAnswers = makeValidAnswers(instrument);
  const responses = [
    { id: 'r1', answers: dummyAnswers },
    { id: 'r2', answers: dummyAnswers }
  ];

  const report = buildCycleReport({ survey, instrument, responses, minResults: 5 });
  assert.equal(report.published, false);
  assert.equal(report.publication.status, 'suppressed');
  assert.equal(report.publication.reasons.length, 1);
  assert.equal(report.publication.reasons[0].code, 'below_min_responses');
  assert.ok(report.publication.reasons[0].message.includes('Menos de 5 respostas'));
  assert.ok(report.publication.reasons[0].action.includes('Convide ao menos 5'));
  assert.equal(report.factors, null);
  assert.equal(report.segmentation, null);
});

test('Fase 2.5: Supressão por sobreposição de públicos com outro ciclo fechado', () => {
  const survey = {
    id: 'srv-overlap-current',
    accountId: 'acc-1',
    title: 'Ciclo 2',
    cycle: '2026-Q2',
    model: 'organizacao',
    memberIds: ['m1', 'm2', 'm3', 'm4', 'm5', 'm6', 'm7'] // 7 membros
  };
  const otherSurvey = {
    id: 'srv-overlap-prev',
    accountId: 'acc-1',
    title: 'Ciclo 1',
    cycle: '2026-Q1',
    status: 'closed',
    result: [{ key: 'volume', average: 3.5 }],
    memberIds: ['m1', 'm2', 'm3', 'm4', 'm5', 'm6', 'm8'] // 7 membros, 6 em comum, diff = 1 < 5!
  };

  const instrument = surveyInstrument(survey);
  const dummyAnswers = makeValidAnswers(instrument);
  const responses = Array.from({ length: 6 }, (_, i) => ({ id: `r-${i}`, answers: dummyAnswers }));

  const report = buildCycleReport({
    survey,
    instrument,
    responses,
    previousSurveys: [otherSurvey],
    minResults: 5
  });

  assert.equal(report.published, false);
  assert.equal(report.publication.status, 'suppressed');
  const overlapReason = report.publication.reasons.find(r => r.code === 'overlap_with_cycle');
  assert.ok(overlapReason, 'Deveria identificar a razão de sobreposição');
  assert.equal(overlapReason.conflictingCycleId, 'srv-overlap-prev');
  assert.ok(overlapReason.message.includes('Ciclo 1'));
  assert.ok(overlapReason.action.includes('Evite repetir este público'));
});

test('Fase 2.6: Instrumento HSE com subescalas e itens invertidos', () => {
  const survey = {
    id: 'srv-hse-test',
    accountId: 'acc-1',
    title: 'Escuta HSE',
    cycle: '2026-HSE',
    model: 'hse-indicator-pt',
    memberIds: Array.from({ length: 10 }, (_, i) => `m-${i}`)
  };
  const instrument = hseInstrument;

  // Monta respostas para os 35 itens do HSE
  const answers = {};
  for (let i = 1; i <= 35; i++) answers[`hse_${i}`] = 4; // Resposta 4 em tudo
  // No item 3 (invertido), a resposta 4 vira 6 - 4 = 2 na subescala Demandas

  const responses = Array.from({ length: 6 }, (_, i) => ({ id: `r-${i}`, answers }));

  const report = buildCycleReport({ survey, instrument, responses, minResults: 5 });
  assert.equal(report.published, true);
  assert.equal(report.publication.status, 'published');
  assert.ok(report.factors.length > 0);
  assert.ok(report.factors.some(f => f.key === 'demandas'));

  // HSE não inventa distribuição ordinal de 5 pontos
  assert.equal(report.distribution, null);
});

test('Fase 2.7: Comparação de ciclo e cálculo de deltas', () => {
  const survey = {
    id: 'srv-curr',
    accountId: 'acc-1',
    title: 'Ciclo 2026-Q2',
    cycle: '2026-Q2',
    model: 'organizacao',
    audienceFingerprint: 'fp-123',
    closedAt: '2026-06-01T00:00:00Z',
    memberIds: Array.from({ length: 15 }, (_, i) => `m-${i}`)
  };
  const instrument = surveyInstrument(survey);

  const prevReport = {
    id: 'rep-prev',
    surveyId: 'srv-prev',
    published: true,
    cycle: '2026-Q1',
    closedAt: '2026-03-01T00:00:00Z',
    audienceFingerprint: 'fp-123',
    instrument: { id: instrument.id, version: instrument.version },
    result: instrument.factors.map(([k]) => ({ key: k, label: k, average: 3.0 }))
  };

  // Respostas atuais com média 4.0 em autonomia (+1.00 -> melhorou) e 2.0 em demandas (-1.00 -> piorou)
  const responses = Array.from({ length: 8 }, (_, i) => ({
    id: `r-${i}`,
    answers: makeValidAnswers(instrument, {
      autonomia: 4,
      demandas: 2
    })
  }));

  const report = buildCycleReport({
    survey,
    instrument,
    responses,
    previousReports: [prevReport],
    minResults: 5
  });

  assert.equal(report.published, true);
  assert.equal(report.comparison.comparable, true);

  const autonomiaFactor = report.factors.find(f => f.key === 'autonomia');
  assert.equal(autonomiaFactor.delta, 1.00);
  assert.equal(autonomiaFactor.trend, 'melhorou');

  const demandasFactor = report.factors.find(f => f.key === 'demandas');
  assert.equal(demandasFactor.delta, -1.00);
  assert.equal(demandasFactor.trend, 'piorou');

  // Resumo automático
  assert.ok(report.summary.text.toLowerCase().includes('autonomia'));
  assert.ok(report.summary.text.toLowerCase().includes('demandas'));
  assert.ok(report.summary.disclaimer.includes('regra matemática'));
});

test('Fase 2.8: Pré-visualização de impacto (preflight)', () => {
  const accountGroups = [
    { id: 'g1', name: 'Operações', memberIds: ['m1', 'm2', 'm3', 'm4', 'm5', 'm6', 'm7', 'm8'] },
    { id: 'g2', name: 'Jurídico', memberIds: ['m9', 'm10', 'm11'] } // 3 membros (< 5)
  ];
  const closedSurveys = [
    {
      id: 'srv-closed-1',
      title: 'Ciclo Anterior',
      status: 'closed',
      memberIds: ['m1', 'm2', 'm3', 'm4', 'm5', 'm6', 'm7', 'm8', 'm9', 'm10', 'm11', 'm12'] // diff = 1!
    }
  ];

  const preflight = preflightSurveyAudience({
    groupIds: ['g1', 'g2'],
    accountGroups,
    closedSurveys,
    minResults: 5
  });

  assert.equal(preflight.audienceSize, 11);
  assert.equal(preflight.segmentsCount, 2);
  assert.equal(preflight.smallSegmentsCount, 1);
  assert.equal(preflight.segments.find(s => s.name === 'Jurídico').willBeGroupedIfSmall, true);
  assert.equal(preflight.overlapConflicts.length, 1);
  assert.equal(preflight.prediction.publishable, false);
});

test('Fase 2.9 (Propriedade de Segurança): Nenhum número de bucket com n < minResults em relatórios publicados', () => {
  const instrument = surveyInstrument({ model: 'organizacao' });
  const segments = [
    { id: 's1', name: 'Área 1', invited: 3 },
    { id: 's2', name: 'Área 2', invited: 4 },
    { id: 's3', name: 'Área 3', invited: 2 },
    { id: 's4', name: 'Área 4', invited: 7 }
  ];

  const dummyAnswers = makeValidAnswers(instrument);

  const responses = [
    { id: 'r1', segmentId: 's1', answers: dummyAnswers },
    { id: 'r2', segmentId: 's2', answers: dummyAnswers },
    { id: 'r3', segmentId: 's3', answers: dummyAnswers },
    ...Array.from({ length: 6 }, (_, i) => ({ id: `r4-${i}`, segmentId: 's4', answers: dummyAnswers }))
  ];

  const survey = {
    id: 'srv-prop-test',
    accountId: 'acc-prop',
    title: 'Teste de Propriedade',
    cycle: '2026',
    model: 'organizacao',
    segments,
    memberIds: Array.from({ length: 16 }, (_, i) => `m-${i}`)
  };

  const report = buildCycleReport({ survey, instrument, responses, minResults: 5 });

  if (report.published && report.segmentation && report.segmentation.hasMatrix) {
    for (const b of report.segmentation.buckets) {
      assert.ok(b.n >= 5, `Bucket ${b.name} violou propriedade: n=${b.n} < 5`);
    }
  }

  if (report.participation && report.participation.segments) {
    for (const s of report.participation.segments) {
      assert.ok(s.responded >= 5, `Segmento de participação ${s.name} violou propriedade: responded=${s.responded} < 5`);
    }
  }
});
