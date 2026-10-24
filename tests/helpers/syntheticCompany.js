/**
 * Helper de teste para montar cenários pequenos, determinísticos e reproduzíveis
 * para testes unitários e de integração das fases do Equilibra MVP.
 */

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { derive } = require('../../src/services/passwordService');
const { snapshotInstrument } = require('../../src/domain/instruments');
const { aggregate, summarizeDistribution } = require('../../src/domain/analysis');

// Semente determinística simples para geração de números pseudoaleatórios
function createPrng(seed = 123456789) {
  let s = seed;
  return function next() {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

/**
 * Monta os dados de uma empresa sintética pequena e determinística.
 * @param {Object} options
 * @param {string} [options.accountId]
 * @param {number} [options.seed]
 * @returns {Object} { account, users, members, groups, surveys, invitations, responses, reports, management }
 */
function buildSyntheticCompanyData(options = {}) {
  const accountId = options.accountId || 'acc-synth-test-0001';
  const prng = createPrng(options.seed || 42);

  const account = {
    id: accountId,
    name: 'Ana Silva (Demo RH)',
    company: 'Empresa Teste Sintética [DEMO]',
    email: 'ana.rh@exemplo.test',
    passwordHash: derive('senha-teste-123'),
    role: 'owner',
    createdAt: '2026-01-10T10:00:00.000Z'
  };

  const editorUser = {
    id: 'user-synth-editor-01',
    organizationId: accountId,
    name: 'Carlos Editor',
    company: account.company,
    email: 'carlos.editor@exemplo.test',
    passwordHash: derive('senha-teste-123'),
    role: 'editor',
    createdAt: '2026-01-15T10:00:00.000Z'
  };

  const viewerUser = {
    id: 'user-synth-viewer-01',
    organizationId: accountId,
    name: 'Valéria Auditora',
    company: account.company,
    email: 'valeria.viewer@exemplo.test',
    passwordHash: derive('senha-teste-123'),
    role: 'viewer',
    createdAt: '2026-01-20T10:00:00.000Z'
  };

  // 25 colaboradores em 3 áreas:
  // 1. Operações: 12 pessoas
  // 2. Tecnologia: 10 pessoas
  // 3. Jurídico: 3 pessoas (< 5, grupo pequeno para exercitar agrupamento)
  const areasDef = [
    { name: 'Operações', count: 12, color: '#2E7D52' },
    { name: 'Tecnologia', count: 10, color: '#432874' },
    { name: 'Jurídico', count: 3, color: '#C25E00' }
  ];

  const members = [];
  const groups = [];
  let memberIdx = 1;

  const allMemberIds = [];

  for (const area of areasDef) {
    const groupId = `grp-synth-${area.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')}`;
    const groupMemberIds = [];

    for (let i = 0; i < area.count; i++) {
      const id = `mbr-synth-${String(memberIdx).padStart(3, '0')}`;
      members.push({
        id,
        accountId,
        name: `Colaborador Fictício ${memberIdx}`,
        email: `colaborador${memberIdx}@exemplo.test`,
        phone: `1198888${String(memberIdx).padStart(4, '0')}`,
        createdAt: '2026-01-11T09:00:00.000Z'
      });
      groupMemberIds.push(id);
      allMemberIds.push(id);
      memberIdx++;
    }

    groups.push({
      id: groupId,
      accountId,
      name: area.name,
      memberIds: groupMemberIds,
      color: area.color,
      createdAt: '2026-01-11T10:00:00.000Z'
    });
  }

  // Grupo Geral com todos
  const generalGroup = {
    id: 'grp-synth-geral',
    accountId,
    name: 'Geral',
    memberIds: [...allMemberIds],
    color: '#581c43',
    createdAt: '2026-01-11T10:05:00.000Z'
  };
  groups.unshift(generalGroup);

  const instrument = snapshotInstrument('Diagnóstico inicial');
  const factors = ['demandas', 'autonomia', 'apoio', 'relacoes', 'reconhecimento', 'jornada', 'mudancas', 'seguranca'];

  // Segmentos baseados nas 3 áreas (excluindo Geral)
  const departmentGroups = groups.filter(g => g.id !== 'grp-synth-geral');
  const segments = departmentGroups.map(g => ({
    id: g.id,
    name: g.name,
    invited: g.memberIds.length
  }));

  // Helper para mapa de membro -> segmentId
  const memberSegmentMap = {};
  for (const seg of segments) {
    const g = groups.find(x => x.id === seg.id);
    for (const mId of g.memberIds) {
      if (!memberSegmentMap[mId]) {
        memberSegmentMap[mId] = seg.id;
      }
    }
  }

  // 1. Ciclo 1: Fechado (Linha de base)
  const survey1Id = 'srv-synth-c1-closed';
  const srv1EndsAt = '2026-02-15T23:59:59.000Z';
  const srv1ClosedAt = '2026-02-15T18:00:00.000Z';

  const invitations = [];
  const responses = [];

  // Respostas para o ciclo 1:
  // Operações: 10 respostas (de 12)
  // Tecnologia: 8 respostas (de 10)
  // Jurídico: 2 respostas (de 3) -> n=2 < 5 (exercita agrupamento)
  // Total: 20 respostas (de 25 convidados = 80% adesão)
  const respondingMembers = [
    ...departmentGroups[0].memberIds.slice(0, 10),
    ...departmentGroups[1].memberIds.slice(0, 8),
    ...departmentGroups[2].memberIds.slice(0, 2)
  ];

  for (const mId of allMemberIds) {
    const segId = memberSegmentMap[mId];
    const isResponding = respondingMembers.includes(mId);
    const token = crypto.createHash('sha256').update(`token-c1-${mId}`).digest('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    invitations.push({
      id: `inv-c1-${mId}`,
      accountId,
      surveyId: survey1Id,
      tokenHash,
      segmentId: segId,
      used: isResponding,
      usedDay: isResponding ? '2026-02-10' : null,
      createdAt: '2026-02-01T09:00:00.000Z'
    });

    if (isResponding) {
      // Gera respostas determinísticas com base no segmento e no prng
      const answers = {};
      for (const f of factors) {
        // Variação controlada por segmento:
        // Operações tem score mais baixo em demandas e jornada (trabalho operacional)
        // Tecnologia tem score melhor em autonomia, mas pior em mudanças
        let baseScore = 3.5;
        if (segId === 'grp-synth-operacoes') {
          if (f === 'demandas' || f === 'jornada') baseScore = 2.4;
          if (f === 'apoio') baseScore = 4.0;
        } else if (segId === 'grp-synth-tecnologia') {
          if (f === 'autonomia') baseScore = 4.2;
          if (f === 'demandas') baseScore = 3.0;
        } else {
          baseScore = 3.8;
        }
        // Converte em inteiro 1-5 determinístico
        const offset = (prng() - 0.5) * 1.5;
        const val = Math.max(1, Math.min(5, Math.round(baseScore + offset)));
        answers[f] = val;
      }

      responses.push({
        id: `rsp-c1-${mId}`,
        accountId,
        surveyId: survey1Id,
        segmentId: segId,
        submittedDay: '2026-02-10',
        answers
      });
    }
  }

  // Relatório do ciclo 1
  const srv1Responses = responses.filter(r => r.surveyId === survey1Id);
  const srv1Result = aggregate(srv1Responses);
  const srv1Distribution = summarizeDistribution(srv1Responses);

  const survey1 = {
    id: survey1Id,
    accountId,
    title: 'Diagnóstico de Fatores Psicossociais 2026',
    cycle: '1º Trimestre 2026',
    model: 'Diagnóstico inicial',
    groupIds: departmentGroups.map(g => g.id),
    groupId: departmentGroups[0].id,
    memberIds: [...allMemberIds],
    segments,
    participationTarget: 0.70,
    endsAt: srv1EndsAt,
    status: 'closed',
    createdAt: '2026-02-01T09:00:00.000Z',
    openedAt: '2026-02-01T09:15:00.000Z',
    closedAt: srv1ClosedAt,
    instrument,
    collectionChannel: 'web',
    audienceFingerprint: crypto.createHash('sha256').update([...allMemberIds].sort().join(':')).digest('hex'),
    groupNamesSnapshot: departmentGroups.map(g => g.name),
    result: srv1Result,
    responseCount: srv1Responses.length
  };

  const report1 = {
    id: 'rep-synth-c1',
    accountId,
    surveyId: survey1Id,
    title: survey1.title,
    cycle: survey1.cycle,
    model: survey1.model,
    groupName: 'Todas as Áreas',
    closedAt: srv1ClosedAt,
    published: true,
    responseCount: srv1Responses.length,
    result: srv1Result,
    instrument,
    audienceFingerprint: survey1.audienceFingerprint,
    distribution: srv1Distribution,
    methodology: 'Questionário exploratório, versão 1',
    schemaVersion: 2
  };

  // 2. Ciclo 2: Aberto com participação parcial
  const survey2Id = 'srv-synth-c2-open';
  const survey2 = {
    id: survey2Id,
    accountId,
    title: 'Pulso de Acompanhamento Q2 2026',
    cycle: '2º Trimestre 2026',
    model: 'Diagnóstico inicial',
    groupIds: departmentGroups.map(g => g.id),
    groupId: departmentGroups[0].id,
    memberIds: [...allMemberIds],
    segments,
    participationTarget: 0.70,
    endsAt: '2026-06-30T23:59:59.000Z',
    status: 'open',
    createdAt: '2026-06-01T09:00:00.000Z',
    openedAt: '2026-06-01T09:30:00.000Z',
    instrument,
    collectionChannel: 'web',
    audienceFingerprint: crypto.createHash('sha256').update([...allMemberIds].sort().join(':')).digest('hex'),
    groupNamesSnapshot: departmentGroups.map(g => g.name)
  };

  // 12 respostas parciais no ciclo 2 (48% de participação)
  const c2Responding = allMemberIds.slice(0, 12);
  for (const mId of allMemberIds) {
    const isResponding = c2Responding.includes(mId);
    const token = crypto.createHash('sha256').update(`token-c2-${mId}`).digest('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    invitations.push({
      id: `inv-c2-${mId}`,
      accountId,
      surveyId: survey2Id,
      tokenHash,
      segmentId: memberSegmentMap[mId],
      used: isResponding,
      usedDay: isResponding ? '2026-06-05' : null,
      createdAt: '2026-06-01T09:30:00.000Z'
    });

    if (isResponding) {
      responses.push({
        id: `rsp-c2-${mId}`,
        accountId,
        surveyId: survey2Id,
        segmentId: memberSegmentMap[mId],
        submittedDay: '2026-06-05',
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

  // 3. Ciclo 3: Rascunho
  const survey3Id = 'srv-synth-c3-draft';
  const survey3 = {
    id: survey3Id,
    accountId,
    title: 'Planejamento e Escuta 2027',
    cycle: '1º Trimestre 2027',
    model: 'Diagnóstico inicial',
    groupIds: [generalGroup.id],
    groupId: generalGroup.id,
    memberIds: [...allMemberIds],
    participationTarget: 0.70,
    endsAt: '2027-02-28T23:59:59.000Z',
    status: 'draft',
    createdAt: '2026-10-01T10:00:00.000Z',
    instrument,
    groupNamesSnapshot: ['Geral']
  };

  // Gestão (NR-1) com ações em diferentes estados
  const assessments = [
    {
      id: 'asm-synth-01',
      surveyId: survey1Id,
      cycle: survey1.cycle,
      title: 'Sobrecarga de prazos e demandas no setor operacional',
      category: 'Organização do trabalho',
      classification: 'high',
      status: 'action_plan',
      description: 'Identificado fator demandas em nível de atenção.',
      createdAt: '2026-02-20T10:00:00.000Z'
    }
  ];

  const actions = [
    {
      id: 'act-synth-01-overdue',
      assessmentId: 'asm-synth-01',
      title: 'Redesenho de escalas e pausas na Operação',
      priority: 'high',
      owner: 'Ana Silva',
      status: 'in_progress',
      dueDate: '2026-03-01T23:59:59.000Z', // Vencida
      evidence: [],
      createdAt: '2026-02-22T10:00:00.000Z'
    },
    {
      id: 'act-synth-02-completed',
      assessmentId: 'asm-synth-01',
      title: 'Treinamento de liderança em comunicação não violenta',
      priority: 'medium',
      owner: 'Carlos Editor',
      status: 'completed',
      dueDate: '2026-05-15T23:59:59.000Z',
      evidence: [
        {
          id: 'ev-synth-01',
          filename: 'lista_presenca_treinamento.pdf',
          registeredAt: '2026-05-14T15:00:00.000Z'
        }
      ],
      effectiveReviewDate: '2026-06-01T00:00:00.000Z', // Revisão de eficácia vencida
      createdAt: '2026-02-25T11:00:00.000Z'
    }
  ];

  const management = {
    id: accountId,
    retentionMonths: 24,
    assessments,
    actions,
    audit: [],
    invitations: [],
    schedules: [],
    aiHistory: [],
    subscriptions: [],
    recovery: []
  };

  return {
    account,
    users: [account, editorUser, viewerUser],
    members,
    groups,
    surveys: [survey1, survey2, survey3],
    invitations,
    responses,
    reports: [report1],
    management
  };
}

/**
 * Escreve o cenário sintético em um diretório de storage especificado.
 * @param {string} targetDir
 * @param {Object} [options]
 */
function setupTestCompany(targetDir, options = {}) {
  fs.mkdirSync(targetDir, { recursive: true });
  const data = buildSyntheticCompanyData(options);

  const filesMap = {
    accounts: data.users,
    members: data.members,
    groups: data.groups,
    surveys: data.surveys,
    invitations: data.invitations,
    responses: data.responses,
    reports: data.reports,
    management: [data.management],
    sessions: []
  };

  for (const [name, content] of Object.entries(filesMap)) {
    fs.writeFileSync(
      path.join(targetDir, `${name}.json`),
      JSON.stringify(content, null, 2) + '\n',
      'utf8'
    );
  }

  return data;
}

module.exports = {
  buildSyntheticCompanyData,
  setupTestCompany,
  createPrng
};
