/* Hoje — Painel Inicial, Planos de Ação & Inteligência Diagnóstica */

import { renderShell } from '../../ui/shell.js';
import { esc, attr, fmt, fmtPercent, date } from '../../domain/formatters.js';
import { decisionQueueLabels, priorityLabels } from '../../domain/labels.js';

export function renderToday({ state }) {
  const isViewer = state.account?.role === 'viewer';
  const todayData = state.today;
  const queue = todayData?.queue || todayData?.decisionQueue || [];
  const kpis = todayData?.kpis || {};
  const charts = todayData?.charts || {};
  const management = state.management || {};
  const actions = management.actions || [];
  const isNewCompany = !state.members?.length && !state.surveys?.length;

  // Saudação personalizada e contextual
  const accountName = state.account?.name || '';
  const firstName = accountName.trim().split(' ')[0] || 'Gestor';
  const hour = new Date().getHours();
  const timeGreeting = hour >= 5 && hour < 12 ? 'Bom dia' : hour >= 12 && hour < 18 ? 'Boa tarde' : 'Boa noite';
  const greeting = todayData?.greeting || `${timeGreeting}, ${firstName}.`;
  const dateFormatted = todayData?.dateFormatted || new Date().toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

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
    .sort((a, b) => urgencyScore(b) - urgencyScore(a));

  const hasOpenSurveys = openSurveys.length > 0;
  const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());

  // Cálculos de Ações e Tarefas Reais
  const overdueActions = actions.filter(a => ['planned', 'in_progress'].includes(a.status) && a.dueDate && a.dueDate < todayStr);
  const reviewDueActions = actions.filter(a => a.status === 'implemented' && a.reviewDate && a.reviewDate <= todayStr);
  const activeActions = actions.filter(a => ['planned', 'in_progress', 'implemented'].includes(a.status));
  const onTrackCount = Math.max(0, activeActions.length - overdueActions.length - reviewDueActions.length);

  const totalResponses = openSurveys.reduce((acc, s) => acc + s.responsesCount, 0);
  const totalInvited = openSurveys.reduce((acc, s) => acc + s.totalInvited, 0);
  const aggregateRate = totalInvited > 0 ? totalResponses / totalInvited : 0;
  const membersCount = state.members?.length || kpis.population?.membersCount || totalInvited || 0;
  const groupsCount = state.groups?.length || kpis.population?.groupsCount || 1;
  const earliestDeadline = openSurveys.reduce((min, s) =>
    s.daysRemaining != null && (min === null || s.daysRemaining < min) ? s.daysRemaining : min, null);

  // Histórico real para gráficos (apenas com relatórios consolidados)
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
  // 1. Header de Boas-Vindas
  // ══════════════════════════════════════════════════════
  const welcomeHeaderHtml = `
    <div class="today-welcome-header">
      <div class="today-welcome-text">
        <h1 class="today-welcome-greeting">${esc(greeting)}</h1>
        <p class="today-welcome-sub">
          ${esc(dateFormatted)} · Painel de inteligência diagnóstica e planos de ação
        </p>
      </div>
      <div>
        ${!isViewer ? `
          <a href="#pesquisas/nova" class="btn btn-primary">
            <i class="fa-solid fa-plus mr-1" aria-hidden="true"></i> Nova Pesquisa
          </a>
        ` : ''}
      </div>
    </div>
  `;

  // ══════════════════════════════════════════════════════
  // 2. Faixa de Status Situacional da Operação
  // ══════════════════════════════════════════════════════
  let statusStripHtml = '';
  if (overdueActions.length > 0) {
    statusStripHtml = `
      <div class="today-status-strip card-warning-edge mb-5">
        <i class="fa-solid fa-clock color-danger status-strip-icon" aria-hidden="true"></i>
        <div class="status-strip-text">
          <strong>Atenção ao cronograma</strong>
          <span>— ${overdueActions.length} ${overdueActions.length === 1 ? 'medida preventiva está atrasada' : 'medidas preventivas estão atrasadas'} no plano de ação.</span>
        </div>
      </div>
    `;
  } else if (hasOpenSurveys) {
    const noRespCount = openSurveys.filter(s => s.responsesCount === 0).length;
    if (noRespCount > 0) {
      statusStripHtml = `
        <div class="today-status-strip mb-5">
          <i class="fa-solid fa-paper-plane color-primary status-strip-icon" aria-hidden="true"></i>
          <div class="status-strip-text">
            <strong>Coletas ativas em campo</strong>
            <span>— ${noRespCount} ${noRespCount === 1 ? 'pesquisa ainda não recebeu respostas' : 'pesquisas ainda não receberam respostas'}. Dispare os convites para compor a base amostral.</span>
          </div>
        </div>
      `;
    } else {
      statusStripHtml = `
        <div class="today-status-strip mb-5">
          <i class="fa-solid fa-circle-check color-success status-strip-icon" aria-hidden="true"></i>
          <div class="status-strip-text">
            <strong>Operação em andamento</strong>
            <span>— Coletas recebendo respostas e planos de ação monitorados no cronograma.</span>
          </div>
        </div>
      `;
    }
  }

  // ══════════════════════════════════════════════════════
  // 3. Três Cards de Pulso Operacional
  // ══════════════════════════════════════════════════════
  const overviewCardsHtml = `
    <div class="grid grid-cols-3 gap-4 mb-6">
      <div class="kpi-card">
        <p class="kpi-title">Coletas em Campo</p>
        <p class="kpi-val">${openSurveys.length} ${openSurveys.length === 1 ? 'ativa' : 'ativas'}</p>
        <p class="kpi-sub">
          ${totalResponses} de ${totalInvited} respostas (${fmtPercent(aggregateRate)} de adesão)
        </p>
        <div class="mt-2 pt-2 border-t border-border">
          <span class="table-subtext text-xs">
            <i class="fa-regular fa-clock mr-1" aria-hidden="true"></i>
            ${earliestDeadline != null ? (earliestDeadline <= 0 ? 'Encerra hoje' : `${earliestDeadline}d restantes no ciclo`) : 'Prazo aberto'}
          </span>
        </div>
      </div>

      <div class="kpi-card">
        <p class="kpi-title">Colaboradores Mapeados</p>
        <p class="kpi-val">${membersCount}</p>
        <p class="kpi-sub">
          Distribuídos em ${groupsCount} ${groupsCount === 1 ? 'setor ativo' : 'setores ativos'}
        </p>
        <div class="mt-2 pt-2 border-t border-border">
          <a href="#organizacao/pessoas" class="table-subtext text-xs hover:color-primary">
            Gerenciar colaboradores →
          </a>
        </div>
      </div>

      <div class="kpi-card">
        <p class="kpi-title">Planos de Ação (NR-1)</p>
        <p class="kpi-val">${actions.length}</p>
        <p class="kpi-sub">
          ${actions.length > 0
            ? `${onTrackCount} no prazo · ${overdueActions.length} em atraso`
            : 'Aguardando encerramento do ciclo para novas recomendações'}
        </p>
        <div class="mt-2 pt-2 border-t border-border">
          <a href="#acoes" class="table-subtext text-xs hover:color-primary">
            Ver painel de ações →
          </a>
        </div>
      </div>
    </div>
  `;

  // ══════════════════════════════════════════════════════
  // 4. Fila de Decisões e Pendências
  // ══════════════════════════════════════════════════════
  let queueHtml = '';
  if (queue.length > 0) {
    queueHtml = `
      <section class="mb-5" aria-labelledby="queue-heading">
        <div class="flex items-center gap-2 mb-3">
          <i class="fa-solid fa-bell color-primary" aria-hidden="true"></i>
          <h2 id="queue-heading" class="font-semibold text-sm m-0">Ações que Exigem Atenção (${queue.length})</h2>
        </div>
        <div class="flex flex-col gap-3">
          ${queue.map(item => renderQueueItem(item, isViewer)).join('')}
        </div>
      </section>
    `;
  }

  // ══════════════════════════════════════════════════════
  // 5. Coluna Principal: Coletas, Tarefas e Inteligência
  // ══════════════════════════════════════════════════════
  let mainHtml = '';

  if (hasOpenSurveys) {
    // 5.1 Tabela de Coletas em Andamento
    const surveysTableCardHtml = `
      <div class="card mb-6">
        <div class="card-header py-3 px-4 flex items-center justify-between">
          <div class="flex items-center gap-2">
            <h2 class="card-title text-sm font-semibold m-0">Coletas em andamento</h2>
            <span class="badge badge-primary">${openSurveys.length} ${openSurveys.length === 1 ? 'ativa' : 'ativas'}</span>
          </div>
          <span class="table-subtext text-xs">
            Acompanhe o retorno e a adesão de cada setor
          </span>
        </div>
        <div class="card-body p-0">
          <div class="table-wrap table-borderless">
            <table class="table">
              <thead>
                <tr>
                  <th>Pesquisa</th>
                  <th>Setor / Grupo</th>
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
                          <i class="fa-regular fa-clock mr-1" aria-hidden="true"></i>
                          ${s.daysRemaining != null
                            ? (s.daysRemaining <= 0 ? 'Encerra hoje' : `${s.daysRemaining}d restantes`)
                            : 'Prazo aberto'}
                        </span>
                      </td>
                      <td>
                        <span class="font-semibold text-xs ${s.participationRate < 0.3 && s.totalInvited > 0 ? 'color-danger' : ''}">
                          ${fmtPercent(s.participationRate)}
                        </span>
                        <span class="color-muted text-xs ml-1">(${s.responsesCount} de ${s.totalInvited})</span>
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

    // 5.2 Espaço em Evidência: Planos de Ação e Tarefas
    const activeTasks = actions.filter(a => ['planned', 'in_progress', 'implemented'].includes(a.status));
    let actionsSectionHtml = '';

    if (activeTasks.length > 0) {
      actionsSectionHtml = `
        <div class="card mb-6">
          <div class="card-header py-3 px-4 flex items-center justify-between">
            <div class="flex items-center gap-2">
              <h2 class="card-title text-sm font-semibold m-0">
                <i class="fa-solid fa-list-check color-primary mr-1" aria-hidden="true"></i>
                Planos de Ação & Tarefas em Execução
              </h2>
              <span class="badge badge-primary">${activeTasks.length} ${activeTasks.length === 1 ? 'tarefa' : 'tarefas'}</span>
            </div>
            <a href="#acoes" class="btn btn-ghost btn-sm text-xs font-medium">
              Ver Kanban Completo →
            </a>
          </div>
          <div class="card-body p-0">
            <div class="today-tasks-list">
              ${activeTasks.slice(0, 5).map(a => {
                const isOverdue = a.dueDate && a.dueDate < todayStr && ['planned', 'in_progress'].includes(a.status);
                const isReviewDue = a.status === 'implemented' && a.reviewDate && a.reviewDate <= todayStr;
                const statusBadgeClass = isOverdue ? 'badge-danger'
                  : isReviewDue ? 'badge-warning'
                  : a.status === 'in_progress' ? 'badge-primary'
                  : 'badge-neutral';
                const statusLabel = isOverdue ? 'Atrasada'
                  : isReviewDue ? 'Revisar eficácia'
                  : a.status === 'in_progress' ? 'Em execução'
                  : 'Planejada';

                return `
                  <div class="today-task-row">
                    <div class="today-task-main">
                      <div class="today-task-title-wrap">
                        <span class="badge ${statusBadgeClass} text-xs">${esc(statusLabel)}</span>
                        <a href="#acoes" class="today-task-title hover:color-primary">
                          ${esc(a.title)}
                        </a>
                      </div>
                      <div class="today-task-meta">
                        <span><i class="fa-solid fa-tag text-[10px] mr-1" aria-hidden="true"></i> ${esc(a.factor || 'Geral')}</span>
                        <span><i class="fa-solid fa-user-tie text-[10px] mr-1" aria-hidden="true"></i> ${esc(a.owner || a.responsible || 'Responsável não atribuído')}</span>
                        ${a.dueDate ? `
                          <span class="${isOverdue ? 'color-danger font-medium' : ''}">
                            <i class="fa-regular fa-calendar text-[10px] mr-1" aria-hidden="true"></i>
                            Prazo: ${date(a.dueDate)}
                          </span>
                        ` : ''}
                      </div>
                    </div>
                    <div class="today-task-side">
                      <a href="#acoes" class="btn btn-secondary btn-sm btn-compact">
                        Gerenciar
                      </a>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
            ${activeTasks.length > 5 ? `
              <div class="p-2 text-center border-t border-border">
                <a href="#acoes" class="btn btn-ghost btn-sm text-xs">
                  Ver todas as ${activeTasks.length} tarefas no Kanban →
                </a>
              </div>
            ` : ''}
          </div>
        </div>
      `;
    } else {
      actionsSectionHtml = `
        <div class="card mb-6">
          <div class="card-header py-3 px-4 flex items-center justify-between">
            <h2 class="card-title text-sm font-semibold m-0">
              <i class="fa-solid fa-list-check color-primary mr-1" aria-hidden="true"></i>
              Planos de Ação & Soluções Preventivas
            </h2>
            <a href="#acoes" class="btn btn-secondary btn-sm btn-compact">
              <i class="fa-solid fa-plus mr-1" aria-hidden="true"></i> Criar Plano Manual
            </a>
          </div>
          <div class="card-body p-4">
            <p class="text-sm font-semibold color-text-primary m-0 mb-1">
              Geração de Soluções com Base nas Escutas
            </p>
            <p class="color-text-secondary text-xs m-0 mb-3">
              O algoritmo do Equilibra analisa as respostas dos colaboradores por dimensão de risco (exigências psicológicas, relações, autonomia e segurança psicológica). Ao encerrar as coletas, o sistema cruza os fatores críticos e sugere automaticamente medidas preventivas estruturadas para o PGR.
            </p>
            <div class="flex items-center gap-2">
              <a href="#acoes" class="btn btn-secondary btn-sm">
                <i class="fa-solid fa-plus mr-1" aria-hidden="true"></i> Cadastrar Ação Preventiva
              </a>
              <a href="#resultados/ciclos" class="btn btn-ghost btn-sm text-xs">
                Consultar Relatórios Anteriores →
              </a>
            </div>
          </div>
        </div>
      `;
    }

    // 5.3 Espaço em Evidência: Inteligência Diagnóstica e Ciclo de Eficácia
    const intelligenceSectionHtml = `
      <div class="today-intelligence-card mb-6">
        <div class="today-intelligence-header">
          <h2 class="today-intelligence-title">
            <i class="fa-solid fa-brain color-primary" aria-hidden="true"></i>
            Inteligência Analítica & Ciclo de Eficácia Contínua
          </h2>
          <span class="badge badge-primary text-xs">Monitoramento Contínuo</span>
        </div>
        <p class="color-text-secondary text-xs m-0">
          Como a plataforma transforma escuta em intervenção e comprova se as soluções funcionaram ao longo dos ciclos:
        </p>
        <div class="today-intelligence-flow">
          <div class="today-flow-step">
            <span class="today-flow-step-num">Passo 1</span>
            <p class="today-flow-step-title">Diagnóstico por Dimensão</p>
            <p class="today-flow-step-desc">
              O algoritmo quantifica fatores de risco psicossocial por setor e destaca desvios em relação às referências técnicas.
            </p>
          </div>
          <div class="today-flow-step">
            <span class="today-flow-step-num">Passo 2</span>
            <p class="today-flow-step-title">Devolutiva & Plano de Ação</p>
            <p class="today-flow-step-desc">
              Sugestões assertivas de medidas de controle vinculadas a responsáveis e prazos para alimentar diretamente o PGR.
            </p>
          </div>
          <div class="today-flow-step">
            <span class="today-flow-step-num">Passo 3</span>
            <p class="today-flow-step-title">Medição de Eficácia (Antes vs. Depois)</p>
            <p class="today-flow-step-desc">
              Nos ciclos subsequentes, o sistema detecta se a intervenção melhorou o fator. Ações eficazes são validadas; as demais são sinalizadas para ajuste.
            </p>
          </div>
        </div>
      </div>
    `;

    mainHtml = surveysTableCardHtml + actionsSectionHtml + intelligenceSectionHtml;
  } else if (isNewCompany) {
    mainHtml = renderOnboarding();
  } else {
    mainHtml = `
      <div class="card mb-6">
        <div class="today-empty-cta">
          <div class="today-empty-cta-icon">
            <i class="fa-regular fa-clipboard" aria-hidden="true"></i>
          </div>
          <div>
            <p class="font-semibold text-sm m-0">Nenhuma coleta em andamento</p>
            <p class="color-text-secondary text-xs mt-1 mb-0">Abra uma nova pesquisa para iniciar a escuta periódica com seus colaboradores.</p>
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
  // 6. Coluna Lateral (Sidebar): Diagnóstico Imediato + Resumo
  // ══════════════════════════════════════════════════════
  let situacaoCard = '';
  if (hasOpenSurveys) {
    const noResponseSurveys = openSurveys.filter(s => s.responsesCount === 0);
    const closingSoonLow = openSurveys.filter(s =>
      s.daysRemaining != null && s.daysRemaining <= 7 && s.participationRate < 0.5 && s.responsesCount > 0
    );
    const mostUrgent = openSurveys[0];

    if (noResponseSurveys.length > 0) {
      const count = noResponseSurveys.length;
      const target = noResponseSurveys[0];
      const shortTitle = target.title.length > 44 ? target.title.slice(0, 44) + '…' : target.title;
      situacaoCard = `
        <div class="today-sidebar-card today-sidebar-card-alert">
          <p class="today-sidebar-card-title">
            ${count === 1 ? 'Sem nenhuma resposta' : `${count} pesquisas sem resposta`}
          </p>
          <p class="text-sm font-semibold mb-3" title="${attr(target.title)}">
            ${esc(shortTitle)}
          </p>
          <a href="#pesquisas/${attr(target.id)}/distribuicao"
             class="btn btn-primary btn-sm w-full text-center">
            <i class="fa-solid fa-paper-plane mr-1" aria-hidden="true"></i>
            Disparar convites
          </a>
          ${count > 1 ? `
            <div class="mt-3">
              ${noResponseSurveys.slice(1).map(s => `
                <a href="#pesquisas/${attr(s.id)}/distribuicao"
                   class="today-sidebar-other-survey"
                   title="${attr(s.title)}">
                  <i class="fa-solid fa-arrow-right text-[10px]" aria-hidden="true"></i>
                  ${esc(s.title.length > 36 ? s.title.slice(0, 36) + '…' : s.title)}
                </a>
              `).join('')}
            </div>
          ` : ''}
        </div>
      `;
    } else if (closingSoonLow.length > 0) {
      const target = closingSoonLow[0];
      const shortTitle = target.title.length > 44 ? target.title.slice(0, 44) + '…' : target.title;
      const daysLabel = target.daysRemaining != null
        ? (target.daysRemaining <= 0 ? 'Encerra hoje' : `Encerra em ${target.daysRemaining}d`)
        : 'Encerra em breve';
      situacaoCard = `
        <div class="today-sidebar-card today-sidebar-card-warn">
          <p class="today-sidebar-card-title">Adesão baixa — prazo próximo</p>
          <p class="text-sm font-semibold mb-1" title="${attr(target.title)}">
            ${esc(shortTitle)}
          </p>
          <p class="color-text-secondary text-xs mb-3">
            ${esc(daysLabel)} · ${fmtPercent(target.participationRate)} de adesão
          </p>
          <div class="flex flex-col gap-2">
            ${!isViewer ? `
              <button type="button"
                      class="btn btn-secondary btn-sm"
                      data-action="copy-survey-url"
                      data-url="${attr(`${window.location.origin}/responder/${target.id}`)}">
                <i class="fa-regular fa-copy mr-1" aria-hidden="true"></i>
                Copiar link para compartilhar
              </button>
            ` : ''}
            <a href="#pesquisas/${attr(target.id)}/distribuicao" class="btn btn-secondary btn-sm">
              <i class="fa-solid fa-paper-plane mr-1" aria-hidden="true"></i>
              Disparar convites
            </a>
          </div>
        </div>
      `;
    } else {
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

  // Card de Resumo de Governança NR-1 (Ações & Eficácia Real)
  const actionsSummaryCard = `
    <div class="today-sidebar-card">
      <p class="today-sidebar-card-title">Governança & Planos (NR-1)</p>
      <div class="today-sidebar-stat mb-3">
        <span class="today-sidebar-stat-number">${actions.length}</span>
        <span class="today-sidebar-stat-label">${actions.length === 1 ? 'medida registrada' : 'medidas registradas'}</span>
      </div>
      <div class="today-sidebar-row">
        <span class="today-sidebar-row-label">Em execução no prazo</span>
        <span class="today-sidebar-row-value color-success">${onTrackCount}</span>
      </div>
      <div class="today-sidebar-row">
        <span class="today-sidebar-row-label">Medidas em atraso</span>
        <span class="today-sidebar-row-value ${overdueActions.length > 0 ? 'color-danger' : ''}">${overdueActions.length}</span>
      </div>
      <div class="today-sidebar-row">
        <span class="today-sidebar-row-label">Aguardando aferição de eficácia</span>
        <span class="today-sidebar-row-value ${reviewDueActions.length > 0 ? 'color-warning' : ''}">${reviewDueActions.length}</span>
      </div>
      <div class="mt-3 pt-2 border-t border-border">
        <a href="#acoes" class="btn btn-secondary btn-sm w-full text-center">
          <i class="fa-solid fa-table-columns mr-1" aria-hidden="true"></i> Abrir Kanban de Ações
        </a>
      </div>
    </div>
  `;

  const sidebarHtml = `
    <aside class="today-sidebar">
      ${situacaoCard}
      ${actionsSummaryCard}
    </aside>
  `;

  const layoutHtml = `
    <div class="today-layout">
      <div class="today-main">${mainHtml}</div>
      ${sidebarHtml}
    </div>
  `;

  // ══════════════════════════════════════════════════════
  // 7. Gráficos Históricos (apenas se houver dados reais)
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
      ${welcomeHeaderHtml}
      ${statusStripHtml}
      ${overviewCardsHtml}
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

function urgencyScore(s) {
  let score = 0;
  if (s.responsesCount === 0) score += 100;
  if (s.daysRemaining != null && s.daysRemaining <= 7) score += (7 - s.daysRemaining) * 5;
  if (s.participationRate < 0.3) score += 30;
  else if (s.participationRate < 0.5) score += 15;
  return score;
}

function renderOnboarding() {
  return `
    <div class="card">
      <div class="card-header">
        <h2 class="card-title">
          <i class="fa-solid fa-compass color-primary" aria-hidden="true"></i> Primeiros passos no Equilibra
        </h2>
      </div>
      <div class="card-body">
        <p class="color-text-secondary text-sm mb-4">
          Complete as etapas abaixo para conduzir a primeira pesquisa de saúde psicossocial com seus colaboradores:
        </p>
        <div class="grid grid-cols-4 gap-4">
          <div class="card p-4">
            <strong class="text-sm">1. Colaboradores</strong>
            <p class="color-text-secondary text-xs my-2">Importe por planilha ou adicione manualmente.</p>
            <a href="#organizacao/pessoas" class="btn btn-secondary btn-sm">Cadastrar</a>
          </div>
          <div class="card p-4">
            <strong class="text-sm">2. Grupos</strong>
            <p class="color-text-secondary text-xs my-2">Defina os setores ou áreas da empresa.</p>
            <a href="#organizacao/grupos" class="btn btn-secondary btn-sm">Criar grupos</a>
          </div>
          <div class="card p-4">
            <strong class="text-sm">3. Pesquisa</strong>
            <p class="color-text-secondary text-xs my-2">Escolha o modelo de questionário validado.</p>
            <a href="#pesquisas/nova" class="btn btn-secondary btn-sm">Nova pesquisa</a>
          </div>
          <div class="card p-4">
            <strong class="text-sm">4. Resultados</strong>
            <p class="color-text-secondary text-xs my-2">Relatórios consolidados e planos de ação.</p>
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
