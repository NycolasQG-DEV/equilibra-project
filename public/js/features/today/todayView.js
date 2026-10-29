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
      <div class="card card-stable mb-6">
        <div class="card-body flex items-center justify-between p-4">
          <div class="flex items-center gap-3">
            <div class="status-icon-circle status-icon-circle-success">
              <i class="fa-solid fa-check" aria-hidden="true"></i>
            </div>
            <div>
              <strong class="color-primary font-semibold">Tudo em dia</strong>
              <p class="view-subtitle m-0">
                Nenhuma ação atrasada, relatório pendente de aceite ou quórum crítico exigindo intervenção imediata.
              </p>
            </div>
          </div>
          <span class="badge badge-success">Operação estável</span>
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

  // Operational KPIs
  const activeSurvey = kpis.activeSurvey;
  const actions = kpis.actionsSummary || kpis.actions || { total: 0, onTrack: 0, overdue: 0, needsReview: 0 };
  const pop = kpis.monitoredPopulation || kpis.population || { membersCount: 0, groupsCount: 0 };

  const membersCount = pop.membersCount ?? pop.totalMembers ?? (state.members ? state.members.length : 0);
  const groupsCount = pop.groupsCount ?? pop.totalGroups ?? (state.groups ? state.groups.filter(g => !g.isDefault).length : 0);

  const kpisHtml = `
    <div class="grid grid-cols-3 gap-4 mb-6">
      <div class="kpi-card">
        <span class="kpi-title">Pesquisa em Andamento</span>
        ${activeSurvey ? `
          <div class="kpi-val">${fmtPercent(activeSurvey.participationRate)}</div>
          <div class="table-subtext mb-1">
            ${esc(activeSurvey.title)} · Meta: 70%
          </div>
          <div class="dist-bar">
            <div class="dist-bar-seg bg-primary" data-width="${Math.min(100, Math.round(activeSurvey.participationRate * 100))}"></div>
          </div>
          <span class="kpi-sub mt-2">${activeSurvey.responsesCount || activeSurvey.responses || 0} respostas de ${activeSurvey.totalInvited || activeSurvey.invited || 0} convidados</span>
        ` : `
          <div class="kpi-val color-muted">Nenhuma aberta</div>
          <span class="kpi-sub">Todos os ciclos anteriores foram encerrados.</span>
          <a href="#pesquisas/nova" class="btn btn-secondary btn-sm mt-2">Abrir pesquisa</a>
        `}
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

  // Decision Charts Section
  const partTrendList = Array.isArray(charts.participationTrend) ? charts.participationTrend : (charts.participationTrendData?.labels ? charts.participationTrendData.labels.map((lbl, i) => ({ cycle: lbl, rate: charts.participationTrendData.rates[i] })) : []);
  const factorRankingList = Array.isArray(charts.factorRanking) ? charts.factorRanking : (charts.factorAverages?.labels ? charts.factorAverages.labels.map((lbl, i) => ({ label: lbl, average: charts.factorAverages.values[i] })) : []);

  const chartsHtml = `
    <div class="grid grid-cols-3 gap-4 mb-6">
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">Adesão aos Ciclos</h3>
          <button type="button" class="btn btn-ghost btn-sm" data-action="toggle-chart-table" data-target="table-participation">Ver tabela</button>
        </div>
        <div class="card-body chart-container-fixed">
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
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <h3 class="card-title">Fatores do Último Ciclo</h3>
          <button type="button" class="btn btn-ghost btn-sm" data-action="toggle-chart-table" data-target="table-factors">Ver tabela</button>
        </div>
        <div class="card-body chart-container-fixed">
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
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <h3 class="card-title">Eficácia das Ações</h3>
          <button type="button" class="btn btn-ghost btn-sm" data-action="toggle-chart-table" data-target="table-actions">Ver tabela</button>
        </div>
        <div class="card-body chart-container-fixed">
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
    el.style.width = `${el.dataset.width}%`;
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
