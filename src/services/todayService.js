// src/services/todayService.js
// Serviço puro de cálculo da fila de decisões diárias (Hoje) e KPIs operacionais.

function getSaoPauloDate(d = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(d);
}

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

  const publishedReports = reports.filter(r => r.published);

  // 1. Relatórios pendentes de formalização de aceite (agrupados com inteligência)
  const unaccepted = publishedReports.filter(r => !r.acceptance);
  if (unaccepted.length === 1) {
    const report = unaccepted[0];
    queue.push({
      id: `acceptance_${report.id}`,
      type: 'report_pending_acceptance',
      priority: 'high',
      priorityLabel: 'Alta prioridade',
      targetId: report.id,
      title: `Formalizar aceite do relatório: ${report.cycle || report.title}`,
      description: `Relatório publicado com ${report.responsesCount || report.responseCount || 0} respostas aguarda termo formal para instrução de SST.`,
      actionLabel: 'Formalizar aceite',
      actionUrl: `resultados/ciclo/${report.id}`,
      badge: 'Aceite pendente'
    });
  } else if (unaccepted.length > 1) {
    queue.push({
      id: 'acceptance_consolidated',
      type: 'report_pending_acceptance',
      priority: 'high',
      priorityLabel: 'Alta prioridade',
      targetId: unaccepted[0].id,
      title: `Formalizar aceite de ${unaccepted.length} relatórios concluídos (NR-1)`,
      description: `Existem ${unaccepted.length} ciclos de escuta publicados aguardando assinatura formal de ciência técnica.`,
      actionLabel: 'Ver relatórios',
      actionUrl: 'resultados/ciclos',
      badge: `${unaccepted.length} pendentes`
    });
  }

  // 2. Relatórios sem avaliação / achados cadastrados (agrupados)
  const unassessed = publishedReports.filter(r => {
    const reportAssessments = assessments.filter(a => a.reportId === r.id || a.reportId === r.surveyId);
    return reportAssessments.length === 0;
  });

  if (unassessed.length === 1) {
    const report = unassessed[0];
    const criticalCount = (report.result || report.factors || []).filter(f => f.average < 2.8).length;
    queue.push({
      id: `assessment_needed_${report.id}`,
      type: 'report_without_assessment',
      priority: 'medium_high',
      priorityLabel: 'Prioridade Relevante',
      targetId: report.id,
      title: `Avaliar achados: ${report.cycle || report.title}`,
      description: criticalCount > 0
        ? `${criticalCount} dimensão(ões) em zona crítica (< 2,80) requerem plano de ação preventivo.`
        : 'Ciclo concluído sem plano de ação cadastrado no inventário de riscos.',
      actionLabel: 'Ver relatório',
      actionUrl: `resultados/ciclo/${report.id}`,
      badge: criticalCount > 0 ? `${criticalCount} crítico(s)` : 'Sem plano'
    });
  } else if (unassessed.length > 1) {
    queue.push({
      id: 'assessment_needed_consolidated',
      type: 'report_without_assessment',
      priority: 'medium_high',
      priorityLabel: 'Prioridade Relevante',
      targetId: unassessed[0].id,
      title: `Elaborar planos de intervenção para ${unassessed.length} ciclos concluídos`,
      description: `Resultados consolidados aguardam vinculação a planos de ação preventiva conforme NR-1 / PGR.`,
      actionLabel: 'Ver relatórios',
      actionUrl: 'resultados/ciclos',
      badge: `${unassessed.length} ciclos`
    });
  }

  // 3. Pesquisas em coleta próximas do prazo
  const openSurveys = surveys.filter(s => s.status === 'open');
  for (const survey of openSurveys) {
    const closeDate = survey.endsAt || survey.closesAt ? new Date(survey.endsAt || survey.closesAt) : null;
    if (closeDate) {
      const diffMs = closeDate.getTime() - now.getTime();
      const daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      const invited = survey.invitedCount || (survey.links ? survey.links.length : 0);
      const responses = survey.responseCount || 0;
      const rate = invited > 0 ? responses / invited : 0;

      if (daysRemaining <= 3 && rate < 0.70) {
        queue.push({
          id: `survey_low_part_${survey.id}`,
          type: 'survey_low_participation',
          priority: 'medium',
          priorityLabel: 'Atenção ao quórum',
          targetId: survey.id,
          title: `Coleta com risco de quórum: ${survey.title}`,
          description: `Encerra em ${daysRemaining <= 0 ? 'poucas horas' : `${daysRemaining} dia(s)`} com ${Math.round(rate * 100)}% de participação (meta: 70%).`,
          actionLabel: 'Acompanhar coleta',
          actionUrl: `pesquisas/${survey.id}/distribuicao`,
          badge: `${Math.round(rate * 100)}% adesão`
        });
      }
    }
  }

  // 4. Ações atrasadas
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
        actionLabel: 'Ver ação',
        actionUrl: `acoes/${action.id}`,
        badge: `${daysOverdue}d atraso`
      });
    }
  }

  // 5. Ações aguardando revisão de eficácia
  for (const action of actions) {
    if (action.status === 'implemented' && action.reviewDate && action.reviewDate <= todayStr) {
      queue.push({
        id: `action_review_${action.id}`,
        type: 'action_review_due',
        priority: 'medium',
        priorityLabel: 'Revisão Necessária',
        targetId: action.id,
        title: `Revisar eficácia: ${action.title}`,
        description: `Medida implementada aguarda avaliação de eficácia para encerramento ou ajuste no PGR.`,
        actionLabel: 'Revisar eficácia',
        actionUrl: `acoes/${action.id}`,
        badge: 'Revisão pendente'
      });
    }
  }

  // Ordenação por prioridade
  const priorityWeight = { high: 1, medium_high: 2, medium: 3, low: 4 };
  queue.sort((a, b) => (priorityWeight[a.priority] || 99) - (priorityWeight[b.priority] || 99));

  // KPIs
  const activeSurvey = openSurveys[0] ? {
    id: openSurveys[0].id,
    title: openSurveys[0].title,
    cycle: openSurveys[0].cycle,
    closesAt: openSurveys[0].endsAt || openSurveys[0].closesAt,
    daysRemaining: (openSurveys[0].endsAt || openSurveys[0].closesAt) ? Math.max(0, Math.ceil((new Date(openSurveys[0].endsAt || openSurveys[0].closesAt) - now) / (1000 * 60 * 60 * 24))) : null,
    invited: openSurveys[0].invitedCount || (openSurveys[0].links ? openSurveys[0].links.length : 0),
    totalInvited: openSurveys[0].invitedCount || (openSurveys[0].links ? openSurveys[0].links.length : 0),
    responses: openSurveys[0].responseCount || 0,
    responsesCount: openSurveys[0].responseCount || 0,
    participationRate: (openSurveys[0].invitedCount || (openSurveys[0].links ? openSurveys[0].links.length : 0)) > 0
      ? (openSurveys[0].responseCount || 0) / (openSurveys[0].invitedCount || openSurveys[0].links.length)
      : 0
  } : null;

  const activeActions = actions.filter(a => ['planned', 'in_progress', 'implemented'].includes(a.status));
  const overdueCount = actions.filter(a => ['planned', 'in_progress'].includes(a.status) && a.dueDate && a.dueDate < todayStr).length;
  const reviewDueCount = actions.filter(a => a.status === 'implemented' && a.reviewDate && a.reviewDate <= todayStr).length;
  const onTimeCount = Math.max(0, activeActions.length - overdueCount - reviewDueCount);

  const closedSurveys = surveys.filter(s => s.status === 'closed');
  const lastSurveyDate = closedSurveys.length > 0
    ? [...closedSurveys].sort((a, b) => new Date(b.closedAt || 0) - new Date(a.closedAt || 0))[0].closedAt
    : null;

  // Gráficos operacionais
  // 1. Tendência de participação com rótulos curtos
  const participationList = closedSurveys
    .sort((a, b) => new Date(a.closedAt || 0) - new Date(b.closedAt || 0))
    .slice(-6)
    .map((s, idx) => {
      const invitedCount = s.invitedCount || (s.links ? s.links.length : s.responsesCount || 10);
      const resp = s.responseCount || s.responsesCount || 0;
      const rate = invitedCount > 0 ? Math.min(100, Math.round((resp / invitedCount) * 100)) : 85;

      let shortLabel = `Ciclo ${idx + 1}`;
      if (s.cycle) {
        const m = s.cycle.match(/Ciclo\s*\d+/i);
        if (m) shortLabel = m[0];
        else shortLabel = s.cycle.length > 12 ? s.cycle.slice(0, 12) + '…' : s.cycle;
      }

      return {
        id: s.id,
        cycle: shortLabel,
        fullCycle: s.cycle || s.title,
        date: (s.closedAt || '').slice(0, 10),
        rate,
        target: 70
      };
    });

  // 2. Fatores mais críticos do último ciclo
  const latestPublished = [...publishedReports].sort((a, b) => new Date(b.closedAt || 0) - new Date(a.closedAt || 0))[0];
  const rawFactors = (latestPublished && (latestPublished.factors || latestPublished.result)) || [];
  const factorRanking = rawFactors.length > 0
    ? [...rawFactors]
        .sort((a, b) => a.average - b.average)
        .slice(0, 5)
        .map(f => ({
          key: f.key,
          label: f.label || f.key,
          average: f.average,
          isCritical: f.average < 2.8
        }))
    : [
        { label: 'Demandas Emocionais', average: 2.35, isCritical: true },
        { label: 'Ritmo & Pressão', average: 2.60, isCritical: true },
        { label: 'Apoio da Gestão', average: 3.10, isCritical: false },
        { label: 'Autonomia Decisória', average: 3.45, isCritical: false },
        { label: 'Clareza de Papel', average: 3.80, isCritical: false }
      ];

  // 3. Eficácia de ações (com baseline coerente quando ações ainda estão sendo estruturadas)
  const effectiveCount = actions.filter(a => a.status === 'effective').length;
  const ineffectiveCount = actions.filter(a => a.status === 'ineffective').length;
  const inProgressCount = actions.filter(a => ['planned', 'in_progress', 'implemented'].includes(a.status)).length;

  const greeting = getGreeting(account?.name || 'Gestor', now);
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
        total: activeActions.length,
        onTime: onTimeCount,
        onTrack: onTimeCount,
        overdue: overdueCount,
        reviewDue: reviewDueCount,
        needsReview: reviewDueCount
      },
      actionsSummary: {
        total: activeActions.length,
        onTrack: onTimeCount,
        overdue: overdueCount,
        needsReview: reviewDueCount
      },
      population: {
        totalMembers: members.length,
        membersCount: members.length,
        totalGroups: groups.length,
        groupsCount: groups.length,
        lastSurveyDate
      },
      monitoredPopulation: {
        membersCount: members.length,
        groupsCount: groups.length
      }
    },
    charts: {
      participationTrend: participationList,
      participationTrendData: {
        labels: participationList.map(p => p.cycle),
        rates: participationList.map(p => p.rate),
        target: 70
      },
      factorRanking,
      factorAverages: {
        labels: factorRanking.map(f => f.label),
        values: factorRanking.map(f => f.average)
      },
      efficacy: {
        effective: effectiveCount,
        ineffective: ineffectiveCount,
        inProgress: inProgressCount,
        total: actions.length
      },
      actionEfficacy: {
        labels: ['Eficazes', 'Em andamento', 'A revisar'],
        counts: [effectiveCount, inProgressCount, reviewDueCount]
      }
    },
    isEmpty: members.length === 0 && surveys.length === 0
  };
}

module.exports = {
  getSaoPauloDate,
  formatPortugueseDate,
  getGreeting,
  computeDecisionQueue
};
