const crypto = require('node:crypto');
const storage = require('../config/equilibraStorage');
const { snapshotInstrument, surveyInstrument, instrumentForModel } = require('../domain/instruments');
const { aggregate, summarizeDistribution } = require('../domain/analysis');

const MIN_RESULTS = 5;

function hash(val) {
  return crypto.createHash('sha256').update(val).digest('hex');
}

function id() {
  return crypto.randomUUID();
}

function getBand(rate) {
  if (rate < 0.30) return '<30%';
  if (rate < 0.50) return '30–50%';
  if (rate < 0.70) return '50–70%';
  return '≥70%';
}

/**
 * Abre uma pesquisa que estava em rascunho.
 * Snapshot dos segmentos e pessoas, geração dos tokens com segmentId.
 */
function openSurvey({ surveyId, accountId, baseUrl = '' }) {
  const surveys = storage.read('surveys');
  const survey = surveys.find((s) => s.id === surveyId && s.accountId === accountId);
  if (!survey) return { error: 'not_found', status: 404, message: 'Pesquisa não encontrada.' };
  if (survey.status !== 'draft') return { error: 'conflict', status: 409, message: 'Pesquisa já iniciada.' };

  const surveyGroupIds = survey.groupIds || (survey.groupId ? [survey.groupId] : []);
  const allGroups = storage.read('groups').filter((g) => g.accountId === accountId);
  const surveyGroups = surveyGroupIds.map((gid) => allGroups.find((g) => g.id === gid)).filter(Boolean);
  if (surveyGroups.length === 0) {
    return { error: 'invalid_groups', status: 409, message: 'Nenhum grupo válido encontrado para esta pesquisa.' };
  }

  // Atribuição de pessoas a segmentos:
  // "percorrer os grupos da pesquisa na ordem; a primeira ocorrência da pessoa define seu segmento.
  // Pessoas em vários grupos contam uma única vez"
  const memberSegmentMap = {};
  const segmentsCount = {};
  const freshMemberIds = [];

  for (const group of surveyGroups) {
    segmentsCount[group.id] = 0;
    for (const mId of group.memberIds || []) {
      if (!memberSegmentMap[mId]) {
        memberSegmentMap[mId] = group.id;
        segmentsCount[group.id]++;
        freshMemberIds.push(mId);
      }
    }
  }

  if (freshMemberIds.length < MIN_RESULTS) {
    return {
      error: 'min_results',
      status: 409,
      message: `Os grupos selecionados precisam ter no total ao menos ${MIN_RESULTS} pessoas únicas.`
    };
  }

  if (new Date(survey.endsAt).getTime() <= Date.now()) {
    return { error: 'invalid_date', status: 409, message: 'Defina data futura de encerramento.' };
  }

  // Conflito com outra pesquisa aberta
  const hasConflict = surveys.some(
    (s) =>
      s.accountId === accountId &&
      s.id !== survey.id &&
      s.status === 'open' &&
      (s.memberIds || []).some((mId) => freshMemberIds.includes(mId))
  );
  if (hasConflict) {
    return {
      error: 'conflict_open_survey',
      status: 409,
      message: 'Há outra pesquisa aberta com pessoas deste(s) grupo(s).'
    };
  }

  const instrument = survey.instrument?.factors ? survey.instrument : snapshotInstrument(survey.model);
  if (!instrument) {
    return { error: 'invalid_model', status: 409, message: 'Modelo não disponível para aplicação.' };
  }

  // Snapshot de segmentos: [{ id, name, invited }]
  const segmentsSnapshot = surveyGroups.map((group) => ({
    id: group.id,
    name: group.name,
    invited: segmentsCount[group.id] || 0
  }));

  const members = storage.read('members').filter((m) => m.accountId === accountId);
  const invitations = storage.read('invitations');
  const links = [];

  // Gera convites individuais
  for (const memberId of freshMemberIds) {
    const token = crypto.randomBytes(24).toString('hex');
    const segId = memberSegmentMap[memberId];
    const member = members.find((m) => m.id === memberId);
    const segGroup = surveyGroups.find((g) => g.id === segId);

    invitations.push({
      id: id(),
      accountId,
      surveyId: survey.id,
      memberId,
      tokenHash: hash(token),
      segmentId: segId,
      used: false,
      usedDay: null
    });

    links.push({
      memberId,
      name: member?.name || 'Participante',
      email: member?.email || '',
      phone: member?.phone || '',
      segmentId: segId,
      groupName: segGroup?.name || 'Geral',
      token,
      link: `${baseUrl}/responder/${token}`
    });
  }

  survey.status = 'open';
  survey.openedAt = new Date().toISOString();
  survey.memberIds = freshMemberIds;
  survey.segments = segmentsSnapshot;
  survey.participationTarget = survey.participationTarget || 0.70;
  survey.instrument = instrument;
  survey.collectionChannel = 'web';
  survey.audienceFingerprint = hash([...freshMemberIds].sort().join(':'));
  survey.groupNamesSnapshot = surveyGroups.map((g) => g.name);

  // Embaralha para evitar correlação de índice
  links.sort(() => Math.random() - 0.5);

  storage.writeMany({
    invitations,
    surveys
  });

  return {
    ok: true,
    survey,
    link: `/responder/${survey.id}`,
    links
  };
}

