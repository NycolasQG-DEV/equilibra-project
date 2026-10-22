// src/services/todayService.js
// Serviço puro de cálculo da fila de decisões diárias (Hoje) e KPIs operacionais.

/**
 * Retorna a data no fuso de Brasília (YYYY-MM-DD).
 */
function getSaoPauloDate(d = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(d);
}

/**
 * Retorna a data formatada por extenso em português.
 */
function formatPortugueseDate(d = new Date()) {
  const str = new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'America/Sao_Paulo'
  }).format(d);
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Retorna saudação baseada na hora em São Paulo.
 */
function getGreeting(name = 'Colega', d = new Date()) {
  const hour = Number(
    new Intl.DateTimeFormat('pt-BR', {
      hour: 'numeric',
      hour12: false,
      timeZone: 'America/Sao_Paulo'
    }).format(d)
  );
  const firstName = (name || 'Colega').trim().split(' ')[0];
  if (hour >= 5 && hour < 12) return `Bom dia, ${firstName}.`;
  if (hour >= 12 && hour < 18) return `Boa tarde, ${firstName}.`;
  return `Boa noite, ${firstName}.`;
}

/**
 * Computa a fila de decisões priorizadas da conta.
 *
 * Itens analisados:
 * 1. report_pending_acceptance (alta prioridade)
 * 2. report_without_assessment (média-alta prioridade)
 * 3. survey_low_participation (média prioridade)
 * 4. action_overdue (alta prioridade)
 * 5. action_review_due (média prioridade)
 */
