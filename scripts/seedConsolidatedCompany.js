const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const { snapshotInstrument, TEMPLATES } = require('../src/domain/instruments');
const { aggregate, summarizeDistribution, compareReports } = require('../src/domain/analysis');
const passwordService = require('../src/services/passwordService');
const plans = require('../src/config/plans');

// Nunca toca na pasta data/ se não for explicitamente configurado.
// Padrão seguro: data-demo ou process.env.EQUILIBRA_DATA_DIR
const DATA_DIR = process.env.EQUILIBRA_DATA_DIR || path.join(__dirname, '..', 'data-demo');
const ACC_ID = '53739463-e3fc-476a-8c45-a290fd89e72f';

function hash(val) {
  return crypto.createHash('sha256').update(val).digest('hex');
}
function uuid() {
  return crypto.randomUUID();
}

function loadJson(name) {
  const filePath = path.join(DATA_DIR, `${name}.json`);
  if (!fs.existsSync(filePath)) return [];
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function saveJson(name, data) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(path.join(DATA_DIR, `${name}.json`), JSON.stringify(data, null, 2) + '\n', 'utf8');
}

/**
 * Gera respostas de escala 1-5 com médias e variações realistas por segmento e fator.
 * Garante que em grandes amostras cada nota (1..5) tenha contagem >= 5 para evitar supressão geral.
 */
function generateRealisticAnswers(count, factorProfiles) {
  const FACTORS = [
    'demandas',
    'autonomia',
    'apoio',
    'relacoes',
    'reconhecimento',
    'jornada',
    'mudancas',
    'seguranca'
  ];

  const results = Array.from({ length: count }, () => ({}));

  FACTORS.forEach(f => {
    // profile define pesos para notas [1, 2, 3, 4, 5]
    const weights = factorProfiles[f] || [0.1, 0.15, 0.25, 0.35, 0.15];
    const sumW = weights.reduce((a, b) => a + b, 0);
    const norm = weights.map(w => w / sumW);

    if (count >= 25) {
      // Garante baseline de 5 de cada nota para distribuição não suprimida no agregado
      const baseline = [1,1,1,1,1, 2,2,2,2,2, 3,3,3,3,3, 4,4,4,4,4, 5,5,5,5,5];
      baseline.sort(() => Math.random() - 0.5);
      for (let i = 0; i < 25; i++) {
        results[i][f] = baseline[i];
      }
      for (let i = 25; i < count; i++) {
        const rand = Math.random();
        let cumulative = 0;
        let chosen = 3;
        for (let s = 0; s < 5; s++) {
          cumulative += norm[s];
          if (rand <= cumulative) {
            chosen = s + 1;
            break;
          }
        }
        results[i][f] = chosen;
      }
    } else {
      for (let i = 0; i < count; i++) {
        const rand = Math.random();
        let cumulative = 0;
        let chosen = 3;
        for (let s = 0; s < 5; s++) {
          cumulative += norm[s];
          if (rand <= cumulative) {
            chosen = s + 1;
            break;
          }
        }
        results[i][f] = chosen;
      }
    }
  });

  results.sort(() => Math.random() - 0.5);
  return results;
}