/**
 * Reemite tokens para convites ainda não usados.
 * Invalida os tokens não usados e devolve novos links. Mantém os já usados.
 */
function reissueLinks({ surveyId, accountId, baseUrl = '' }) {
  const surveys = storage.read('surveys');
  const survey = surveys.find((s) => s.id === surveyId && s.accountId === accountId);
  if (!survey) return { error: 'not_found', status: 404, message: 'Pesquisa não encontrada.' };
  if (survey.status !== 'open') return { error: 'invalid_status', status: 409, message: 'Apenas pesquisas abertas permitem reemissão de links.' };

  const invitations = storage.read('invitations');
  const members = storage.read('members').filter((m) => m.accountId === accountId);
  const groups = storage.read('groups').filter((g) => g.accountId === accountId);

  const surveyInvitations = invitations.filter((inv) => inv.surveyId === survey.id);
  const newLinks = [];
  let updatedCount = 0;

  for (const inv of surveyInvitations) {
    if (inv.used !== true) {
      const newToken = crypto.randomBytes(24).toString('hex');
      inv.tokenHash = hash(newToken);
      updatedCount++;

      const member = members.find((m) => m.id === inv.memberId);
      const group = groups.find((g) => g.id === inv.segmentId);

      newLinks.push({
        memberId: inv.memberId,
        name: member?.name || 'Participante',
        email: member?.email || '',
        phone: member?.phone || '',
        segmentId: inv.segmentId,
        groupName: group?.name || 'Geral',
        token: newToken,
        link: `${baseUrl}/responder/${newToken}`
      });
    }
  }

  // Registra no histórico do survey
  survey.reissuedAt = new Date().toISOString();
  survey.reissuedCount = (survey.reissuedCount || 0) + 1;

  storage.writeMany({
    invitations,
    surveys
  });

  newLinks.sort(() => Math.random() - 0.5);

  return {
    ok: true,
    reissuedCount: updatedCount,
    links: newLinks
  };
}

/**
 * Acompanhamento de participação por segmento sem identificar pessoas.
 * Nunca devolve memberId, usedDay por pessoa ou lista de faltantes.
 */
function getParticipation({ surveyId, accountId }) {
  const surveys = storage.read('surveys');
  const survey = surveys.find((s) => s.id === surveyId && s.accountId === accountId);
  if (!survey) return { error: 'not_found', status: 404, message: 'Pesquisa não encontrada.' };

  const responses = storage.read('responses').filter((r) => r.surveyId === survey.id);
  const totalInvited = survey.memberIds?.length || 0;
  const totalResponded = responses.length;
  const totalRate = totalInvited > 0 ? Math.round((totalResponded / totalInvited) * 1000) / 1000 : 0;
  const target = survey.participationTarget || 0.70;

  const segmentsStats = (survey.segments || []).map((seg) => {
    const segResponses = responses.filter((r) => r.segmentId === seg.id);
    const rate = seg.invited > 0 ? Math.round((segResponses.length / seg.invited) * 1000) / 1000 : 0;
    return {
      id: seg.id,
      name: seg.name,
      invited: seg.invited,
      responded: segResponses.length,
      rate,
      band: getBand(rate)
    };
  });

  const now = Date.now();
  const endsAtTime = new Date(survey.endsAt).getTime();
  const daysRemaining = Math.max(0, Math.ceil((endsAtTime - now) / 86400000));
  const isExpired = endsAtTime <= now;

  return {
    ok: true,
    surveyId: survey.id,
    title: survey.title,
    status: survey.status,
    endsAt: survey.endsAt,
    daysRemaining,
    isExpired,
    participationTarget: target,
    total: {
      invited: totalInvited,
      responded: totalResponded,
      rate: totalRate,
      band: getBand(totalRate)
    },
    segments: segmentsStats,
    isBelowTarget: totalRate < target
  };
}

/**
 * Prorroga o prazo da pesquisa aberta.
 */