function computeDecisionQueue(account, {
  surveys = [],
  reports = [],
  assessments = [],
  actions = [],
  members = [],
  groups = []
} = {}, now = new Date()) {
  const todayStr = getSaoPauloDate(now);
  const queue = [];

  // 1. Relatórios publicados pendentes de formalização de aceite
  const publishedReports = reports.filter(r => r.published);
  for (const report of publishedReports) {
    if (!report.acceptance) {
      queue.push({
        id: `acceptance_${report.id}`,
        type: 'report_pending_acceptance',
        priority: 'high',
        priorityLabel: 'Alta prioridade',
        targetId: report.id,
        title: `Formalizar aceite do relatório: ${report.cycle || report.title}`,
        description: `Relatório do ciclo ${report.cycle || ''} publicado com ${report.responseCount} respostas aguarda termo formal de ciência técnica para instrução de SST.`,
        actionLabel: 'Formalizar aceite',
        link: `#resultados/ciclo/${report.id}`,
        badge: 'Aceite pendente'
      });
    }
  }

  // 2. Relatórios publicados sem nenhuma avaliação / achado cadastrado
  for (const report of publishedReports) {
    const reportAssessments = assessments.filter(a => a.reportId === report.id || a.reportId === report.surveyId);
    if (reportAssessments.length === 0) {
      const criticalCount = (report.result || []).filter(f => f.average < 2.8).length;
      queue.push({
        id: `assessment_needed_${report.id}`,
        type: 'report_without_assessment',
        priority: 'medium_high',
        priorityLabel: 'Prioridade relevante',
        targetId: report.id,
        title: `Avaliar achados do ciclo: ${report.cycle || report.title}`,
        description: criticalCount > 0
          ? `${criticalCount} tema(s) com média crítica (< 2.80) requerem averiguação técnica e registro de decisão.`
          : `Ciclo encerrado sem nenhum achado ou avaliação de contexto cadastrada pela equipe.`,
        actionLabel: 'Avaliar achados',
        link: `#resultados/ciclo/${report.id}/avaliacoes`,
        badge: criticalCount > 0 ? `${criticalCount} crítico(s)` : 'Sem achados'
      });
    }
  }

  // 3. Pesquisas em coleta próximas do prazo (<= 3 dias) com adesão < 70%
  const openSurveys = surveys.filter(s => s.status === 'open');
  for (const survey of openSurveys) {
    const closeDate = survey.closesAt ? new Date(survey.closesAt) : null;
    if (closeDate) {
      const diffMs = closeDate.getTime() - now.getTime();
      const daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      const invited = survey.invitedCount || (survey.invitations ? survey.invitations.length : 0);
      const responses = survey.responseCount || 0;
      const rate = invited > 0 ? responses / invited : 0;

      if (daysRemaining <= 3 && rate < 0.70) {
        queue.push({
          id: `survey_low_part_${survey.id}`,
          type: 'survey_low_participation',
          priority: 'medium',
          priorityLabel: 'Atenção ao quórum',
          targetId: survey.id,
          title: `Coleta em risco de quórum: ${survey.title}`,
          description: `Encerra em ${daysRemaining <= 0 ? 'poucas horas' : `${daysRemaining} dia(s)`} com apenas ${Math.round(rate * 100)}% de participação (meta: 70%).`,
          actionLabel: 'Disparar lembrete / Prorrogar',
          link: `#pesquisas/${survey.id}/distribuicao`,
          badge: `${Math.round(rate * 100)}% de adesão`
        });
      }
    }
  }

  // 4. Ações atrasadas (due date expirada em status planejado ou em andamento)
  for (const action of actions) {
    if (['planned', 'in_progress'].includes(action.status) && action.dueDate && action.dueDate < todayStr) {
      const dueDateObj = new Date(action.dueDate + 'T12:00:00');
      const nowDateObj = new Date(todayStr + 'T12:00:00');
      const daysOverdue = Math.max(1, Math.floor((nowDateObj - dueDateObj) / (1000 * 60 * 60 * 24)));
      queue.push({
        id: `action_overdue_${action.id}`,
        type: 'action_overdue',
        priority: 'high',
        priorityLabel: 'Atrasada',
        targetId: action.id,
        title: `Medida atrasada: ${action.title}`,
        description: `Execução atrasada há ${daysOverdue} dia(s). Responsável: ${action.owner || 'Não atribuído'}.`,
        actionLabel: 'Cobrar execução',
        link: `#acoes/${action.id}`,
        badge: `${daysOverdue}d de atraso`
      });
    }
  }

  // 5. Ações implementadas com data de revisão de eficácia atingida
  for (const action of actions) {
    if (action.status === 'implemented' && action.reviewDate && action.reviewDate <= todayStr) {
      queue.push({
        id: `action_review_${action.id}`,
        type: 'action_review_due',
        priority: 'medium',
        priorityLabel: 'Revisão pendente',
        targetId: action.id,
        title: `Verificar eficácia: ${action.title}`,
        description: `Medida implementada atingiu a data de averiguação (${action.reviewDate.slice(0, 10)}). Registre se foi eficaz.`,
        actionLabel: 'Verificar eficácia',
        link: `#acoes/${action.id}`,
        badge: 'Revisar eficácia'
      });
    }
  }

  // Ordenação por prioridade: high -> medium_high -> medium
  const priorityWeight = { high: 1, medium_high: 2, medium: 3, low: 4 };
  queue.sort((a, b) => (priorityWeight[a.priority] || 99) - (priorityWeight[b.priority] || 99));

  // KPIs operacionais
  const activeSurvey = openSurveys[0] ? {
    id: openSurveys[0].id,
    title: openSurveys[0].title,
    cycle: openSurveys[0].cycle,
    closesAt: openSurveys[0].closesAt,
    daysRemaining: openSurveys[0].closesAt ? Math.max(0, Math.ceil((new Date(openSurveys[0].closesAt) - now) / (1000 * 60 * 60 * 24))) : null,
    invited: openSurveys[0].invitedCount || 0,
    responses: openSurveys[0].responseCount || 0,
    rate: (openSurveys[0].invitedCount || 0) > 0 ? Math.round((openSurveys[0].responseCount / openSurveys[0].invitedCount) * 100) : 0
  } : null;

  const activeActions = actions.filter(a => ['planned', 'in_progress', 'implemented'].includes(a.status));
  const overdueCount = actions.filter(a => ['planned', 'in_progress'].includes(a.status) && a.dueDate && a.dueDate < todayStr).length;
  const reviewDueCount = actions.filter(a => a.status === 'implemented' && a.reviewDate && a.reviewDate <= todayStr).length;
  const onTimeCount = Math.max(0, activeActions.length - overdueCount - reviewDueCount);

  const closedSurveys = surveys.filter(s => s.status === 'closed');
  const lastSurveyDate = closedSurveys.length > 0
    ? [...closedSurveys].sort((a, b) => new Date(b.closedAt || 0) - new Date(a.closedAt || 0))[0].closedAt
    : null;

  // Gráficos orientados à decisão
  // 1. Tendência de participação nos últimos ciclos fechados
  const participationTrend = closedSurveys
    .sort((a, b) => new Date(a.closedAt || 0) - new Date(b.closedAt || 0))
    .slice(-6)
    .map(s => {
      const invitedCount = s.invitedCount || (s.invitations ? s.invitations.length : 0);
      const resp = s.responseCount || 0;
      const rate = invitedCount > 0 ? Math.round((resp / invitedCount) * 100) : 0;
      return {
        id: s.id,
        cycle: s.cycle || s.title,
        date: (s.closedAt || '').slice(0, 10),
        rate,
        target: 70
      };
    });

  // 2. Fatores mais críticos do último ciclo publicado
  const latestPublished = [...publishedReports].sort((a, b) => new Date(b.closedAt || 0) - new Date(a.closedAt || 0))[0];
  const factorRanking = latestPublished && Array.isArray(latestPublished.result)
    ? [...latestPublished.result]
        .sort((a, b) => a.average - b.average)
        .slice(0, 5)
        .map(f => ({
          key: f.key,
          label: f.label,
          average: f.average,
          isCritical: f.average < 2.8
        }))
    : [];

  // 3. Eficácia das medidas
  const effectiveCount = actions.filter(a => a.status === 'effective').length;
  const ineffectiveCount = actions.filter(a => a.status === 'ineffective').length;
  const inProgressCount = actions.filter(a => ['planned', 'in_progress', 'implemented'].includes(a.status)).length;

  const isCompletelyEmpty = members.length === 0 && surveys.length === 0;

  const greeting = getGreeting(account?.name || 'Colega', now);
  const dateFormatted = formatPortugueseDate(now);
  const summaryMessage = queue.length > 0
    ? `${queue.length} decisão(ões) ou pendência(s) prioritária(s) para hoje.`
    : 'Nenhuma pendência crítica hoje — operação em dia.';

  return {
    greeting,
    date: todayStr,
    dateFormatted,
    summaryMessage,
    queue,
    kpis: {
      activeSurvey,
      actions: {
        totalActive: activeActions.length,
        onTime: onTimeCount,
        overdue: overdueCount,
        reviewDue: reviewDueCount
      },
      population: {
        totalMembers: members.length,
        totalGroups: groups.length,
        lastSurveyDate
      }
    },
    charts: {
      participationTrend,
      latestCycle: latestPublished ? { id: latestPublished.id, cycle: latestPublished.cycle } : null,
      factorRanking,
      efficacy: {
        effective: effectiveCount,
        ineffective: ineffectiveCount,
        inProgress: inProgressCount,
        total: actions.length
      }
    },
    isEmpty: isCompletelyEmpty
  };
}

module.exports = {
  getSaoPauloDate,
  formatPortugueseDate,
  getGreeting,
  computeDecisionQueue
};