function runSeed() {
  console.log(`--- Iniciando Seed da Empresa Consolidada [DEMO] em: ${DATA_DIR} ---`);

  // 1. USUÁRIOS E ORGANIZAÇÃO
  const existingAccounts = loadJson('accounts');
  const otherAccounts = existingAccounts.filter(a => a.id !== ACC_ID && a.organizationId !== ACC_ID);

  const userAcc = {
    id: ACC_ID,
    company: 'Zenai Soluções Tecnológicas [DEMO]',
    name: 'Nycolas (Gestor RH)',
    email: 'nycolas@zenai.com.br',
    role: 'owner',
    passwordHash: passwordService.derive('Equilibra2026!'),
    createdAt: '2025-06-15T09:00:00.000Z'
  };

  const teamMember1 = {
    id: 'user-mariana-rh-zenai',
    organizationId: ACC_ID,
    name: 'Mariana Costa (Coord. RH)',
    company: userAcc.company,
    email: 'mariana.costa@zenai.com.br',
    role: 'editor',
    passwordHash: passwordService.derive('Equilibra2026!'),
    createdAt: '2025-08-20T10:00:00.000Z'
  };

  const teamMember2 = {
    id: 'user-carlos-sst-zenai',
    organizationId: ACC_ID,
    name: 'Dr. Carlos Eduardo (SST)',
    company: userAcc.company,
    email: 'carlos.eduardo@zenai.com.br',
    role: 'viewer',
    passwordHash: passwordService.derive('Equilibra2026!'),
    createdAt: '2025-09-01T14:30:00.000Z'
  };

  const updatedAccounts = [...otherAccounts, userAcc, teamMember1, teamMember2];

  // 2. 181 COLABORADORES EM 7 ÁREAS DE TAMANHOS VARIADOS (1 área pequena < 5)
  // Operações (48), Tecnologia (42), Comercial (36), Atendimento (28), Financeiro (15), RH (8), Jurídico (4)
  const areasConfig = [
    { id: 'grp-operacoes', name: 'Operações', count: 48, color: '#2E7D52' },
    { id: 'grp-tecnologia', name: 'Tecnologia', count: 42, color: '#432874' },
    { id: 'grp-comercial', name: 'Comercial & Vendas', count: 36, color: '#C25E00' },
    { id: 'grp-atendimento', name: 'Atendimento ao Cliente', count: 28, color: '#0070BA' },
    { id: 'grp-financeiro', name: 'Financeiro & Controladoria', count: 15, color: '#7B1FA2' },
    { id: 'grp-rh', name: 'Recursos Humanos', count: 8, color: '#C2185B' },
    { id: 'grp-juridico', name: 'Diretoria & Jurídico', count: 4, color: '#455A64' } // < 5 para testar agrupamento!
  ];

  const members = [];
  const groups = [];
  let memberSequence = 1;
  const allMemberIds = [];

  for (const area of areasConfig) {
    const groupMemberIds = [];
    for (let i = 0; i < area.count; i++) {
      const mId = `mbr-zenai-${String(memberSequence).padStart(3, '0')}`;
      members.push({
        id: mId,
        accountId: ACC_ID,
        name: `Colaborador Fictício ${memberSequence}`,
        email: `colaborador${memberSequence}@zenai-demo.test`,
        phone: `1198888${String(memberSequence).padStart(4, '0')}`,
        createdAt: '2025-06-20T10:00:00.000Z'
      });
      groupMemberIds.push(mId);
      allMemberIds.push(mId);
      memberSequence++;
    }

    groups.push({
      id: area.id,
      accountId: ACC_ID,
      name: area.name,
      memberIds: groupMemberIds,
      color: area.color,
      createdAt: '2025-06-20T10:00:00.000Z'
    });
  }

  // Grupo Geral com todos os 181
  const generalGroup = {
    id: 'grp-geral',
    accountId: ACC_ID,
    name: 'Geral',
    memberIds: [...allMemberIds],
    color: '#581c43',
    createdAt: '2025-06-20T10:05:00.000Z'
  };
  groups.unshift(generalGroup);

  // Mapeamento snapshot de segmentos para pesquisas gerais
  const segmentsSnapshot = areasConfig.map(a => ({
    id: a.id,
    name: a.name,
    invited: a.count
  }));

  // Mapeamento membro -> segmentId
  const memberSegmentMap = {};
  for (const area of areasConfig) {
    for (const mId of groups.find(g => g.id === area.id).memberIds) {
      memberSegmentMap[mId] = area.id;
    }
  }

  const defaultInstrument = snapshotInstrument('Diagnóstico inicial');
  const hseInstrument = TEMPLATES.find(t => t.id === 'hse-indicator-pt') || snapshotInstrument('HSE — indicador de estresse (português publicado)');

  const audienceFingerprint = hash([...allMemberIds].sort().join(':'));

  // 3. DEFINIÇÃO DE CICLOS E PESQUISAS
  // - 4 ciclos fechados compatíveis (Diagnóstico inicial, Geral, 181 pessoas) com evolução temporal
  // - 1 ciclo fechado com HSE (35 itens)
  // - 1 ciclo suprimido por sobreposição (overlap que deixa diferença < 5)
  // - 1 ciclo aberto com participação parcial (~58%)
  // - 1 ciclo em rascunho

  const surveys = [];
  const reports = [];
  const responses = [];
  const invitations = [];

  // Profiles por ciclo para simular evolução realista:
  // Ciclo 1 (Base - 4º Tri 2025): Demandas moderadas/altas, autonomia média, apoio bom
  const profileC1 = {
    demandas: [0.15, 0.25, 0.35, 0.15, 0.10], // média ~2.8
    autonomia: [0.05, 0.15, 0.30, 0.35, 0.15], // média ~3.4
    apoio: [0.05, 0.10, 0.25, 0.40, 0.20], // média ~3.6
    relacoes: [0.05, 0.10, 0.20, 0.45, 0.20], // média ~3.65
    reconhecimento: [0.15, 0.25, 0.35, 0.15, 0.10], // média ~2.8
    jornada: [0.10, 0.25, 0.35, 0.20, 0.10], // média ~2.95
    mudancas: [0.10, 0.20, 0.40, 0.20, 0.10], // média ~3.0
    seguranca: [0.05, 0.10, 0.25, 0.40, 0.20] // média ~3.6
  };

  // Ciclo 2 (1º Tri 2026): Piora em demandas e jornada (pico de trabalho), melhoria em reconhecimento
  const profileC2 = {
    demandas: [0.25, 0.35, 0.25, 0.10, 0.05], // piorou para ~2.35
    autonomia: [0.05, 0.15, 0.30, 0.35, 0.15], // ~3.4
    apoio: [0.05, 0.10, 0.25, 0.40, 0.20], // ~3.6
    relacoes: [0.05, 0.10, 0.20, 0.45, 0.20], // ~3.65
    reconhecimento: [0.05, 0.15, 0.30, 0.35, 0.15], // melhorou para ~3.4
    jornada: [0.20, 0.35, 0.25, 0.15, 0.05], // piorou para ~2.5
    mudancas: [0.10, 0.20, 0.40, 0.20, 0.10], // ~3.0
    seguranca: [0.05, 0.10, 0.25, 0.40, 0.20] // ~3.6
  };

  // Ciclo 3 (2º Tri 2026): Ações surtindo efeito! Demandas e jornada recuperando
  const profileC3 = {
    demandas: [0.10, 0.15, 0.35, 0.30, 0.10], // melhorou para ~3.15
    autonomia: [0.05, 0.10, 0.30, 0.40, 0.15], // ~3.5
    apoio: [0.05, 0.05, 0.25, 0.45, 0.20], // ~3.7
    relacoes: [0.05, 0.10, 0.20, 0.45, 0.20], // ~3.65
    reconhecimento: [0.05, 0.10, 0.30, 0.40, 0.15], // ~3.5
    jornada: [0.10, 0.15, 0.35, 0.30, 0.10], // recuperou para ~3.15
    mudancas: [0.05, 0.15, 0.40, 0.30, 0.10], // ~3.25
    seguranca: [0.05, 0.10, 0.25, 0.40, 0.20] // ~3.6
  };

  // Ciclo 4 (Junho 2026): Consolidação de melhorias
  const profileC4 = {
    demandas: [0.05, 0.15, 0.35, 0.35, 0.10], // ~3.3
    autonomia: [0.05, 0.10, 0.25, 0.40, 0.20], // ~3.6
    apoio: [0.05, 0.05, 0.20, 0.50, 0.20], // ~3.75
    relacoes: [0.05, 0.05, 0.20, 0.50, 0.20], // ~3.75
    reconhecimento: [0.05, 0.10, 0.25, 0.40, 0.20], // ~3.6
    jornada: [0.05, 0.15, 0.35, 0.35, 0.10], // ~3.3
    mudancas: [0.05, 0.15, 0.35, 0.35, 0.10], // ~3.3
    seguranca: [0.05, 0.05, 0.25, 0.45, 0.20] // ~3.7
  };

  const closedCycleDefs = [
    {
      id: 'c1c10001-2025-4a01-8001-zenai0000001',
      title: 'Diagnóstico Institucional de Fatores Psicossociais 2025',
      cycle: '4º trimestre de 2025',
      model: 'Diagnóstico inicial',
      openedAt: '2025-10-15T09:00:00.000Z',
      closedAt: '2025-11-28T18:00:00.000Z',
      day: '2025-11-10',
      profile: profileC1,
      responseRate: 0.85
    },
    {
      id: 'c1c10002-2026-4a02-8002-zenai0000002',
      title: 'Pulso Institucional do 1º Trimestre 2026',
      cycle: '1º trimestre de 2026',
      model: 'Diagnóstico inicial',
      openedAt: '2026-02-01T09:00:00.000Z',
      closedAt: '2026-02-27T18:00:00.000Z',
      day: '2026-02-15',
      profile: profileC2,
      responseRate: 0.82
    },
    {
      id: 'c1c10003-2026-4a03-8003-zenai0000003',
      title: 'Pulso Institucional do 2º Trimestre 2026',
      cycle: '2º trimestre de 2026',
      model: 'Diagnóstico inicial',
      openedAt: '2026-04-15T09:00:00.000Z',
      closedAt: '2026-05-20T18:00:00.000Z',
      day: '2026-05-05',
      profile: profileC3,
      responseRate: 0.88
    },
    {
      id: 'c1c10004-2026-4a04-8004-zenai0000004',
      title: 'Pulso Geral de Acompanhamento - Meio de Ano 2026',
      cycle: 'junho de 2026',
      model: 'Diagnóstico inicial',
      openedAt: '2026-06-01T09:00:00.000Z',
      closedAt: '2026-06-29T18:00:00.000Z',
      day: '2026-06-18',
      profile: profileC4,
      responseRate: 0.86
    }
  ];

  // Gera dados para os 4 ciclos fechados compatíveis
  for (const cDef of closedCycleDefs) {
    const surveyResponses = [];
    const respondingCount = Math.round(allMemberIds.length * cDef.responseRate);
    const respondingMemberIds = new Set(allMemberIds.slice(0, respondingCount));

    // Garante que o grupo pequeno (Jurídico, 4 pessoas) tenha 2 ou 3 respostas (< 5)
    // para exercitar agrupamento
    const juridicoMembers = groups.find(g => g.id === 'grp-juridico').memberIds;
    juridicoMembers.forEach((mId, idx) => {
      if (idx < 2) respondingMemberIds.add(mId);
      else respondingMemberIds.delete(mId);
    });

    const answersList = generateRealisticAnswers(respondingMemberIds.size, cDef.profile);
    let ansIdx = 0;

    for (const mId of allMemberIds) {
      const segId = memberSegmentMap[mId];
      const isResponding = respondingMemberIds.has(mId);
      const token = hash(`token-${cDef.id}-${mId}`);
      const tokenHash = hash(token);

      invitations.push({
        id: `inv-${cDef.id}-${mId}`,
        accountId: ACC_ID,
        surveyId: cDef.id,
        tokenHash,
        segmentId: segId,
        used: isResponding,
        usedDay: isResponding ? cDef.day : null,
        createdAt: cDef.openedAt
      });

      if (isResponding) {
        const row = {
          id: `rsp-${cDef.id}-${mId}`,
          accountId: ACC_ID,
          surveyId: cDef.id,
          segmentId: segId,
          submittedDay: cDef.day,
          answers: answersList[ansIdx++]
        };
        surveyResponses.push(row);
        responses.push(row);
      }
    }

    const sResult = aggregate(surveyResponses, defaultInstrument);
    const sDistribution = summarizeDistribution(surveyResponses, defaultInstrument);

    surveys.push({
      id: cDef.id,
      accountId: ACC_ID,
      title: cDef.title,
      cycle: cDef.cycle,
      model: cDef.model,
      groupIds: [generalGroup.id],
      groupId: generalGroup.id,
      memberIds: [...allMemberIds],
      segments: segmentsSnapshot,
      participationTarget: 0.70,
      endsAt: cDef.closedAt,
      status: 'closed',
      createdAt: cDef.openedAt,
      openedAt: cDef.openedAt,
      closedAt: cDef.closedAt,
      instrument: defaultInstrument,
      collectionChannel: 'web',
      audienceFingerprint,
      groupNamesSnapshot: ['Geral'],
      result: sResult,
      responseCount: surveyResponses.length
    });

    reports.push({
      id: `rep-${cDef.id}`,
      accountId: ACC_ID,
      surveyId: cDef.id,
      title: cDef.title,
      cycle: cDef.cycle,
      model: cDef.model,
      groupName: 'Geral',
      closedAt: cDef.closedAt,
      published: true,
      responseCount: surveyResponses.length,
      result: sResult,
      instrument: defaultInstrument,
      audienceFingerprint,
      distribution: sDistribution,
      methodology: 'Questionário exploratório, versão 1',
      schemaVersion: 2
    });
  }

  // 4. CICLO FECHADO COM HSE (35 itens, 7 subescalas)
  const hseSurveyId = 'c1c10005-2026-4a05-8005-zenai0000005';
  const hseClosedAt = '2026-07-31T18:00:00.000Z';
  const hseOpenedAt = '2026-07-01T09:00:00.000Z';
  const hseRespondingCount = 145; // ~80%
  const hseResponses = [];

  for (let i = 0; i < allMemberIds.length; i++) {
    const mId = allMemberIds[i];
    const segId = memberSegmentMap[mId];
    const isResponding = i < hseRespondingCount;
    const token = hash(`token-hse-${mId}`);
    const tokenHash = hash(token);

    invitations.push({
      id: `inv-hse-${mId}`,
      accountId: ACC_ID,
      surveyId: hseSurveyId,
      tokenHash,
      segmentId: segId,
      used: isResponding,
      usedDay: isResponding ? '2026-07-20' : null,
      createdAt: hseOpenedAt
    });

    if (isResponding) {
      // 35 itens inteiros 1-5
      const answers = {};
      for (let q = 1; q <= 35; q++) {
        answers[`hse_${q}`] = Math.floor(Math.random() * 5) + 1;
      }
      const row = {
        id: `rsp-hse-${mId}`,
        accountId: ACC_ID,
        surveyId: hseSurveyId,
        segmentId: segId,
        submittedDay: '2026-07-20',
        answers
      };
      hseResponses.push(row);
      responses.push(row);
    }
  }

  const hseResult = aggregate(hseResponses, hseInstrument);

  surveys.push({
    id: hseSurveyId,
    accountId: ACC_ID,
    title: 'Avaliação de Padrões de Gestão (Instrumento HSE)',
    cycle: 'julho de 2026',
    model: hseInstrument.name,
    groupIds: [generalGroup.id],
    groupId: generalGroup.id,
    memberIds: [...allMemberIds],
    segments: segmentsSnapshot,
    participationTarget: 0.70,
    endsAt: hseClosedAt,
    status: 'closed',
    createdAt: hseOpenedAt,
    openedAt: hseOpenedAt,
    closedAt: hseClosedAt,
    instrument: hseInstrument,
    collectionChannel: 'web',
    audienceFingerprint,
    groupNamesSnapshot: ['Geral'],
    result: hseResult,
    responseCount: hseResponses.length
  });

  reports.push({
    id: `rep-${hseSurveyId}`,
    accountId: ACC_ID,
    surveyId: hseSurveyId,
    title: 'Avaliação de Padrões de Gestão (Instrumento HSE)',
    cycle: 'julho de 2026',
    model: hseInstrument.name,
    groupName: 'Geral',
    closedAt: hseClosedAt,
    published: true,
    responseCount: hseResponses.length,
    result: hseResult,
    instrument: hseInstrument,
    audienceFingerprint,
    distribution: null, // HSE não usa distribuição de 5 níveis
    methodology: 'Instrumento HSE (35 itens, 7 subescalas)',
    schemaVersion: 2
  });

  // 5. CICLO SUPRIMIDO POR SOBREPOSIÇÃO (overlap com ciclo recente que deixa diferença < 5)
  const overlapSurveyId = 'c1c10006-2026-4a06-8006-zenai0000006';
  const overlapOpenedAt = '2026-08-01T09:00:00.000Z';
  const overlapClosedAt = '2026-08-20T18:00:00.000Z';
  // Público quase idêntico ao Geral (181 menos 3 membros = 178 membros, diferença de 3 < MIN_RESULTS=5)
  const overlapMemberIds = allMemberIds.slice(0, 178);
  const overlapFingerprint = hash([...overlapMemberIds].sort().join(':'));

  surveys.push({
    id: overlapSurveyId,
    accountId: ACC_ID,
    title: 'Escuta Extraordinária de Alinhamento',
    cycle: 'agosto de 2026',
    model: 'Diagnóstico inicial',
    groupIds: [generalGroup.id],
    groupId: generalGroup.id,
    memberIds: overlapMemberIds,
    segments: segmentsSnapshot,
    participationTarget: 0.70,
    endsAt: overlapClosedAt,
    status: 'closed',
    createdAt: overlapOpenedAt,
    openedAt: overlapOpenedAt,
    closedAt: overlapClosedAt,
    instrument: defaultInstrument,
    collectionChannel: 'web',
    audienceFingerprint: overlapFingerprint,
    groupNamesSnapshot: ['Geral (subconjunto)'],
    result: null,
    responseCount: 150
  });

  reports.push({
    id: `rep-${overlapSurveyId}`,
    accountId: ACC_ID,
    surveyId: overlapSurveyId,
    title: 'Escuta Extraordinária de Alinhamento',
    cycle: 'agosto de 2026',
    model: 'Diagnóstico inicial',
    groupName: 'Geral (subconjunto)',
    closedAt: overlapClosedAt,
    published: false,
    suppressionReason: 'Público com sobreposição quase total com ciclo recente (diferença menor que 5 pessoas). Resultados protegidos para evitar identificação individual.',
    responseCount: null,
    result: null,
    instrument: defaultInstrument,
    audienceFingerprint: overlapFingerprint,
    distribution: null,
    methodology: 'Questionário exploratório, versão 1',
    schemaVersion: 2
  });

  // 6. CICLO ABERTO COM PARTICIPAÇÃO PARCIAL (~58% de adesão)
  const openSurveyId = 'c1c10007-2026-4a07-8007-zenai0000007';
  const openOpenedAt = '2026-09-15T09:00:00.000Z';
  const openEndsAt = '2026-11-15T23:59:59.000Z';
  const openRespondingCount = 105; // 105 / 181 = 58%

  surveys.push({
    id: openSurveyId,
    accountId: ACC_ID,
    title: 'Pulso Institucional do 3º Trimestre 2026',
    cycle: '3º trimestre de 2026',
    model: 'Diagnóstico inicial',
    groupIds: [generalGroup.id],
    groupId: generalGroup.id,
    memberIds: [...allMemberIds],
    segments: segmentsSnapshot,
    participationTarget: 0.70,
    endsAt: openEndsAt,
    status: 'open',
    createdAt: openOpenedAt,
    openedAt: openOpenedAt,
    instrument: defaultInstrument,
    collectionChannel: 'web',
    audienceFingerprint,
    groupNamesSnapshot: ['Geral']
  });

  for (let i = 0; i < allMemberIds.length; i++) {
    const mId = allMemberIds[i];
    const segId = memberSegmentMap[mId];
    const isResponding = i < openRespondingCount;
    const token = hash(`token-open-${mId}`);
    const tokenHash = hash(token);

    invitations.push({
      id: `inv-open-${mId}`,
      accountId: ACC_ID,
      surveyId: openSurveyId,
      tokenHash,
      segmentId: segId,
      used: isResponding,
      usedDay: isResponding ? '2026-09-25' : null,
      createdAt: openOpenedAt
    });

    if (isResponding) {
      responses.push({
        id: `rsp-open-${mId}`,
        accountId: ACC_ID,
        surveyId: openSurveyId,
        segmentId: segId,
        submittedDay: '2026-09-25',
        answers: {
          demandas: 3,
          autonomia: 4,
          apoio: 4,
          relacoes: 4,
          reconhecimento: 3,
          jornada: 3,
          mudancas: 3,
          seguranca: 4
        }
      });
    }
  }

  // 7. CICLO EM RASCUNHO (Planejamento 2027)
  const draftSurveyId = 'c1c10008-2026-4a08-8008-zenai0000008';
  surveys.push({
    id: draftSurveyId,
    accountId: ACC_ID,
    title: 'Planejamento Geral e Diagnóstico 2027',
    cycle: '1º trimestre de 2027',
    model: 'Diagnóstico inicial',
    groupIds: [generalGroup.id],
    groupId: generalGroup.id,
    memberIds: [...allMemberIds],
    segments: segmentsSnapshot,
    participationTarget: 0.70,
    endsAt: '2027-02-28T23:59:59.000Z',
    status: 'draft',
    createdAt: '2026-10-01T10:00:00.000Z',
    instrument: defaultInstrument,
    collectionChannel: 'web',
    groupNamesSnapshot: ['Geral']
  });

  // 8. MÓDULO DE GESTÃO (NR-1)
  // Ações em estados variados:
  // - atrasada (in_progress, dueDate passada)
  // - em execução (in_progress, dueDate futura)
  // - com revisão de eficácia vencida (completed, effectiveReviewDate passada)
  // - concluída com evidência (completed, evidence anexada)
  const assessment1Id = 'asm-001-demandas-ti';
  const assessment2Id = 'asm-002-jornada-operacoes';
  const assessment3Id = 'asm-003-reconhecimento';

  const assessments = [
    {
      id: assessment1Id,
      surveyId: closedCycleDefs[1].id,
      cycle: closedCycleDefs[1].cycle,
      title: 'Sobrecarga de demandas e prazos no setor de Tecnologia',
      category: 'Organização do trabalho',
      classification: 'high',
      status: 'action_plan',
      description: 'Identificado declínio de 0.45 pontos no fator Demandas no Q1 2026.',
      createdAt: '2026-03-05T10:00:00.000Z'
    },
    {
      id: assessment2Id,
      surveyId: closedCycleDefs[0].id,
      cycle: closedCycleDefs[0].cycle,
      title: 'Escalas e pausas inadequadas na Operação',
      category: 'Condições de trabalho',
      classification: 'medium',
      status: 'action_plan',
      description: 'Fator Jornada em nível de atenção na Operação durante a linha de base.',
      createdAt: '2025-12-05T14:00:00.000Z'
    },
    {
      id: assessment3Id,
      surveyId: closedCycleDefs[1].id,
      cycle: closedCycleDefs[1].cycle,
      title: 'Percepção de baixo reconhecimento na equipe comercial',
      category: 'Relações socioprofissionais',
      classification: 'low',
      status: 'monitoring',
      description: 'Acompanhamento trimestral após ajustes de comissionamento.',
      createdAt: '2026-03-10T11:00:00.000Z'
    }
  ];

  const actions = [
    {
      id: 'act-001-atrasada',
      assessmentId: assessment2Id,
      title: 'Reestruturação de pausas térmicas e ergonômicas na Operação',
      priority: 'high',
      owner: 'Dr. Carlos Eduardo (SST)',
      status: 'in_progress',
      dueDate: '2026-04-30T23:59:59.000Z', // Prazo vencido -> Atrasada
      evidence: [],
      createdAt: '2025-12-10T09:00:00.000Z'
    },
    {
      id: 'act-002-em-execucao',
      assessmentId: assessment1Id,
      title: 'Implantação de metodologia ágil para nivelamento de sprints em TI',
      priority: 'high',
      owner: 'Mariana Costa (Coord. RH)',
      status: 'in_progress',
      dueDate: '2026-11-30T23:59:59.000Z', // Prazo futuro -> Em execução
      evidence: [],
      createdAt: '2026-03-15T10:00:00.000Z'
    },
    {
      id: 'act-003-eficacia-vencida',
      assessmentId: assessment1Id,
      title: 'Política de não interrupção e limite de mensagens fora do horário na TI',
      priority: 'medium',
      owner: 'Nycolas (Gestor RH)',
      status: 'completed',
      dueDate: '2026-05-30T23:59:59.000Z',
      effectiveReviewDate: '2026-07-01T00:00:00.000Z', // Revisão de eficácia vencida!
      evidence: [
        {
          id: 'ev-001-politica-desconexao',
          filename: 'politica_desconexao_assinada.pdf',
          registeredAt: '2026-05-28T14:00:00.000Z'
        }
      ],
      createdAt: '2026-03-20T11:00:00.000Z'
    },
    {
      id: 'act-004-concluida',
      assessmentId: assessment2Id,
      title: 'Adequação da ventilação e climatização das áreas operacionais',
      priority: 'high',
      owner: 'Dr. Carlos Eduardo (SST)',
      status: 'completed',
      dueDate: '2026-04-15T23:59:59.000Z',
      effectiveReviewDate: '2026-12-15T00:00:00.000Z', // Eficácia no futuro
      evidence: [
        {
          id: 'ev-002-laudo-climatizacao',
          filename: 'laudo_conclusao_obras_ar.pdf',
          registeredAt: '2026-04-14T16:30:00.000Z'
        }
      ],
      createdAt: '2025-12-15T10:00:00.000Z'
    }
  ];

  const subscriptions = [
    {
      id: 'sub-zenai-pro-2026',
      accountId: ACC_ID,
      plan: 'pro',
      status: 'active',
      startedAt: '2025-08-15T10:00:00.000Z',
      provider: 'mercadopago'
    }
  ];

  // Trilha de auditoria encadeada com hash SHA-256
  const audit = [];
  function addAuditEvent(action, entityId, actorName, actorId, before, after, timestamp) {
    const prevHash = audit.length > 0 ? audit[audit.length - 1].hash : '0000000000000000000000000000000000000000000000000000000000000000';
    const entry = {
      id: uuid(),
      action,
      entityId,
      actorName,
      actorId,
      timestamp,
      previousHash: prevHash
    };
    if (before !== undefined) entry.before = before;
    if (after !== undefined) entry.after = after;
    entry.hash = crypto.createHash('sha256').update(JSON.stringify(entry)).digest('hex');
    audit.push(entry);
  }

  addAuditEvent('workspace.created', ACC_ID, 'Sistema', 'system', null, null, '2025-06-15T09:00:00.000Z');
  addAuditEvent('billing.subscription_activated', subscriptions[0].id, 'Mercado Pago', 'system', null, null, '2025-08-15T10:00:00.000Z');
  addAuditEvent('team.member_added', teamMember1.id, 'Nycolas', ACC_ID, null, { email: teamMember1.email, role: 'editor' }, '2025-08-20T10:00:00.000Z');
  addAuditEvent('team.member_added', teamMember2.id, 'Nycolas', ACC_ID, null, { email: teamMember2.email, role: 'viewer' }, '2025-09-01T14:30:00.000Z');
  addAuditEvent('action.created', actions[0].id, 'Dr. Carlos Eduardo', teamMember2.id, null, actions[0], '2025-12-10T09:00:00.000Z');
  addAuditEvent('action.created', actions[1].id, 'Mariana Costa', teamMember1.id, null, actions[1], '2026-03-15T10:00:00.000Z');
  addAuditEvent('action.evidence_added', actions[2].id, 'Nycolas', ACC_ID, null, actions[2].evidence[0], '2026-05-28T14:00:00.000Z');

  const existingManagement = loadJson('management');
  const otherManagement = existingManagement.filter(m => m.id !== ACC_ID);
  const userManagement = {
    id: ACC_ID,
    retentionMonths: 24,
    assessments,
    actions,
    audit,
    invitations: [],
    schedules: [],
    aiHistory: [],
    subscriptions,
    recovery: []
  };

  // 9. SALVAR ARQUIVOS NO DIRETÓRIO ALVO
  saveJson('accounts', updatedAccounts);
  saveJson('members', members);
  saveJson('groups', groups);
  saveJson('surveys', surveys);
  saveJson('reports', reports);
  saveJson('responses', responses);
  saveJson('invitations', invitations);
  saveJson('management', [...otherManagement, userManagement]);

  console.log('--- SEED CONCLUÍDO COM SUCESSO! ---');
  console.log(`- Diretório: ${DATA_DIR}`);
  console.log(`- Colaboradores: ${members.length} distribuídos em ${areasConfig.length} áreas (+ Geral)`);
  console.log(`- Pesquisas: ${surveys.length} total (${closedCycleDefs.length} fechadas compatíveis, 1 HSE, 1 suprimida por sobreposição, 1 aberta, 1 rascunho)`);
  console.log(`- Respostas geradas: ${responses.length} com segmentId e submittedDay`);
  console.log(`- Convites gerados: ${invitations.length} com segmentId e usedDay`);
  console.log(`- Relatórios: ${reports.length} gerados`);
  console.log(`- Ações NR-1: ${actions.length} (atrasada, em execução, eficácia vencida, concluída)`);
}

// Executa se chamado diretamente
if (require.main === module) {
  runSeed();
}

module.exports = { runSeed, DATA_DIR, ACC_ID };
