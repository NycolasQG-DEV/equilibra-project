/* Hoje — Painel Operacional */

import { renderShell } from '../../ui/shell.js';
import { esc, attr, fmtPercent } from '../../domain/formatters.js';
import { decisionQueueLabels, priorityLabels } from '../../domain/labels.js';

export function renderToday({ state }) {
  const isViewer = state.account?.role === 'viewer';
  const todayData = state.today;
  const dateFormatted = todayData?.dateFormatted || '';
  const queue = todayData?.queue || todayData?.decisionQueue || [];
  const kpis = todayData?.kpis || {};
  const charts = todayData?.charts || {};
  const isNewCompany = !state.members?.length && !state.surveys?.length;

  // Coletas abertas normalizadas + ordenadas por urgência
  const rawOpenSurveys = kpis.openSurveys || (state.surveys ? state.surveys.filter(s => s.status === 'open') : []);
  const openSurveys = rawOpenSurveys
    .map(s => {
      const totalInvited = s.totalInvited || s.invitedCount || s.groupSize || s.memberIds?.length || 0;
      const responsesCount = s.responsesCount || s.responseCount || 0;
      const rate = s.participationRate != null
        ? s.participationRate
        : (totalInvited > 0 ? responsesCount / totalInvited : 0);
      const closeDate = s.endsAt || s.closesAt ? new Date(s.endsAt || s.closesAt) : null;
      const daysRemaining = s.daysRemaining != null
        ? s.daysRemaining
        : (closeDate ? Math.max(0, Math.ceil((closeDate - Date.now()) / (1000 * 60 * 60 * 24))) : null);
      return { ...s, totalInvited, responsesCount, participationRate: rate, daysRemaining };
    })
    // Mais urgente primeiro: sem respostas > encerra logo com baixa adesão > resto
    .sort((a, b) => {
      const scoreA = urgencyScore(a);
      const scoreB = urgencyScore(b);
      return scoreB - scoreA;
    });

  const hasOpenSurveys = openSurveys.length > 0;
  const actionsSummary = kpis.actionsSummary || {};

  // Histórico real (para gráficos)
  const partTrendList = Array.isArray(charts.participationTrend)
    ? charts.participationTrend
    : (charts.participationTrendData?.labels
        ? charts.participationTrendData.labels.map((lbl, i) => ({ cycle: lbl, rate: charts.participationTrendData.rates[i] }))
        : []);
  const factorRankingList = Array.isArray(charts.factorRanking)
    ? charts.factorRanking
    : (charts.factorAverages?.labels
        ? charts.factorAverages.labels.map((lbl, i) => ({ label: lbl, average: charts.factorAverages.values[i] }))
        : []);
  const hasReports = (state.reports && state.reports.length > 0) || factorRankingList.length > 0;

  // ══════════════════════════════════════════════════════
  // 1. Fila de pendências (full-width, só se houver itens)
  // ══════════════════════════════════════════════════════
  let queueHtml = '';
  if (queue.length > 0) {
    queueHtml = `
      <section class="mb-5" aria-labelledby="queue-heading">
        <div class="flex items-center gap-2 mb-3">
          <i class="fa-solid fa-bell color-primary" aria-hidden="true"></i>
          <h2 id="queue-heading" class="font-semibold text-sm m-0">Atenção necessária (${queue.length})</h2>
        </div>
        <div class="flex flex-col gap-3">
          ${queue.map(item => renderQueueItem(item, isViewer)).join('')}
        </div>
      </section>
    `;
  }

  // ══════════════════════════════════════════════════════
  // 2. Coluna principal — tabela de coletas
  // ══════════════════════════════════════════════════════
  let mainHtml = '';

  if (hasOpenSurveys) {
    mainHtml = `
      <div class="card">
        <div class="card-header py-3 px-4 flex items-center gap-2">
          <h2 class="card-title text-sm font-semibold m-0">Coletas em andamento</h2>
          <span class="badge badge-primary">${openSurveys.length} ${openSurveys.length === 1 ? 'ativa' : 'ativas'}</span>
        </div>
        <div class="card-body p-0">
          <div class="table-wrap table-borderless">
            <table class="table">
              <thead>
                <tr>
                  <th>Pesquisa</th>
                  <th>Grupo</th>
                  <th>Prazo</th>
                  <th>Adesão</th>
                  <th class="text-right">Ação</th>
                </tr>
              </thead>
              <tbody>
                ${openSurveys.map((s, idx) => {
                  const isHidden = idx >= 5;
                  const isClosingSoon = s.daysRemaining != null && s.daysRemaining <= 7;
                  const hasNoResponse = s.responsesCount === 0;
                  const isUrgent = hasNoResponse || (isClosingSoon && s.participationRate < 0.5);
                  const groupLabel = s.groupName || s.cycle || 'Geral';

                  return `
                    <tr class="${isHidden ? 'survey-item-collapsible hidden' : ''}${isUrgent ? ' today-row-urgent' : ''}">
                      <td>
                        <a href="#pesquisas/${attr(s.id)}/distribuicao"
                           class="font-medium hover:color-primary"
                           title="${attr(s.title)}">
                          ${esc(s.title)}
                        </a>
                        ${hasNoResponse ? `<span class="today-row-signal">sem respostas</span>` : ''}
                        ${!hasNoResponse && isClosingSoon && s.participationRate < 0.5
                          ? `<span class="today-row-signal today-row-signal-warn">adesão baixa</span>`
                          : ''}
                      </td>
                      <td>
                        <span class="badge badge-neutral text-xs">${esc(groupLabel)}</span>
                      </td>
                      <td>
                        <span class="${s.daysRemaining != null && s.daysRemaining <= 3 ? 'color-danger font-semibold' : 'color-text-secondary'} text-xs">
                          ${s.daysRemaining != null
                            ? (s.daysRemaining <= 0 ? 'Encerra hoje' : `${s.daysRemaining}d restantes`)
                            : 'Prazo aberto'}
                        </span>
                      </td>
                      <td>
                        <span class="font-semibold text-xs ${s.participationRate < 0.3 && s.totalInvited > 0 ? 'color-danger' : ''}">
                          ${fmtPercent(s.participationRate)}
                        </span>
                        <span class="color-muted text-xs ml-1">${s.responsesCount}/${s.totalInvited}</span>
                      </td>
                      <td class="text-right">
                        <a href="#pesquisas/${attr(s.id)}/distribuicao"
                           class="btn btn-secondary btn-sm btn-compact">
                          ${hasNoResponse ? 'Disparar convites' : 'Acompanhar'}
                        </a>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
          ${openSurveys.length > 5 ? `
            <div class="p-2 text-center border-t border-border">
              <button type="button"
                      class="btn btn-ghost btn-sm text-xs"
                      data-action="toggle-more-surveys"
                      id="btn-toggle-more-surveys"
                      data-expanded="false">
                <i class="fa-solid fa-chevron-down mr-1" aria-hidden="true"></i>
                Mostrar mais (${openSurveys.length - 5} pesquisas)
              </button>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  } else if (isNewCompany) {
    mainHtml = renderOnboarding();
  } else {
    mainHtml = `
      <div class="card">
        <div class="today-empty-cta">
          <div class="today-empty-cta-icon">
            <i class="fa-regular fa-clipboard" aria-hidden="true"></i>
          </div>
          <div>
            <p class="font-semibold text-sm m-0">Nenhuma coleta em andamento</p>
            <p class="color-text-secondary text-xs mt-1 mb-0">Abra uma nova pesquisa para iniciar a escuta com seus colaboradores.</p>
          </div>
          ${!isViewer ? `
            <a href="#pesquisas/nova" class="btn btn-primary btn-sm">
              <i class="fa-solid fa-plus mr-1" aria-hidden="true"></i> Nova Pesquisa
            </a>
          ` : ''}
        </div>
      </div>
    `;
  }

  // ══════════════════════════════════════════════════════
  // 3. Sidebar — Situação atual (sinal computado, não contador)
  // ══════════════════════════════════════════════════════
  let situacaoCard = '';
  if (hasOpenSurveys) {
    const noResponseSurveys = openSurveys.filter(s => s.responsesCount === 0);
    const closingSoonLow = openSurveys.filter(s =>
      s.daysRemaining != null && s.daysRemaining <= 7 && s.participationRate < 0.5 && s.responsesCount > 0
    );
    const mostUrgent = openSurveys[0]; // já ordenado por urgência

    if (noResponseSurveys.length > 0) {
      const count = noResponseSurveys.length;
      const target = noResponseSurveys[0];
      situacaoCard = `
        <div class="today-sidebar-card today-sidebar-card-alert">
          <p class="today-sidebar-card-title">Situação das coletas</p>
          <p class="text-sm font-semibold mb-1">
            ${count === 1
              ? 'Uma pesquisa ainda sem nenhuma resposta.'
              : `${count} pesquisas sem nenhuma resposta.`}
          </p>
          <p class="color-text-secondary text-xs mb-3">
            Disparar convites aumenta a adesão e garante dados estatisticamente válidos.
          </p>
          <a href="#pesquisas/${attr(target.id)}/distribuicao"
             class="btn btn-primary btn-sm w-full text-center">
            <i class="fa-solid fa-paper-plane mr-1" aria-hidden="true"></i>
            Disparar convites
          </a>
          ${count > 1 ? `
            <p class="color-text-secondary text-xs mt-2 text-center">
              + ${count - 1} outra${count - 1 > 1 ? 's' : ''} pesquisa${count - 1 > 1 ? 's' : ''} na mesma situação
            </p>
          ` : ''}
        </div>
      `;
    } else if (closingSoonLow.length > 0) {
      const target = closingSoonLow[0];
      situacaoCard = `
        <div class="today-sidebar-card today-sidebar-card-warn">
          <p class="today-sidebar-card-title">Situação das coletas</p>
          <p class="text-sm font-semibold mb-1">
            ${closingSoonLow.length === 1
              ? 'Uma pesquisa encerra em breve com adesão baixa.'
              : `${closingSoonLow.length} pesquisas encerram em breve com adesão baixa.`}
          </p>
          <p class="color-text-secondary text-xs mb-3">
            Envie um lembrete ou compartilhe o link direto com os colaboradores.
          </p>
          <div class="flex flex-col gap-2">
            ${!isViewer ? `
              <button type="button"
                      class="btn btn-secondary btn-sm"
                      data-action="copy-survey-url"
                      data-url="${attr(`${window.location.origin}/responder/${target.id}`)}">
                <i class="fa-regular fa-copy mr-1" aria-hidden="true"></i>
                Copiar link da pesquisa
              </button>
            ` : ''}
            <a href="#pesquisas/${attr(target.id)}/distribuicao" class="btn btn-secondary btn-sm">
              <i class="fa-solid fa-paper-plane mr-1" aria-hidden="true"></i>
              Ver distribuição
            </a>
          </div>
        </div>
      `;
    } else {
      // Coletas ok — só link de acesso rápido, sem bloco de dados inúteis
      situacaoCard = `
        <div class="today-sidebar-card">
          <p class="today-sidebar-card-title">Situação das coletas</p>
          <div class="flex items-center gap-2 mb-3">
            <i class="fa-solid fa-circle-check color-success" aria-hidden="true"></i>
            <span class="text-sm">Coletas em andamento normalmente.</span>
          </div>
          ${!isViewer ? `
            <button type="button"
                    class="today-quick-action-btn"
                    data-action="copy-survey-url"
                    data-url="${attr(`${window.location.origin}/responder/${mostUrgent.id}`)}">
              <i class="fa-regular fa-copy tqa-icon" aria-hidden="true"></i>
              Copiar link para compartilhar
            </button>
          ` : ''}
        </div>
      `;
    }
  }

  // ══════════════════════════════════════════════════════
  // 4. Sidebar — Planos de ação (só se houver ações reais e relevantes)
  // ══════════════════════════════════════════════════════
  let actionsCard = '';
  const overdueCount = actionsSummary.overdue || 0;
  const reviewCount  = actionsSummary.needsReview || 0;
  const onTrackCount = actionsSummary.onTrack || 0;

  if (overdueCount > 0 || reviewCount > 0) {
    // Há algo que requer atenção — vale mostrar
    actionsCard = `
      <div class="today-sidebar-card ${overdueCount > 0 ? 'today-sidebar-card-alert' : 'today-sidebar-card-warn'}">
        <p class="today-sidebar-card-title">Planos de ação</p>
        ${overdueCount > 0 ? `
          <p class="text-sm font-semibold mb-1">
            ${overdueCount} plano${overdueCount > 1 ? 's' : ''} em atraso.
          </p>
          <p class="color-text-secondary text-xs mb-3">Revise o status e atualize o prazo ou a responsabilidade.</p>
        ` : `
          <p class="text-sm font-semibold mb-1">
            ${reviewCount} plano${reviewCount > 1 ? 's' : ''} aguardando revisão.
          </p>
          <p class="color-text-secondary text-xs mb-3">Avalie a eficácia das ações implementadas.</p>
        `}
        <a href="#acoes" class="btn btn-secondary btn-sm">Ver planos de ação →</a>
      </div>
    `;
  } else if (onTrackCount > 0) {
    // Tudo ok mas há ações — mostrar de forma discreta
    actionsCard = `
      <div class="today-sidebar-card">
        <p class="today-sidebar-card-title">Planos de ação</p>
        <div class="flex items-center gap-2 mb-2">
          <i class="fa-solid fa-circle-check color-success" aria-hidden="true"></i>
          <span class="text-sm">${onTrackCount} plano${onTrackCount > 1 ? 's' : ''} no prazo.</span>
        </div>
        <a href="#acoes" class="btn btn-ghost btn-sm text-xs">Ver planos →</a>
      </div>
    `;
  }
  // Se não há nenhum plano de ação: não mostrar nada. Silêncio é informação.

  // ══════════════════════════════════════════════════════
  // 5. Monta sidebar e layout
  // ══════════════════════════════════════════════════════
  const hasSidebar = !!(situacaoCard || actionsCard);
  const sidebarHtml = hasSidebar
    ? `<aside class="today-sidebar">${situacaoCard}${actionsCard}</aside>`
    : '';

  const layoutHtml = hasSidebar
    ? `<div class="today-layout"><div class="today-main">${mainHtml}</div>${sidebarHtml}</div>`
    : mainHtml;

  // ══════════════════════════════════════════════════════
  // 6. Gráficos (full-width, só com histórico real)
  // ══════════════════════════════════════════════════════
  let chartsHtml = '';
  if (hasReports) {
    chartsHtml = `
      <div class="grid grid-cols-3 gap-4 mt-6">
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Adesão por ciclo</h3>
            ${partTrendList.length > 0 ? `<button type="button" class="btn btn-ghost btn-sm" data-action="toggle-chart-table" data-target="table-participation">Ver tabela</button>` : ''}
          </div>
          <div class="card-body chart-container-fixed">
            ${partTrendList.length > 0 ? `
              <canvas id="chart-participation-canvas" role="img" aria-label="Tendência de participação nos ciclos"></canvas>
              <div id="table-participation" class="table-wrap chart-fallback-table chart-fallback-hidden">
                <table class="table">
                  <thead><tr><th>Ciclo</th><th>Adesão</th></tr></thead>
                  <tbody>${partTrendList.map(p => `<tr><td>${esc(p.fullCycle || p.cycle)}</td><td>${p.rate}%</td></tr>`).join('')}</tbody>
                </table>
              </div>
            ` : `<div class="flex items-center justify-center h-full"><p class="color-text-secondary text-xs text-center m-0">Histórico disponível após o encerramento do primeiro ciclo.</p></div>`}
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Fatores avaliados</h3>
            ${factorRankingList.length > 0 ? `<button type="button" class="btn btn-ghost btn-sm" data-action="toggle-chart-table" data-target="table-factors">Ver tabela</button>` : ''}
          </div>
          <div class="card-body chart-container-fixed">
            ${factorRankingList.length > 0 ? `
              <canvas id="chart-factors-canvas" role="img" aria-label="Média dos fatores avaliados"></canvas>
              <div id="table-factors" class="table-wrap chart-fallback-table chart-fallback-hidden">
                <table class="table">
                  <thead><tr><th>Fator</th><th>Média</th></tr></thead>
                  <tbody>${factorRankingList.map(f => `<tr><td>${esc(f.label)}</td><td>${f.average}</td></tr>`).join('')}</tbody>
                </table>
              </div>
            ` : `<div class="flex items-center justify-center h-full"><p class="color-text-secondary text-xs text-center m-0">Resultados disponíveis após o encerramento da coleta.</p></div>`}
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Eficácia das ações</h3>
            ${(charts.efficacy?.total || 0) > 0 ? `<button type="button" class="btn btn-ghost btn-sm" data-action="toggle-chart-table" data-target="table-actions">Ver tabela</button>` : ''}
          </div>
          <div class="card-body chart-container-fixed">
            ${(charts.efficacy?.total || 0) > 0 ? `
              <canvas id="chart-actions-canvas" role="img" aria-label="Eficácia dos planos de ação"></canvas>
              <div id="table-actions" class="table-wrap chart-fallback-table chart-fallback-hidden">
                <table class="table">
                  <thead><tr><th>Status</th><th>Qtd</th></tr></thead>
                  <tbody>${(charts.actionEfficacy?.labels || ['Eficazes', 'Em andamento', 'A revisar']).map((lbl, i) =>
                    `<tr><td>${esc(lbl)}</td><td>${charts.actionEfficacy?.counts?.[i] ?? 0}</td></tr>`
                  ).join('')}</tbody>
                </table>
              </div>
            ` : `
              <div class="flex items-center justify-center h-full">
                <div class="text-center">
                  <p class="color-text-secondary text-xs m-0">Nenhum plano cadastrado.</p>
                  <a href="#acoes" class="btn btn-secondary btn-sm btn-compact mt-2">Criar plano</a>
                </div>
              </div>
            `}
          </div>
        </div>
      </div>
    `;
  }

  const content = `
    <div class="today-page">
      <div class="flex items-center justify-between mb-6">
        <div>
          <h1 class="view-title">Hoje</h1>
          <p class="view-subtitle">${esc(dateFormatted)}</p>
        </div>
        ${!isViewer ? `
          <a href="#pesquisas/nova" class="btn btn-primary">
            <i class="fa-solid fa-plus" aria-hidden="true"></i> Nova Pesquisa
          </a>
        ` : ''}
      </div>

      ${queueHtml}
      ${layoutHtml}
      ${chartsHtml}
    </div>
  `;

  return renderShell({
    activePath: 'hoje',
    breadcrumbs: [{ label: 'Hoje' }],
    content,
    state
  });
}

/**
 * Calcula pontuação de urgência para ordenar a tabela.
 * Mais urgente = pontuação maior.
 */
function urgencyScore(s) {
  let score = 0;
  // Sem nenhuma resposta = mais urgente
  if (s.responsesCount === 0) score += 100;
  // Encerra em breve com baixa adesão
  if (s.daysRemaining != null && s.daysRemaining <= 7) score += (7 - s.daysRemaining) * 5;
  // Participação muito baixa
  if (s.participationRate < 0.3) score += 30;
  else if (s.participationRate < 0.5) score += 15;
  return score;
}

function renderOnboarding() {
  return `
    <div class="card">
      <div class="card-header">
        <h2 class="card-title">
          <i class="fa-solid fa-compass color-primary" aria-hidden="true"></i> Primeiros passos
        </h2>
      </div>
      <div class="card-body">
        <p class="color-text-secondary text-sm mb-4">
          Complete as etapas abaixo para conduzir a primeira pesquisa com seus colaboradores:
        </p>
        <div class="grid grid-cols-4 gap-4">
          <div class="card p-4">
            <strong class="text-sm">1. Colaboradores</strong>
            <p class="color-text-secondary text-xs my-2">Importe por planilha ou adicione manualmente.</p>
            <a href="#organizacao/pessoas" class="btn btn-secondary btn-sm">Cadastrar</a>
          </div>
          <div class="card p-4">
            <strong class="text-sm">2. Grupos</strong>
            <p class="color-text-secondary text-xs my-2">Setores ou áreas da empresa.</p>
            <a href="#organizacao/grupos" class="btn btn-secondary btn-sm">Criar grupos</a>
          </div>
          <div class="card p-4">
            <strong class="text-sm">3. Pesquisa</strong>
            <p class="color-text-secondary text-xs my-2">Escolha o modelo de questionário.</p>
            <a href="#pesquisas/nova" class="btn btn-secondary btn-sm">Nova pesquisa</a>
          </div>
          <div class="card p-4">
            <strong class="text-sm">4. Resultados</strong>
            <p class="color-text-secondary text-xs my-2">Relatórios e planos de ação.</p>
            <span class="badge badge-neutral">Aguardando</span>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderQueueItem(item, isViewer = false) {
  const rawPriority = item.priority || 'medium';
  const priorityClass = rawPriority === 'high' ? 'badge-danger'
    : rawPriority === 'medium_high' ? 'badge-warning'
    : 'badge-info';
  const edgeClass = rawPriority === 'high' ? 'card-danger-edge' : 'card-warning-edge';
  const dotClass = rawPriority === 'high' ? 'dot-danger'
    : rawPriority === 'medium_high' ? 'dot-warning'
    : 'dot-info';

  let cleanLabel = item.priorityLabel || priorityLabels[rawPriority] || (rawPriority === 'medium_high' ? 'Média-Alta' : rawPriority);
  cleanLabel = cleanLabel.replace(/^prioridade\s*/i, '');
  const label = item.title || decisionQueueLabels[item.type] || 'Ação Requerida';
  const canNavigate = !isViewer || (item.actionUrl && (item.actionUrl.startsWith('resultados') || item.actionUrl.startsWith('pesquisas/')));

  return `
    <div class="card ${edgeClass}">
      <div class="card-body flex items-center justify-between p-4 flex-wrap gap-3">
        <div>
          <div class="flex items-center gap-2 mb-1">
            <span class="badge ${priorityClass}">
              <span class="status-dot ${dotClass}" aria-hidden="true"></span>
              Prioridade ${esc(cleanLabel)}
            </span>
            <strong class="color-primary text-sm">${esc(label)}</strong>
          </div>
          <p class="color-text-secondary text-xs m-0">${esc(item.message || item.description)}</p>
        </div>
        <div>
          ${canNavigate && item.actionUrl ? `
            <a href="#${attr(item.actionUrl)}" class="btn btn-secondary btn-sm">
              ${isViewer ? 'Visualizar' : esc(item.actionLabel || 'Resolver')}
            </a>
          ` : ''}
        </div>
      </div>
    </div>
  `;
}

export function mountedToday({ state }) {
  const charts = state.today?.charts;
  if (!charts || !window.DashboardCharts) return;

  const partCanvas = document.getElementById('chart-participation-canvas');
  if (partCanvas && (charts.participationTrend || charts.participationTrendData)) {
    window.DashboardCharts.createParticipationTrendChart(partCanvas, charts.participationTrend || charts.participationTrendData);
  }

  const factorCanvas = document.getElementById('chart-factors-canvas');
  if (factorCanvas && (charts.factorRanking || charts.factorAverages)) {
    window.DashboardCharts.createFactorBarChart(factorCanvas, charts.factorRanking || charts.factorAverages);
  }

  const actionCanvas = document.getElementById('chart-actions-canvas');
  if (actionCanvas && (charts.actionEfficacy || charts.efficacy)) {
    window.DashboardCharts.createActionEfficacyChart(actionCanvas, charts.actionEfficacy || charts.efficacy);
  }
}
