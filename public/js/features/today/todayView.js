/* Decision Cockpit: Hoje view — Reestruturação Executiva NR-1 */

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

    const quorumTarget = Math.max(1, Math.ceil(totalInvited * 0.7));
    const quorumRemaining = Math.max(0, quorumTarget - responsesCount);
    const hasQuorum = rate >= 0.7;

    return {
      ...s,
      totalInvited,
      responsesCount,
      participationRate: rate,
      daysRemaining,
      quorumTarget,
      quorumRemaining,
      hasQuorum
    };
  });

  const totalOpenResponses = openSurveys.reduce((sum, s) => sum + s.responsesCount, 0);
  const totalOpenInvited = openSurveys.reduce((sum, s) => sum + s.totalInvited, 0);
  const aggregateRate = totalOpenInvited > 0 ? totalOpenResponses / totalOpenInvited : 0;

  const actions = kpis.actionsSummary || kpis.actions || { total: 0, onTrack: 0, overdue: 0, needsReview: 0 };
  const pop = kpis.monitoredPopulation || kpis.population || { membersCount: 0, groupsCount: 0 };
  const membersCount = pop.membersCount ?? pop.totalMembers ?? (state.members ? state.members.length : 0);
  const groupsCount = pop.groupsCount ?? pop.totalGroups ?? (state.groups ? state.groups.filter(g => !g.isDefault).length : 0);

  // 1. Status operacional inteligente (substitui o genérico "Tudo em dia")
  let statusBannerHtml = '';
  if (queue.length > 0) {
    statusBannerHtml = `
      <div class="today-status-strip status-warning mb-6">
        <i class="fa-solid fa-triangle-exclamation status-strip-icon" aria-hidden="true"></i>
        <div class="status-strip-text">
          <strong>Atenção Necessária (${queue.length})</strong>
          <span>— Existem pontos de decisão de governança NR-1 aguardando sua intervenção operacional.</span>
        </div>
      </div>
    `;
  } else if (openSurveys.length > 0) {
    const isQuorumPending = aggregateRate < 0.7;
    statusBannerHtml = `
      <div class="today-status-strip ${isQuorumPending ? 'status-info' : 'status-success'} mb-6">
        <i class="fa-solid ${isQuorumPending ? 'fa-satellite-dish' : 'fa-circle-check'} status-strip-icon" aria-hidden="true"></i>
        <div class="status-strip-text">
          <strong>${isQuorumPending ? 'Escuta Coletiva em Andamento' : 'Quórum Mínimo NR-1 Atingido'}</strong>
          <span>— ${openSurveys.length} pesquisa(s) em coleta ativa. ${isQuorumPending ? 'Aguardando quórum de 70% para fechamento e consolidação segura no PGR.' : 'Pronto para encerramento do ciclo e geração das medidas preventivas.'}</span>
        </div>
      </div>
    `;
  } else if (actions.total > 0) {
    statusBannerHtml = `
      <div class="today-status-strip status-success mb-6">
        <i class="fa-solid fa-shield-halved status-strip-icon" aria-hidden="true"></i>
        <div class="status-strip-text">
          <strong>Governança NR-1 Regular</strong>
          <span>— Todas as medidas preventivas cadastradas estão em dia e monitoradas no PGR.</span>
        </div>
      </div>
    `;
  } else {
    statusBannerHtml = `
      <div class="today-status-strip status-info mb-6">
        <i class="fa-solid fa-circle-info status-strip-icon" aria-hidden="true"></i>
        <div class="status-strip-text">
          <strong>Aguardando Primeira Coleta</strong>
          <span>— Inicie uma escuta psicossocial para mapear os fatores de risco e alimentar o plano de ação contínuo da NR-1.</span>
        </div>
      </div>
    `;
  }

  // 2. Fila de Decisão Prioritária (quando houver itens)
  let queueHtml = '';
  if (queue.length > 0) {
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

  // 3. Escutas em Andamento (Reposicionadas para o topo da hierarquia visual)
  let openSurveysSectionHtml = '';
  if (openSurveys.length > 0) {
    openSurveysSectionHtml = `
      <section class="mb-6" aria-labelledby="open-surveys-heading">
        <div class="card">
          <div class="card-header flex items-center justify-between flex-wrap gap-2 py-3 px-4">
            <div class="flex items-center gap-2">
              <h2 id="open-surveys-heading" class="card-title text-sm font-semibold m-0 flex items-center gap-2">
                <i class="fa-solid fa-satellite-dish color-primary" aria-hidden="true"></i>
                Escuta em Andamento
              </h2>
              <span class="badge badge-primary text-xs">${openSurveys.length} ativa</span>
            </div>
            <a href="#pesquisas" class="table-subtext text-xs hover:color-primary flex items-center gap-1 font-medium">
              Ver todas as pesquisas <i class="fa-solid fa-arrow-right text-[10px]" aria-hidden="true"></i>
            </a>
          </div>
          <div class="card-body p-0">
            <div class="today-surveys-list">
              ${openSurveys.map((s, idx) => {
                const isHidden = idx >= 3;
                const pct = Math.min(100, Math.round(s.participationRate * 100));
                return `
                  <div class="today-survey-row ${isHidden ? 'survey-item-collapsible hidden' : ''}">
                    <div class="today-survey-main">
                      <div class="flex items-center gap-2 flex-wrap mb-1">
                        <a href="#pesquisas/${attr(s.id)}/distribuicao" class="today-survey-name" title="${attr(s.title)}">
                          ${esc(s.title)}
                        </a>
                        <span class="badge badge-subtle text-xs">${esc(s.model || 'Diagnóstico')}</span>
                      </div>
                      <div class="today-survey-details mb-2">
                        <span>${esc(s.cycle || 'Geral')}</span>
                        <span class="dot-separator">•</span>
                        <span class="${s.daysRemaining != null && s.daysRemaining <= 3 ? 'color-danger font-semibold' : 'color-muted'}">
                          <i class="fa-regular fa-clock" aria-hidden="true"></i>
                          ${s.daysRemaining != null ? (s.daysRemaining <= 0 ? 'Encerra hoje' : `${s.daysRemaining}d restantes`) : 'Prazo aberto'}
                        </span>
                        <span class="dot-separator">•</span>
                        ${s.hasQuorum ? `
                          <span class="badge badge-success text-xs">
                            <i class="fa-solid fa-check" aria-hidden="true"></i> Quórum atingido (70%)
                          </span>
                        ` : `
                          <span class="badge badge-warning text-xs">
                            <i class="fa-solid fa-chart-pie" aria-hidden="true"></i> Faltam ${s.quorumRemaining} resposta(s) para quórum de 70%
                          </span>
                        `}
                      </div>

                      <!-- Barra de Progresso com Marcador de Quórum NR-1 (70%) -->
                      <div class="today-quorum-bar-container" title="Adesão: ${fmtPercent(s.participationRate)} (Quórum mínimo NR-1: 70%)">
                        <div class="today-quorum-bar">
                          <div class="today-quorum-fill ${s.hasQuorum ? 'quorum-reached' : ''}" data-width="${pct}"></div>
                          <div class="today-quorum-target-line" title="Linha de quórum mínimo legal (70%)"></div>
                        </div>
                        <div class="today-quorum-legend">
                          <span>${s.responsesCount} de ${s.totalInvited} colaboradores</span>
                          <span class="today-quorum-marker-label">
                            <i class="fa-solid fa-flag text-[10px]" aria-hidden="true"></i> Meta NR-1: 70%
                          </span>
                        </div>
                      </div>
                    </div>

                    <div class="today-survey-side">
                      <div class="today-survey-metric">
                        <span class="today-survey-rate">${fmtPercent(s.participationRate)}</span>
                        <span class="today-survey-sub">taxa de adesão</span>
                      </div>
                      <a href="#pesquisas/${attr(s.id)}/distribuicao" class="btn btn-secondary btn-sm today-survey-btn" title="Acompanhar coleta e convites">
                        <i class="fa-solid fa-paper-plane text-xs mr-1" aria-hidden="true"></i> Acompanhar
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
          </div>
        </div>
      </section>
    `;
  }

  // 4. Guided onboarding para novas empresas
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

  // 5. Linha de KPIs Estratégicos (focados em Decisão e PGR)
  const kpisHtml = `
    <div class="grid grid-cols-3 gap-4 mb-6">
      <div class="kpi-card">
        <span class="kpi-title">Escutas Psicossociais</span>
        <div class="kpi-val">
          ${openSurveys.length > 0 ? `${fmtPercent(aggregateRate)}` : '0'} 
          <span class="text-xs font-normal color-muted">
            ${openSurveys.length > 0 ? 'adesão geral' : 'coletas ativas'}
          </span>
        </div>
        <div class="table-subtext mt-1">
          ${openSurveys.length > 0
            ? `${totalOpenResponses} de ${totalOpenInvited} pessoas responderam (${openSurveys.length} ativa)`
            : 'Nenhuma escuta aberta no momento'}
        </div>
        <a href="#pesquisas" class="today-kpi-footer-link">
          Gerenciar pesquisas <i class="fa-solid fa-arrow-right text-[10px]" aria-hidden="true"></i>
        </a>
      </div>

      <div class="kpi-card">
        <span class="kpi-title">Planos de Ação (NR-1 / PGR)</span>
        <div class="kpi-val">${actions.total || actions.totalActive || 0}</div>
        <div class="flex items-center gap-2 mt-1 flex-wrap">
          ${(actions.total || 0) === 0 ? `
            <span class="badge badge-neutral text-xs">
              <i class="fa-solid fa-circle-notch text-[10px]" aria-hidden="true"></i> Liberado após encerramento
            </span>
          ` : `
            <span class="badge badge-success text-xs" title="No prazo">
              <span class="status-dot dot-success" aria-hidden="true"></span> ${actions.onTrack || actions.onTime || 0} no prazo
            </span>
            ${(actions.overdue || 0) > 0 ? `
              <span class="badge badge-danger text-xs" title="Atrasadas">
                <span class="status-dot dot-danger" aria-hidden="true"></span> ${actions.overdue} atrasadas
              </span>
            ` : ''}
            ${(actions.needsReview || actions.reviewDue || 0) > 0 ? `
              <span class="badge badge-warning text-xs" title="Aguardando revisão de eficácia">
                <span class="status-dot dot-warning" aria-hidden="true"></span> ${actions.needsReview || actions.reviewDue} a revisar
              </span>
            ` : ''}
          `}
        </div>
        <a href="#acoes" class="today-kpi-footer-link">
          Abrir Kanban de Ações <i class="fa-solid fa-arrow-right text-[10px]" aria-hidden="true"></i>
        </a>
      </div>

      <div class="kpi-card">
        <span class="kpi-title">População e Cobertura</span>
        <div class="kpi-val">${membersCount}</div>
        <div class="table-subtext mt-1">
          colaboradores em ${groupsCount} grupos ativos
        </div>
        <a href="#organizacao/pessoas" class="today-kpi-footer-link">
          Base de colaboradores <i class="fa-solid fa-arrow-right text-[10px]" aria-hidden="true"></i>
        </a>
      </div>
    </div>
  `;

  // 6. Seção de Gráficos e Inteligência
  const partTrendList = Array.isArray(charts.participationTrend) ? charts.participationTrend : (charts.participationTrendData?.labels ? charts.participationTrendData.labels.map((lbl, i) => ({ cycle: lbl, rate: charts.participationTrendData.rates[i] })) : []);
  const factorRankingList = Array.isArray(charts.factorRanking) ? charts.factorRanking : (charts.factorAverages?.labels ? charts.factorAverages.labels.map((lbl, i) => ({ label: lbl, average: charts.factorAverages.values[i] })) : []);
  const hasHistoricalData = partTrendList.length > 0 || factorRankingList.length > 0 || (actions.total || 0) > 0;

  let intelligenceSectionHtml = '';
  if (hasHistoricalData) {
    intelligenceSectionHtml = `
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
                  <p class="font-medium text-sm m-0">Ciclo único em andamento</p>
                  <p class="table-subtext text-xs mt-1">A comparação temporal será ativada após a conclusão dos próximos ciclos.</p>
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
                  <p class="font-medium text-sm m-0">Aguardando encerramento</p>
                  <p class="table-subtext text-xs mt-1">As médias de cada dimensão serão consolidadas com quórum estatístico seguro após o fechamento.</p>
                </div>
              </div>
            `}
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Eficácia das Ações (PGR)</h3>
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
                  <p class="font-medium text-sm m-0">Nenhuma ação concluída</p>
                  <p class="table-subtext text-xs mt-1 mb-3">Defina e revise a eficácia das medidas preventivas no Kanban.</p>
                  <a href="#acoes" class="btn btn-secondary btn-sm">Ir para Ações</a>
                </div>
              </div>
            `}
          </div>
        </div>
      </div>
    `;
  } else {
    // Fluxo Contínuo NR-1 Educativo e Operacional (quando não há histórico consolidado)
    intelligenceSectionHtml = `
      <div class="today-workflow-card mb-6">
        <div class="flex items-center justify-between flex-wrap gap-3 mb-2">
          <div>
            <div class="today-workflow-title">
              <i class="fa-solid fa-diagram-project color-primary" aria-hidden="true"></i>
              Fluxo Contínuo de Saúde Psicossocial & PGR (NR-1)
            </div>
            <div class="today-workflow-subtitle">
              Entenda como os dados da escuta se transformam em conformidade técnica auditável pelo MTE:
            </div>
          </div>
          ${!isViewer ? `
            <a href="#acoes" class="btn btn-secondary btn-sm">
              <i class="fa-solid fa-plus mr-1" aria-hidden="true"></i> Antecipar Plano de Ação
            </a>
          ` : ''}
        </div>

        <div class="today-workflow-steps">
          <div class="today-workflow-step">
            <div class="flex items-center justify-between">
              <div class="today-workflow-step-num step-active">1</div>
              <span class="badge badge-primary text-xs">Em Andamento</span>
            </div>
            <div class="today-workflow-step-title">Escuta Coletiva Confidencial</div>
            <div class="today-workflow-step-desc">
              Respostas 100% anônimas via link único ou WhatsApp. O quórum mínimo de 70% protege a identidade individual de cada colaborador.
            </div>
          </div>

          <div class="today-workflow-step">
            <div class="flex items-center justify-between">
              <div class="today-workflow-step-num">2</div>
              <span class="badge badge-neutral text-xs">Próxima Etapa</span>
            </div>
            <div class="today-workflow-step-title">Matriz & Semáforo Psicossocial</div>
            <div class="today-workflow-step-desc">
              Após o fechamento, as dimensões (Demandas, Controle, Relacionamentos) são consolidadas em zonas Adequada, Cuidado ou Atenção.
            </div>
          </div>

          <div class="today-workflow-step">
            <div class="flex items-center justify-between">
              <div class="today-workflow-step-num">3</div>
              <span class="badge badge-neutral text-xs">Governança PGR</span>
            </div>
            <div class="today-workflow-step-title">Intervenções & Evidências no Kanban</div>
            <div class="today-workflow-step-desc">
              Geração de planos de ação preventivos com prazos, responsáveis e registro de eficácia para comprovação em auditorias.
            </div>
          </div>
        </div>
      </div>
    `;
  }

  const content = `
    <div class="today-page">
      <!-- Header refinado com hierarquia executiva -->
      <div class="today-header">
        <div>
          <div class="today-header-meta">
            <i class="fa-regular fa-calendar-check" aria-hidden="true"></i>
            <span>${esc(greeting.replace(/\.$/, ''))} · ${esc(dateFormatted)}</span>
          </div>
          <h1 class="view-title">Cockpit de Governança e Decisão NR-1</h1>
          <p class="view-subtitle">
            Acompanhamento em tempo real da saúde psicossocial, quórum amostral e gestão preventiva do PGR
          </p>
        </div>
        <div class="flex items-center gap-2">
          ${openSurveys.length > 0 ? `
            <a href="#pesquisas" class="btn btn-secondary">
              <i class="fa-solid fa-satellite-dish" aria-hidden="true"></i> Ver Escutas (${openSurveys.length})
            </a>
          ` : ''}
          ${!isViewer ? `
            <a href="#pesquisas/nova" class="btn btn-primary">
              <i class="fa-solid fa-plus" aria-hidden="true"></i> Nova Escuta
            </a>
          ` : ''}
        </div>
      </div>

      ${statusBannerHtml}
      ${queueHtml}
      ${openSurveysSectionHtml}
      ${onboardingHtml}
      ${kpisHtml}
      ${intelligenceSectionHtml}
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
