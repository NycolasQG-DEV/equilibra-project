/* Decision Cockpit: Hoje view */

import { renderShell } from '../../ui/shell.js';
import { esc, attr, fmt, fmtPercent } from '../../domain/formatters.js';
import { decisionQueueLabels, priorityLabels } from '../../domain/labels.js';

export function renderToday({ state }) {
  const isViewer = state.account?.role === 'viewer';
  const todayData = state.today;
  const userName = state.account?.name ? state.account.name.split(' ')[0] : 'Gestor';
  const greeting = todayData?.greeting || `Olá, ${userName}.`;
  const dateFormatted = todayData?.dateFormatted || '';
  const queue = todayData?.queue || todayData?.decisionQueue || [];
  const kpis = todayData?.kpis || {};
  const charts = todayData?.charts || {};
  const isNewCompany = !state.members?.length && !state.surveys?.length;

  let queueHtml = '';
  if (queue.length === 0) {
    queueHtml = `
      <div class="today-status-strip mb-6">
        <i class="fa-solid fa-circle-check status-strip-icon" aria-hidden="true"></i>
        <div class="status-strip-text">
          <strong>Tudo em dia</strong>
          <span>— Nenhuma ação requer intervenção no momento. Operação estável.</span>
        </div>
      </div>
    `;
  } else {
    queueHtml = `
      <section class="mb-6" aria-labelledby="queue-heading">
        <div class="flex items-center justify-between mb-3">
          <h2 id="queue-heading" class="card-title">
            <i class="fa-solid fa-bell color-primary" aria-hidden="true"></i>
            Ações e Decisões Prioritárias (${queue.length})
          </h2>
          <span class="table-subtext">
            Governança e conformidade contínua NR-1
          </span>
        </div>
        <div class="flex flex-col gap-3">
          ${queue.map(item => renderQueueItem(item, isViewer)).join('')}
        </div>
      </section>
    `;
  }

  // Guided onboarding for brand new workspaces
  let onboardingHtml = '';
  if (isNewCompany && !isViewer) {
    onboardingHtml = `
      <div class="card mb-6">
        <div class="card-header bg-subtle">
          <h2 class="card-title color-primary">
            <i class="fa-solid fa-compass" aria-hidden="true"></i> Primeiros passos no Equilibra
          </h2>
          <span class="badge badge-primary">Guia inicial</span>
        </div>
        <div class="card-body">
          <p class="mb-4">
            Complete as etapas abaixo para conduzir a primeira escuta coletiva confidencial da sua empresa:
          </p>
          <div class="grid grid-cols-4 gap-4">
            <div class="card p-4">
              <strong>1. Cadastrar colaboradores</strong>
              <p class="table-subtext my-2">Importe por planilha ou adicione individualmente.</p>
              <a href="#organizacao/pessoas" class="btn btn-secondary btn-sm">Cadastrar</a>
            </div>
            <div class="card p-4">
              <strong>2. Definir grupos</strong>
              <p class="table-subtext my-2">Segmentos organizacionais com no mínimo 5 pessoas.</p>
              <a href="#organizacao/grupos" class="btn btn-secondary btn-sm">Criar grupos</a>
            </div>
            <div class="card p-4">
              <strong>3. Criar pesquisa</strong>
              <p class="table-subtext my-2">Escolha o instrumento exploratório ou HSE.</p>
              <a href="#pesquisas/nova" class="btn btn-secondary btn-sm">Nova pesquisa</a>
            </div>
            <div class="card p-4">
              <strong>4. Ver relatório</strong>
              <p class="table-subtext my-2">Resultados coletivos e plano de ação NR-1/PGR.</p>
              <span class="badge badge-neutral">Aguardando escuta</span>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // Operational KPIs & Open Surveys
  const rawOpenSurveys = kpis.openSurveys || (state.surveys ? state.surveys.filter(s => s.status === 'open') : []);
  const openSurveys = rawOpenSurveys.map(s => {
    const totalInvited = s.totalInvited || s.invitedCount || s.groupSize || s.memberIds?.length || 0;
    const responsesCount = s.responsesCount || s.responseCount || 0;
    const rate = s.participationRate != null
      ? s.participationRate
      : (totalInvited > 0 ? responsesCount / totalInvited : 0);
    const closeDate = s.endsAt || s.closesAt ? new Date(s.endsAt || s.closesAt) : null;
    const daysRemaining = s.daysRemaining != null
      ? s.daysRemaining
      : (closeDate ? Math.max(0, Math.ceil((closeDate - Date.now()) / (1000 * 60 * 60 * 24))) : null);

    return {
      ...s,
      totalInvited,
      responsesCount,
      participationRate: rate,
      daysRemaining
    };
  });

  const totalOpenResponses = openSurveys.reduce((sum, s) => sum + s.responsesCount, 0);
  const totalOpenInvited = openSurveys.reduce((sum, s) => sum + s.totalInvited, 0);
  const aggregateRate = totalOpenInvited > 0 ? totalOpenResponses / totalOpenInvited : 0;

  const actions = kpis.actionsSummary || kpis.actions || { total: 0, onTrack: 0, overdue: 0, needsReview: 0 };
  const pop = kpis.monitoredPopulation || kpis.population || { membersCount: 0, groupsCount: 0 };

  const membersCount = pop.membersCount ?? pop.totalMembers ?? (state.members ? state.members.length : 0);
  const groupsCount = pop.groupsCount ?? pop.totalGroups ?? (state.groups ? state.groups.filter(g => !g.isDefault).length : 0);

  const kpisHtml = `
    <div class="grid grid-cols-3 gap-4 mb-6">
      <div class="kpi-card">
        <span class="kpi-title">Pesquisas Ativas</span>
        <div class="kpi-val">${openSurveys.length} <span class="text-sm font-normal color-muted">${openSurveys.length === 1 ? 'coleta ativa' : 'coletas ativas'}</span></div>
        <div class="table-subtext mt-1">
          ${openSurveys.length > 0
            ? `${totalOpenResponses} de ${totalOpenInvited} pessoas responderam (${fmtPercent(aggregateRate)})`
            : 'Nenhuma coleta aberta no momento'}
        </div>
        ${openSurveys.length > 0 ? `
          <div class="dist-bar dist-bar-sm mt-2" title="Taxa agregada de adesão: ${fmtPercent(aggregateRate)}">
            <div class="dist-bar-seg bg-primary" data-width="${Math.min(100, Math.round(aggregateRate * 100))}"></div>
          </div>
        ` : ''}
        <span class="kpi-sub mt-2">Visão geral em tempo real</span>
      </div>

      <div class="kpi-card">
        <span class="kpi-title">Planos de Ação (NR-1)</span>
        <div class="kpi-val">${actions.total || actions.totalActive || 0}</div>
        <div class="flex items-center gap-2 mt-1">
          <span class="badge badge-success" title="No prazo"><span class="status-dot dot-success" aria-hidden="true"></span> ${actions.onTrack || actions.onTime || 0} no prazo</span>
          ${(actions.overdue || 0) > 0 ? `<span class="badge badge-danger" title="Atrasadas"><span class="status-dot dot-danger" aria-hidden="true"></span> ${actions.overdue} atrasadas</span>` : ''}
          ${(actions.needsReview || actions.reviewDue || 0) > 0 ? `<span class="badge badge-warning" title="Aguardando revisão de eficácia"><span class="status-dot dot-warning" aria-hidden="true"></span> ${actions.needsReview || actions.reviewDue} a revisar</span>` : ''}
        </div>
        <span class="kpi-sub mt-2">Acompanhamento contínuo no PGR</span>
      </div>

      <div class="kpi-card">
        <span class="kpi-title">População Monitorada</span>
        <div class="kpi-val">${membersCount}</div>
        <div class="table-subtext mt-1">
          colaboradores em ${groupsCount} áreas ativas
        </div>
        <span class="kpi-sub mt-2">Base ativa de colaboradores</span>
      </div>
    </div>
  `;

  const openSurveysSectionHtml = `
    <div class="card mb-6">
      <div class="card-header flex items-center justify-between flex-wrap gap-2 py-3 px-4">
        <div class="flex items-center gap-2">
          <h2 class="card-title text-sm font-semibold m-0">Escutas em Andamento</h2>
          <span class="badge badge-primary text-xs">${openSurveys.length} ${openSurveys.length === 1 ? 'ativa' : 'ativas'}</span>
        </div>
        <a href="#pesquisas" class="table-subtext text-xs hover:color-primary flex items-center gap-1 font-medium">
          Ver todas no painel <i class="fa-solid fa-arrow-right text-[10px]" aria-hidden="true"></i>
        </a>
      </div>
      <div class="card-body p-0">
        ${openSurveys.length === 0 ? `
          <div class="flex items-center justify-center text-center p-6">
            <div>
              <div class="mb-2 color-primary text-xl"><i class="fa-solid fa-clipboard-list" aria-hidden="true"></i></div>
              <p class="font-medium text-sm m-0">Nenhuma pesquisa em andamento</p>
              <p class="table-subtext text-xs mt-1 mb-3">Abra uma nova escuta coletiva para iniciar a coleta.</p>
              <a href="#pesquisas/nova" class="btn btn-primary btn-sm">
                <i class="fa-solid fa-plus" aria-hidden="true"></i> Nova Escuta
              </a>
            </div>
          </div>
        ` : `
          <div class="today-surveys-list">
            ${openSurveys.map((s, idx) => {
              const isHidden = idx >= 3;
              return `
                <div class="today-survey-row ${isHidden ? 'survey-item-collapsible hidden' : ''}">
                  <div class="today-survey-main">
                    <div class="flex items-center gap-2 flex-wrap mb-1">
                      <a href="#pesquisas/${attr(s.id)}/distribuicao" class="today-survey-name" title="${attr(s.title)}">
                        ${esc(s.title)}
                      </a>
                      <span class="badge badge-subtle text-xs">${esc(s.model || 'Diagnóstico')}</span>
                    </div>
                    <div class="today-survey-details">
                      <span>${esc(s.cycle || 'Geral')}</span>
                      <span class="dot-separator">•</span>
                      <span class="color-muted">${s.daysRemaining != null ? (s.daysRemaining <= 0 ? 'Encerra hoje' : `${s.daysRemaining}d restantes`) : 'Prazo aberto'}</span>
                    </div>
                    <div class="dist-bar dist-bar-sm mt-2" title="Adesão: ${fmtPercent(s.participationRate)}">
                      <div class="dist-bar-seg bg-primary" data-width="${Math.min(100, Math.round(s.participationRate * 100))}"></div>
                    </div>
                  </div>

                  <div class="today-survey-side">
                    <div class="today-survey-metric">
                      <span class="today-survey-rate">${fmtPercent(s.participationRate)}</span>
                      <span class="today-survey-sub">${s.responsesCount} de ${s.totalInvited} resp.</span>
                    </div>
                    <a href="#pesquisas/${attr(s.id)}/distribuicao" class="btn btn-secondary btn-sm today-survey-btn" title="Acompanhar coleta">
                      Acompanhar
                    </a>
                  </div>
                </div>
              `;
            }).join('')}
          </div>

          ${openSurveys.length > 3 ? `
            <div class="p-2 text-center border-t border-border bg-surface-subtle">
              <button type="button" class="btn btn-ghost btn-sm font-medium" data-action="toggle-more-surveys" id="btn-toggle-more-surveys" data-expanded="false">
                <i class="fa-solid fa-chevron-down mr-1" aria-hidden="true"></i> Mostrar mais (${openSurveys.length - 3} pesquisas)
              </button>
            </div>
          ` : ''}
        `}
      </div>
    </div>
  `;

  // Decision Charts Section
  const partTrendList = Array.isArray(charts.participationTrend) ? charts.participationTrend : (charts.participationTrendData?.labels ? charts.participationTrendData.labels.map((lbl, i) => ({ cycle: lbl, rate: charts.participationTrendData.rates[i] })) : []);
  const factorRankingList = Array.isArray(charts.factorRanking) ? charts.factorRanking : (charts.factorAverages?.labels ? charts.factorAverages.labels.map((lbl, i) => ({ label: lbl, average: charts.factorAverages.values[i] })) : []);

  const chartsHtml = `
    <div class="grid grid-cols-3 gap-4 mb-6">
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">Adesão aos Ciclos</h3>
          ${partTrendList.length > 0 ? `<button type="button" class="btn btn-ghost btn-sm" data-action="toggle-chart-table" data-target="table-participation">Ver tabela</button>` : ''}
        </div>
        <div class="card-body chart-container-fixed">
          ${partTrendList.length > 0 ? `
            <canvas id="chart-participation-canvas" role="img" aria-label="Gráfico de tendência de participação nos ciclos"></canvas>
            <div id="table-participation" class="table-wrap chart-fallback-table chart-fallback-hidden">
              <table class="table">
                <thead><tr><th>Ciclo</th><th>Adesão</th></tr></thead>
                <tbody>
                  ${partTrendList.map(p => `
                    <tr><td>${esc(p.fullCycle || p.cycle)}</td><td>${p.rate}%</td></tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          ` : `
            <div class="flex items-center justify-center text-center p-6 h-full">
              <div>
                <div class="mb-2 color-primary text-xl"><i class="fa-solid fa-chart-line" aria-hidden="true"></i></div>
                <p class="font-medium text-sm m-0">Nenhum ciclo registrado</p>
                <p class="table-subtext text-xs mt-1 mb-3">Inicie uma pesquisa de escuta para acompanhar a taxa de adesão.</p>
                <a href="#pesquisas/nova" class="btn btn-secondary btn-sm">Criar Pesquisa</a>
              </div>
            </div>
          `}
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <h3 class="card-title">Fatores do Último Ciclo</h3>
          ${factorRankingList.length > 0 ? `<button type="button" class="btn btn-ghost btn-sm" data-action="toggle-chart-table" data-target="table-factors">Ver tabela</button>` : ''}
        </div>
        <div class="card-body chart-container-fixed">
          ${factorRankingList.length > 0 ? `
            <canvas id="chart-factors-canvas" role="img" aria-label="Gráfico de média dos fatores psicossociais"></canvas>
            <div id="table-factors" class="table-wrap chart-fallback-table chart-fallback-hidden">
              <table class="table">
                <thead><tr><th>Fator</th><th>Média</th></tr></thead>
                <tbody>
                  ${factorRankingList.map(f => `
                    <tr><td>${esc(f.label)}</td><td>${fmt(f.average)}</td></tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          ` : `
            <div class="flex items-center justify-center text-center p-6 h-full">
              <div>
                <div class="mb-2 color-primary text-xl"><i class="fa-solid fa-shield-halved" aria-hidden="true"></i></div>
                <p class="font-medium text-sm m-0">Aguardando encerramento do ciclo</p>
                <p class="table-subtext text-xs mt-1">As médias de cada dimensão serão consolidadas com quórum estatístico seguro após o fechamento do ciclo.</p>
              </div>
            </div>
          `}
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <h3 class="card-title">Eficácia das Ações</h3>
          ${(charts.efficacy?.total || 0) > 0 ? `<button type="button" class="btn btn-ghost btn-sm" data-action="toggle-chart-table" data-target="table-actions">Ver tabela</button>` : ''}
        </div>
        <div class="card-body chart-container-fixed">
          ${(charts.efficacy?.total || 0) > 0 ? `
            <canvas id="chart-actions-canvas" role="img" aria-label="Gráfico de eficácia das medidas preventivas"></canvas>
            <div id="table-actions" class="table-wrap chart-fallback-table chart-fallback-hidden">
              <table class="table">
                <thead><tr><th>Status</th><th>Qtd</th></tr></thead>
                <tbody>
                  ${(charts.actionEfficacy?.labels || ['Eficazes', 'Em andamento', 'A revisar']).map((lbl, i) => `
                    <tr><td>${esc(lbl)}</td><td>${(charts.actionEfficacy?.counts ? charts.actionEfficacy.counts[i] : 0)}</td></tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          ` : `
            <div class="flex items-center justify-center text-center p-6 h-full">
              <div>
                <div class="mb-2 color-primary text-xl"><i class="fa-solid fa-list-check" aria-hidden="true"></i></div>
                <p class="font-medium text-sm m-0">Nenhum plano de ação cadastrado</p>
                <p class="table-subtext text-xs mt-1 mb-3">Defina medidas preventivas associadas aos fatores avaliados.</p>
                <a href="#planos/novo" class="btn btn-secondary btn-sm">Criar Ação</a>
              </div>
            </div>
          `}
        </div>
      </div>
    </div>
  `;

  const content = `
    <div class="today-page">
      <div class="flex items-center justify-between mb-6">
        <div>
          <h1 class="view-title">${esc(greeting)}</h1>
          <p class="view-subtitle">
            ${esc(dateFormatted)} · Painel de decisão e governança de saúde psicossocial
          </p>
        </div>
        <div class="flex gap-2">
          <a href="#pesquisas/nova" class="btn btn-primary">
            <i class="fa-solid fa-plus" aria-hidden="true"></i> Nova Escuta
          </a>
        </div>
      </div>

      ${onboardingHtml}
      ${queueHtml}
      ${kpisHtml}
      ${chartsHtml}
      ${openSurveysSectionHtml}
    </div>
  `;

  return renderShell({
    activePath: 'hoje',
    breadcrumbs: [{ label: 'Hoje' }],
    content,
    state
  });
}

function renderQueueItem(item, isViewer = false) {
  const priorityClass = item.priority === 'high'
    ? 'badge-danger'
    : item.priority === 'medium_high'
    ? 'badge-warning'
    : 'badge-info';

  const edgeClass = item.priority === 'high' ? 'card-danger-edge' : 'card-warning-edge';
  const rawPriority = item.priority || 'medium';
  const dotClass = rawPriority === 'high' ? 'dot-danger' : rawPriority === 'medium_high' ? 'dot-warning' : 'dot-info';
  let cleanLabel = item.priorityLabel || priorityLabels[rawPriority] || (rawPriority === 'medium_high' ? 'Média-Alta' : rawPriority);
  cleanLabel = cleanLabel.replace(/^prioridade\s*/i, '');
  const label = item.title || decisionQueueLabels[item.type] || 'Ação Requerida';

  const canNavigate = !isViewer || (item.actionUrl && (item.actionUrl.startsWith('resultados') || item.actionUrl.startsWith('pesquisas/')));

  return `
    <div class="card ${edgeClass}">
      <div class="card-body flex items-center justify-between p-4 flex-wrap gap-3">
        <div>
          <div class="flex items-center gap-2 mb-1">
            <span class="badge ${priorityClass}"><span class="status-dot ${dotClass}" aria-hidden="true"></span> Prioridade ${esc(cleanLabel)}</span>
            <strong class="color-primary">${esc(label)}</strong>
          </div>
          <p class="view-subtitle m-0">
            ${esc(item.message || item.description)}
          </p>
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
  document.querySelectorAll('[data-width]').forEach(el => {
    const w = el.dataset.width;
    if (w != null && w !== '') {
      el.style.width = w.endsWith('%') ? w : `${w}%`;
    }
  });

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