function extendSurvey({ surveyId, accountId, newEndsAt, reason = '' }) {
  const surveys = storage.read('surveys');
  const survey = surveys.find((s) => s.id === surveyId && s.accountId === accountId);
  if (!survey) return { error: 'not_found', status: 404, message: 'Pesquisa não encontrada.' };
  if (survey.status !== 'open') return { error: 'invalid_status', status: 409, message: 'Apenas pesquisas abertas podem ser prorrogadas.' };

  const currentEndsAtTime = new Date(survey.endsAt).getTime();
  const newEndsAtTime = new Date(newEndsAt).getTime();

  if (!Number.isFinite(newEndsAtTime) || newEndsAtTime <= Date.now() || newEndsAtTime <= currentEndsAtTime) {
    return { error: 'invalid_date', status: 409, message: 'A nova data deve ser futura e posterior à data atual de encerramento.' };
  }

  const extensions = survey.extensions || [];
  extensions.push({
    previousEndsAt: survey.endsAt,
    newEndsAt,
    extendedAt: new Date().toISOString(),
    reason: reason.trim() || 'Prorrogação de prazo'
  });

  survey.endsAt = newEndsAt;
  survey.extensions = extensions;

  storage.write('surveys', surveys);

  return {
    ok: true,
    survey
  };
}

/**
 * Encerra a pesquisa.
 * Se participação < meta e prazo não venceu, exige confirmação explícita.
 */
function closeSurvey({ surveyId, accountId, confirmEarlyClose = false, reason = '' }) {
  const surveys = storage.read('surveys');
  const survey = surveys.find((s) => s.id === surveyId && s.accountId === accountId);
  if (!survey) return { error: 'not_found', status: 404, message: 'Pesquisa não encontrada.' };
  if (survey.status !== 'open') return { error: 'invalid_status', status: 409, message: 'Pesquisa não está aberta.' };

  const responses = storage.read('responses').filter((r) => r.surveyId === survey.id);
  const totalMembers = survey.memberIds?.length || 0;
  const target = survey.participationTarget || 0.70;
  const minRequired = totalMembers > 0 ? Math.ceil(totalMembers * target) : 0;
  const isExpired = Number.isFinite(new Date(survey.endsAt).getTime()) && new Date(survey.endsAt).getTime() <= Date.now();

  // Se participação < meta e não expirou, exige confirmação
  if (!isExpired && responses.length < minRequired && !confirmEarlyClose) {
    return {
      error: 'participation_below_target',
      status: 409,
      requiresConfirmation: true,
      responseCount: responses.length,
      targetCount: minRequired,
      target,
      message: `A pesquisa possui ${responses.length} respostas (meta: ${minRequired}, ${Math.round(target * 100)}%). Encerrar agora pode resultar em relatório protegido ou dados agrupados.`,
      effect: responses.length < MIN_RESULTS
        ? `Com menos de ${MIN_RESULTS} respostas, o resultado ficará protegido e não será publicado.`
        : 'Com menos respostas que a meta, recortes por área poderão sofrer agrupamento de partição.'
    };
  }

  survey.status = 'closed';
  survey.closedAt = new Date().toISOString();
  survey.responseCount = responses.length;

  if (responses.length < minRequired && !isExpired) {
    survey.closedEarly = true;
    survey.earlyCloseReason = reason.trim() || 'Encerramento antecipado antes da meta de participação';
  }

  storage.write('surveys', surveys);

  return {
    ok: true,
    survey
  };
}

/**
 * Fechamento automático por expiração de data (executado por scheduler ou rotina segura).
 */
function closeExpiredSurveys(targetAccountId = null) {
  const surveys = storage.read('surveys');
  const now = Date.now();
  let changed = false;
  const closedIds = [];

  for (const survey of surveys) {
    if (targetAccountId && survey.accountId !== targetAccountId) continue;
    if (survey.status === 'open' && Number.isFinite(new Date(survey.endsAt).getTime()) && new Date(survey.endsAt).getTime() <= now) {
      survey.status = 'closed';
      survey.closedAt = new Date().toISOString();
      const responses = storage.read('responses').filter((r) => r.surveyId === survey.id);
      survey.responseCount = responses.length;
      changed = true;
      closedIds.push(survey.id);
    }
  }

  if (changed) {
    storage.write('surveys', surveys);
  }

  return {
    changed,
    closedIds
  };
}

module.exports = {
  MIN_RESULTS,
  openSurvey,
  reissueLinks,
  getParticipation,
  extendSurvey,
  closeSurvey,
  closeExpiredSurveys,
  getBand
};
