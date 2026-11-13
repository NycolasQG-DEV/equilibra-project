/* Decision Cockpit: Hoje view — Foco Operacional Direto */

import { renderShell } from '../../ui/shell.js';
import { esc, attr, fmt, fmtPercent } from '../../domain/formatters.js';
import { decisionQueueLabels, priorityLabels } from '../../domain/labels.js';

export function renderToday({ state }) {
  const isViewer = state.account?.role === 'viewer';
  const todayData = state.today;
  const dateFormatted = todayData?.dateFormatted || '';
  const queue = todayData?.queue || todayData?.decisionQueue || [];
  const kpis = todayData?.kpis || {};
  const charts = todayData?.charts || {};
  const isNewCompany = !state.members?.length && !state.surveys?.length;

  // Coletas ativas individuais (sem médias artificiais agregadas)
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

  // 1. Fila de Decisões e Pendências Operacionais (só aparece quando de fato há algo pendente)
  let queueHtml = '';
  if (queue.length > 0) {
    queueHtml = `
      <section class="mb-6" aria-labelledby="queue-heading">
        <div class="flex items-center justify-between mb-3">
          <h2 id="queue-heading" class="card-title text-base font-semibold">
            <i class="fa-solid fa-bell color-primary mr-1" aria-hidden="true"></i>
            Ações que Exigem Atenção (${queue.length})
          </h2>
        </div>
        <div class="flex flex-col gap-3">
          ${queue.map(item => renderQueueItem(item, isViewer)).join('')}
        </div>
      </section>
    `;
  }

  // 2. Onboarding para novas organizações (sem membros e sem pesquisas)
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
            Complete as etapas abaixo para conduzir a primeira pesquisa com seus colaboradores:
          </p>
          <div class="grid grid-cols-4 gap-4">
            <div class="card p-4">
              <strong>1. Cadastrar colaboradores</strong>
              <p class="table-subtext my-2">Importe por planilha ou adicione manualmente.</p>
              <a href="#organizacao/pessoas" class="btn btn-secondary btn-sm">Cadastrar</a>
            </div>
            <div class="card p-4">
              <strong>2. Definir grupos</strong>
              <p class="table-subtext my-2">Setores ou áreas da empresa.</p>
              <a href="#organizacao/grupos" class="btn btn-secondary btn-sm">Criar grupos</a>
            </div>
            <div class="card p-4">
              <strong>3. Criar pesquisa</strong>
              <p class="table-subtext my-2">Escolha o modelo de questionário.</p>
              <a href="#pesquisas/nova" class="btn btn-secondary btn-sm">Nova pesquisa</a>
            </div>
            <div class="card p-4">
              <strong>4. Ver resultados</strong>
              <p class="table-subtext my-2">Resultados consolidados e planos de ação.</p>
              <span class="badge badge-neutral">Aguardando</span>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // 3. Painel Principal: Coletas em Andamento (o que está vivo e operando agora)
  let openSurveysSectionHtml = '';
  if (openSurveys.length > 0) {
    openSurveysSectionHtml = `
      <div class="card mb-6">
        <div class="card-header py-3 px-4 flex items-center justify-between">
          <div class="flex items-center gap-2">
            <h2 class="card-title text-sm font-semibold m-0">Coletas em Andamento</h2>
            <span class="badge badge-primary text-xs font-semibold">${openSurveys.length} ${openSurveys.length === 1 ? 'ativa' : 'ativas'}</span>
          </div>
          <span class="table-subtext text-xs">
            Acompanhe o retorno e os convites de cada grupo
          </span>
        </div>
        <div class="card-body p-0">
          <div class="table-wrap table-borderless">
            <table class="table">
              <thead>
                <tr>
                  <th>Pesquisa</th>
                  <th>Público / Setor</th>
                  <th>Prazo</th>
                  <th>Respostas</th>
                  <th class="text-right">Ação</th>
                </tr>
              </thead>
              <tbody>
                ${openSurveys.map((s, idx) => {
                  const isHidden = idx >= 5;
                  const isClosingSoon = s.daysRemaining != null && s.daysRemaining <= 3;
                  const groupLabel = s.groupName || s.cycle || 'Geral';

                  return `
                    <tr class="${isHidden ? 'survey-item-collapsible hidden' : ''}">
                      <td>
                        <a href="#pesquisas/${attr(s.id)}/distribuicao" class="font-medium hover:color-primary" title="${attr(s.title)}">
                          ${esc(s.title)}
                        </a>
                      </td>
                      <td>
                        <span class="badge badge-neutral text-xs">${esc(groupLabel)}</span>
                      </td>
                      <td>
                        <span class="${isClosingSoon ? 'color-danger font-semibold' : 'color-text-secondary'} text-xs">
                          <i class="fa-regular fa-clock text-[10px] mr-1" aria-hidden="true"></i>
                          ${s.daysRemaining != null ? (s.daysRemaining <= 0 ? 'Encerra hoje' : `${s.daysRemaining}d restantes`) : 'Prazo aberto'}
                        </span>
                      </td>
                      <td>
                        <div class="flex items-center gap-2">
                          <span class="font-semibold text-xs">${fmtPercent(s.participationRate)}</span>
                          <span class="color-muted text-xs">(${s.responsesCount} de ${s.totalInvited})</span>
                        </div>
                      </td>
                      <td class="text-right">
                        <a href="#pesquisas/${attr(s.id)}/distribuicao" class="btn btn-secondary btn-sm btn-compact">
                          Acompanhar
                        </a>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>

          ${openSurveys.length > 5 ? `
            <div class="p-2 text-center border-t border-border bg-surface-subtle">
              <button type="button" class="btn btn-ghost btn-sm text-xs font-medium" data-action="toggle-more-surveys" id="btn-toggle-more-surveys" data-expanded="false">
                <i class="fa-solid fa-chevron-down mr-1" aria-hidden="true"></i> Mostrar mais (${openSurveys.length - 5} pesquisas)
              </button>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  } else if (!isNewCompany) {
    openSurveysSectionHtml = `
      <div class="card p-6 text-center mb-6">
        <div class="mb-2 color-primary text-xl"><i class="fa-solid fa-clipboard-check" aria-hidden="true"></i></div>
        <p class="font-semibold text-sm m-0">Nenhuma pesquisa em andamento</p>
        <p class="table-subtext text-xs mt-1 mb-3">Abra uma nova coleta para iniciar a escuta com seus colaboradores.</p>
        <div>
          <a href="#pesquisas/nova" class="btn btn-primary btn-sm">
            <i class="fa-solid fa-plus mr-1" aria-hidden="true"></i> Criar Pesquisa
          </a>
        </div>
      </div>
    `;
  }

  // 4. Seção de Gráficos e Resultados Consolidados (só renderiza se houver histórico real)
  const partTrendList = Array.isArray(charts.participationTrend) ? charts.participationTrend : (charts.participationTrendData?.labels ? charts.participationTrendData.labels.map((lbl, i) => ({ cycle: lbl, rate: charts.participationTrendData.rates[i] })) : []);
  const factorRankingList = Array.isArray(charts.factorRanking) ? charts.factorRanking : (charts.factorAverages?.labels ? charts.factorAverages.labels.map((lbl, i) => ({ label: lbl, average: charts.factorAverages.values[i] })) : []);
  const hasReports = (state.reports && state.reports.length > 0) || factorRankingList.length > 0;

  let chartsHtml = '';
  if (hasReports) {
    chartsHtml = `
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
                <p class="table-subtext text-xs m-0">Histórico em consolidação.</p>
              </div>
            `}
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Fatores Avaliados</h3>
            ${factorRankingList.length > 0 ? `<button type="button" class="btn btn-ghost btn-sm" data-action="toggle-chart-table" data-target="table-factors">Ver tabela</button>` : ''}
          </div>
          <div class="card-body chart-container-fixed">
            ${factorRankingList.length > 0 ? `
              <canvas id="chart-factors-canvas" role="img" aria-label="Gráfico de média dos fatores"></canvas>
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
                <p class="table-subtext text-xs m-0">Resultados consolidados disponíveis após o término da coleta.</p>
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
              <canvas id="chart-actions-canvas" role="img" aria-label="Gráfico de eficácia das ações"></canvas>
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
                  <p class="font-medium text-sm m-0">Nenhuma ação cadastrada</p>
                  <p class="table-subtext text-xs mt-1 mb-2">Transforme os achados em planos de ação preventivos.</p>
                  <a href="#acoes" class="btn btn-secondary btn-sm btn-compact">Ver Ações</a>
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
          <p class="view-subtitle">${esc(dateFormatted)} · Painel de atividades</p>
        </div>
        <div>
          ${!isViewer ? `
            <a href="#pesquisas/nova" class="btn btn-primary">
              <i class="fa-solid fa-plus" aria-hidden="true"></i> Nova Pesquisa
            </a>
          ` : ''}
        </div>
      </div>

      ${queueHtml}
      ${openSurveysSectionHtml}
      ${onboardingHtml}
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
