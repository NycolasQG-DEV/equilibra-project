/* Action Plans and Assessments feature (NR-1 / PGR) — Kanban Board View */

import { renderShell } from '../../ui/shell.js';
import { esc, attr, date, actionStatusBadge } from '../../domain/formatters.js';
import { post, put } from '../../core/api.js';
import { store } from '../../core/store.js';
import { openDialog, closeDialog } from '../../ui/dialog.js';
import { showToast } from '../../ui/toast.js';
import { field, textarea, select } from '../../ui/fields.js';
import { router } from '../../core/router.js';

/* ── Kanban column definitions (order = workflow order) ── */
const KANBAN_COLS = [
  {
    key: 'planned',
    label: 'Planejada',
    icon: 'fa-solid fa-clock',
    colorClass: 'kanban-col-planned',
    headerClass: 'kanban-header-planned'
  },
  {
    key: 'in_progress',
    label: 'Em Execução',
    icon: 'fa-solid fa-spinner',
    colorClass: 'kanban-col-inprogress',
    headerClass: 'kanban-header-inprogress'
  },
  {
    key: 'implemented',
    label: 'Implementada',
    icon: 'fa-solid fa-check-circle',
    colorClass: 'kanban-col-implemented',
    headerClass: 'kanban-header-implemented'
  },
  {
    key: 'effective',
    label: 'Eficaz',
    icon: 'fa-solid fa-circle-check',
    colorClass: 'kanban-col-effective',
    headerClass: 'kanban-header-effective'
  },
  {
    key: 'ineffective',
    label: 'Não Eficaz',
    icon: 'fa-solid fa-circle-xmark',
    colorClass: 'kanban-col-ineffective',
    headerClass: 'kanban-header-ineffective'
  },
  {
    key: 'cancelled',
    label: 'Cancelada',
    icon: 'fa-solid fa-ban',
    colorClass: 'kanban-col-cancelled',
    headerClass: 'kanban-header-cancelled'
  }
];

/* ── Factor CSS class map for dot indicators ── */
const FACTOR_DOT_CLASS = {
  'Geral': 'kfd-geral',
  'Demandas': 'kfd-demandas',
  'Controle': 'kfd-controle',
  'Apoio da gestão': 'kfd-apoio-gestao',
  'Apoio dos colegas': 'kfd-apoio-colegas',
  'Relações': 'kfd-relacoes',
  'Papel': 'kfd-papel',
  'Mudanças': 'kfd-mudancas'
};

function factorDot(factor) {
  const cls = FACTOR_DOT_CLASS[factor] || 'kfd-geral';
  return `<span class="kanban-factor-dot ${cls}" title="${esc(factor)}"></span>`;
}

function renderKanbanCard(a, assessments, todayStr, isViewer) {
  const ass = assessments.find(x => x.id === a.assessmentId);
  const isOverdue = ['planned', 'in_progress'].includes(a.status) && a.dueDate < todayStr;
  const isReviewDue = a.status === 'implemented' && a.reviewDate <= todayStr;
  const factorLabel = ass?.factor || a.factor || 'Geral';
  const ownerLabel = a.owner || a.responsible || '—';
  const priorityIcon = a.priority === 'high'
    ? '<i class="fa-solid fa-arrow-up kanban-priority-high" title="Alta prioridade"></i>'
    : a.priority === 'low'
      ? '<i class="fa-solid fa-arrow-down kanban-priority-low" title="Baixa prioridade"></i>'
      : '';

  const overdueTag = isOverdue
    ? `<span class="kanban-alert-tag kanban-alert-overdue"><i class="fa-solid fa-clock" aria-hidden="true"></i> Atrasada</span>`
    : '';
  const reviewTag = isReviewDue
    ? `<span class="kanban-alert-tag kanban-alert-review"><i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i> Revisar eficácia</span>`
    : '';

  const edgeClass = isOverdue ? ' kanban-card-overdue' : (isReviewDue ? ' kanban-card-review' : '');

  return `
    <div class="kanban-card${edgeClass}" data-action-id="${attr(a.id)}">
      <div class="kanban-card-top">
        <div class="kanban-card-meta">
          ${factorDot(factorLabel)}
          <span class="kanban-card-factor">${esc(factorLabel)}</span>
          ${priorityIcon}
        </div>
        ${!isViewer ? `
          <button type="button" class="kanban-card-menu btn btn-ghost btn-sm" data-action="edit-action" data-id="${attr(a.id)}" title="Editar / Revisar">
            <i class="fa-solid fa-ellipsis" aria-hidden="true"></i>
          </button>
        ` : ''}
      </div>
      <div class="kanban-card-title">${esc(a.title)}</div>
      ${a.description ? `<div class="kanban-card-desc">${esc(a.description)}</div>` : ''}
      <div class="kanban-card-footer">
        <div class="kanban-card-owner">
          <i class="fa-solid fa-user-tie" aria-hidden="true"></i>
          <span>${esc(ownerLabel)}</span>
        </div>
        <div class="kanban-card-dates">
          ${overdueTag || reviewTag || `<span class="kanban-card-due ${isOverdue ? 'kanban-due-late' : ''}"><i class="fa-regular fa-calendar" aria-hidden="true"></i> ${date(a.dueDate)}</span>`}
        </div>
      </div>
    </div>
  `;
}

export function renderActionsList({ state }) {
  const management = state.management || {};
  const actions = management.actions || [];
  const assessments = management.assessments || [];
  const isViewer = state.account?.role === 'viewer';

  const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
  const overdueCount = actions.filter(a => ['planned', 'in_progress'].includes(a.status) && a.dueDate < todayStr).length;
  const reviewCount = actions.filter(a => a.status === 'implemented' && a.reviewDate <= todayStr).length;
  const doneCount = actions.filter(a => ['effective', 'cancelled', 'ineffective'].includes(a.status)).length;
  const inFlightCount = actions.filter(a => ['planned', 'in_progress', 'implemented'].includes(a.status)).length;

  /* Only show "done" columns when they have cards */
  const activeCols = KANBAN_COLS.filter(col => {
    const hasCards = actions.some(a => a.status === col.key);
    if (['planned', 'in_progress', 'implemented'].includes(col.key)) return true;
    return hasCards;
  });

  const colsHtml = activeCols.map(col => {
    const colActions = actions.filter(a => a.status === col.key);
    const colCards = colActions.length > 0
      ? colActions.map(a => renderKanbanCard(a, assessments, todayStr, isViewer)).join('')
      : `<div class="kanban-col-empty">
           <i class="fa-regular fa-circle-dot" aria-hidden="true"></i>
           <span>Nenhuma ação aqui</span>
         </div>`;

    return `
      <div class="kanban-col ${col.colorClass}" data-col-key="${col.key}">
        <div class="kanban-col-header ${col.headerClass}">
          <div class="kanban-col-header-left">
            <i class="${col.icon}" aria-hidden="true"></i>
            <span class="kanban-col-label">${col.label}</span>
          </div>
          <span class="kanban-col-count">${colActions.length}</span>
        </div>
        <div class="kanban-col-body">
          ${colCards}
        </div>
      </div>
    `;
  }).join('');

  const content = `
    <div class="actions-page">
      <!-- Page Header -->
      <div class="actions-page-header">
        <div>
          <h1 class="view-title">Planos de Ação e Intervenções</h1>
          <p class="view-subtitle">Gestão visual de medidas preventivas psicossociais — NR-1 / PGR</p>
        </div>
        <div class="actions-page-controls">
          ${!isViewer ? `
            <button type="button" class="btn btn-primary" data-action="open-add-action-modal">
              <i class="fa-solid fa-plus" aria-hidden="true"></i> Nova Ação
            </button>
          ` : ''}
        </div>
      </div>

      <!-- KPI Strip -->
      <div class="actions-kpi-strip">
        <div class="actions-kpi-item">
          <div class="actions-kpi-val">${actions.length}</div>
          <div class="actions-kpi-label">Total de ações</div>
        </div>
        <div class="actions-kpi-sep"></div>
        <div class="actions-kpi-item">
          <div class="actions-kpi-val ${inFlightCount > 0 ? '' : 'actions-kpi-muted'}">${inFlightCount}</div>
          <div class="actions-kpi-label">Em andamento</div>
        </div>
        <div class="actions-kpi-sep"></div>
        <div class="actions-kpi-item">
          <div class="actions-kpi-val ${overdueCount > 0 ? 'actions-kpi-danger' : 'actions-kpi-muted'}">${overdueCount}</div>
          <div class="actions-kpi-label">Em atraso</div>
        </div>
        <div class="actions-kpi-sep"></div>
        <div class="actions-kpi-item">
          <div class="actions-kpi-val ${reviewCount > 0 ? 'actions-kpi-warning' : 'actions-kpi-muted'}">${reviewCount}</div>
          <div class="actions-kpi-label">Aguardam revisão</div>
        </div>
        <div class="actions-kpi-sep"></div>
        <div class="actions-kpi-item">
          <div class="actions-kpi-val ${doneCount > 0 ? 'actions-kpi-success' : 'actions-kpi-muted'}">${doneCount}</div>
          <div class="actions-kpi-label">Concluídas</div>
        </div>
      </div>

      <!-- Filter Bar -->
      <div class="actions-filter-bar">
        <div class="actions-filter-search">
          <i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i>
          <input
            type="search"
            id="kanban-search"
            class="actions-search-input"
            placeholder="Buscar por título, responsável ou fator…"
            autocomplete="off"
          />
        </div>
        <div class="actions-filter-factors">
          <button type="button" class="kanban-filter-btn active" data-filter-factor="all">Todos</button>
          <button type="button" class="kanban-filter-btn" data-filter-factor="Demandas">Demandas</button>
          <button type="button" class="kanban-filter-btn" data-filter-factor="Controle">Controle</button>
          <button type="button" class="kanban-filter-btn" data-filter-factor="Apoio da gestão">Apoio Gestão</button>
          <button type="button" class="kanban-filter-btn" data-filter-factor="Relações">Relações</button>
          <button type="button" class="kanban-filter-btn" data-filter-factor="Papel">Papel</button>
          <button type="button" class="kanban-filter-btn" data-filter-factor="Mudanças">Mudanças</button>
          <button type="button" class="kanban-filter-btn" data-filter-factor="Geral">Geral</button>
        </div>
      </div>

      <!-- Kanban Board -->
      <div class="kanban-board" id="kanban-board">
        ${actions.length === 0 ? `
          <div class="kanban-empty-state">
            <div class="kanban-empty-icon">
              <i class="fa-solid fa-clipboard-list" aria-hidden="true"></i>
            </div>
            <div class="kanban-empty-title">Nenhuma ação preventiva cadastrada</div>
            <div class="kanban-empty-desc">
              Transforme os achados das pesquisas em medidas preventivas concretas vinculadas ao PGR (NR-1).
            </div>
            ${!isViewer ? `
              <button type="button" class="btn btn-primary" data-action="open-add-action-modal">
                <i class="fa-solid fa-plus" aria-hidden="true"></i> Criar primeira ação
              </button>
            ` : ''}
          </div>
        ` : colsHtml}
      </div>
    </div>
  `;

  const html = renderShell({
    activePath: 'acoes',
    breadcrumbs: [{ label: 'Planos de Ação' }],
    content,
    state
  });

  /* Wire up filter interactivity after render */
  requestAnimationFrame(() => {
    _wireKanbanFilters();
  });

  return html;
}

/* ── Kanban filter / search logic (pure DOM, no re-render) ── */
function _wireKanbanFilters() {
  const searchInput = document.getElementById('kanban-search');
  const filterBtns = document.querySelectorAll('[data-filter-factor]');
  let activeFactor = 'all';
  let searchTerm = '';

  function applyFilters() {
    const cards = document.querySelectorAll('.kanban-card');
    cards.forEach(card => {
      const title = card.querySelector('.kanban-card-title')?.textContent?.toLowerCase() || '';
      const owner = card.querySelector('.kanban-card-owner')?.textContent?.toLowerCase() || '';
      const factor = card.querySelector('.kanban-card-factor')?.textContent || '';
      const desc = card.querySelector('.kanban-card-desc')?.textContent?.toLowerCase() || '';

      const matchesFactor = activeFactor === 'all' || factor === activeFactor;
      const matchesSearch = !searchTerm || title.includes(searchTerm) || owner.includes(searchTerm) || factor.toLowerCase().includes(searchTerm) || desc.includes(searchTerm);

      card.style.display = (matchesFactor && matchesSearch) ? '' : 'none';
    });

    /* Update column empty states */
    document.querySelectorAll('.kanban-col').forEach(col => {
      const visibleCards = col.querySelectorAll('.kanban-card:not([style*="display: none"])');
      let emptyEl = col.querySelector('.kanban-col-empty-filtered');
      if (visibleCards.length === 0) {
        if (!emptyEl) {
          emptyEl = document.createElement('div');
          emptyEl.className = 'kanban-col-empty kanban-col-empty-filtered';
          emptyEl.innerHTML = '<i class="fa-regular fa-circle-dot" aria-hidden="true"></i><span>Sem resultados</span>';
          col.querySelector('.kanban-col-body')?.appendChild(emptyEl);
        }
      } else {
        emptyEl?.remove();
      }
    });
  }

  if (searchInput) {
    searchInput.addEventListener('input', e => {
      searchTerm = e.target.value.toLowerCase().trim();
      applyFilters();
    });
  }

  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeFactor = btn.dataset.filterFactor;
      applyFilters();
    });
  });
}

/* ── Add Action Modal ── */
export function openAddActionModal(initial = {}) {
  const reports = store.state.reports || [];
  const factorOptions = [
    { value: 'Geral', label: 'Geral / Múltiplos Fatores' },
    { value: 'Demandas', label: 'Demandas e Ritmo de Trabalho' },
    { value: 'Controle', label: 'Autonomia e Controle' },
    { value: 'Apoio da gestão', label: 'Apoio da Gestão e Liderança' },
    { value: 'Apoio dos colegas', label: 'Apoio dos Colegas e Cooperação' },
    { value: 'Relações', label: 'Relações Interpessoais e Respeito' },
    { value: 'Papel', label: 'Clareza de Papel' },
    { value: 'Mudanças', label: 'Gestão de Mudanças' }
  ];

  const reportOptions = reports.length > 0 ? reports.map(r => ({
    value: r.id,
    label: `${r.title} (${r.cycle || 'Geral'})`
  })) : [{ value: '', label: 'Nenhum relatório disponível' }];

  const content = `
    <form id="add-action-form">
      ${reports.length > 0 ? select({
        id: 'act-report',
        name: 'reportId',
        label: 'Relatório / Ciclo de Origem',
        options: reportOptions,
        selected: reports[0]?.id,
        required: true
      }) : `
        <div class="privacy-note privacy-warning mb-3">
          <i class="fa-solid fa-circle-info" aria-hidden="true"></i>
          <div>Recomenda-se gerar ao menos um ciclo de pesquisa para vincular ações ao PGR/NR-1.</div>
        </div>
      `}
      ${field({ id: 'act-title', name: 'title', label: 'Título da ação preventiva', required: true, value: initial.title || '', placeholder: 'ex: Treinamento de liderança preventiva em SST' })}
      ${select({ id: 'act-factor', name: 'factor', label: 'Fator psicossocial associado', options: factorOptions, selected: initial.factor || 'Geral', required: true })}
      ${field({ id: 'act-resp', name: 'responsible', label: 'Responsável pela execução', required: true, value: initial.responsible || '', placeholder: 'ex: Equipe de RH / Gestor Operacional' })}
      <div class="grid grid-cols-2 gap-3">
        ${field({ id: 'act-due', name: 'dueDate', label: 'Prazo de conclusão', type: 'date', value: initial.dueDate || '', required: true })}
        ${field({ id: 'act-rev', name: 'reviewDate', label: 'Data de revisão de eficácia', type: 'date', value: initial.reviewDate || '', required: true })}
      </div>
      ${textarea({ id: 'act-desc', name: 'description', label: 'Descrição detalhada e evidências esperadas', value: initial.description || '', rows: 3 })}
    </form>
  `;

  const footer = `
    <button type="button" class="btn btn-secondary" data-action="close-dialog">Cancelar</button>
    <button type="button" class="btn btn-primary" data-action="submit-add-action">Cadastrar Ação</button>
  `;

  openDialog({ title: 'Nova Ação Preventiva (NR-1)', content, footer });
}

export async function submitAddAction() {
  const form = document.getElementById('add-action-form');
  if (!form) return;

  const reportId = form.reportId?.value;
  const title = form.title.value.trim();
  const factor = form.factor.value;
  const responsible = form.responsible.value.trim();
  const dueDate = form.dueDate.value;
  const reviewDate = form.reviewDate.value;
  const description = form.description.value.trim();

  if (!title || !responsible || !dueDate || !reviewDate) {
    showToast('Preencha os campos obrigatórios.', 'error');
    return;
  }

  try {
    await store.loadManagement();
    await store.loadReports();
    const reports = store.state.reports || [];
    const assessments = store.state.management?.assessments || [];

    const targetReport = (reportId ? reports.find(r => r.id === reportId) : null) || reports[0];
    if (!targetReport) {
      showToast('Conclua ao menos um ciclo de pesquisa antes de cadastrar ações preventivas.', 'warning');
      return;
    }

    let assessment = assessments.find(a => a.reportId === targetReport.id && a.factor === factor);
    if (!assessment) {
      assessment = await post('/management/assessments', {
        reportId: targetReport.id,
        factor,
        title: `Avaliação do Fator: ${factor}`,
        context: `Achado identificado na escuta psicossocial NR-1 (${targetReport.title}).`,
        existingMeasures: 'Medidas em acompanhamento preliminar.',
        decision: `Ação preventiva planejada: ${title}`,
        classification: 'high',
        status: 'evaluated'
      });
    } else if (assessment.status !== 'evaluated') {
      assessment = await put(`/management/assessments/${assessment.id}`, {
        ...assessment,
        status: 'evaluated',
        decision: assessment.decision || `Ação preventiva planejada: ${title}`
      });
    }

    await post('/management/actions', {
      assessmentId: assessment.id,
      title,
      owner: responsible,
      dueDate,
      reviewDate,
      priority: 'high',
      successCriteria: description || `Redução dos riscos associados ao fator ${factor}`,
      description: description || title
    });

    await store.loadManagement();
    closeDialog();
    showToast('Ação preventiva cadastrada com sucesso.', 'success');
    router.refresh();
  } catch (err) {
    showToast(err.message || 'Erro ao cadastrar ação.', 'error');
  }
}

/* ── Edit / Review Action Modal ── */
export function openEditActionModal(actionId) {
  const management = store.state.management || {};
  const actions = management.actions || [];
  const action = actions.find(a => a.id === actionId);
  if (!action) {
    showToast('Ação não encontrada.', 'error');
    return;
  }

  const TRANSITIONS_MAP = {
    planned: [
      { value: 'planned', label: 'Planejada' },
      { value: 'in_progress', label: 'Em Execução' },
      { value: 'cancelled', label: 'Cancelada' }
    ],
    in_progress: [
      { value: 'in_progress', label: 'Em Execução' },
      { value: 'implemented', label: 'Implementada (Aguardando Revisão)' },
      { value: 'cancelled', label: 'Cancelada' }
    ],
    implemented: [
      { value: 'implemented', label: 'Implementada (Aguardando Revisão)' },
      { value: 'effective', label: 'Concluída e Eficaz' },
      { value: 'ineffective', label: 'Ineficaz (Necessita Nova Medida)' }
    ],
    effective: [{ value: 'effective', label: 'Concluída e Eficaz' }],
    ineffective: [
      { value: 'ineffective', label: 'Ineficaz (Necessita Nova Medida)' },
      { value: 'in_progress', label: 'Reabrir em Execução' }
    ],
    cancelled: [{ value: 'cancelled', label: 'Cancelada' }]
  };

  const statusOptions = TRANSITIONS_MAP[action.status] || [{ value: action.status, label: action.status }];

  const content = `
    <form id="edit-action-form">
      ${field({ id: 'edit-act-title', name: 'title', label: 'Título da ação', value: action.title || '', required: true })}
      ${field({ id: 'edit-act-owner', name: 'owner', label: 'Responsável pela execução', value: action.owner || action.responsible || '', required: true })}
      <div class="grid grid-cols-2 gap-3">
        ${field({ id: 'edit-act-due', name: 'dueDate', label: 'Prazo de conclusão', type: 'date', value: action.dueDate || '', required: true })}
        ${field({ id: 'edit-act-rev', name: 'reviewDate', label: 'Data de revisão', type: 'date', value: action.reviewDate || '', required: true })}
      </div>
      ${select({ id: 'edit-act-status', name: 'status', label: 'Status da ação', options: statusOptions, selected: action.status, required: true })}
      ${textarea({ id: 'edit-act-desc', name: 'description', label: 'Descrição da medida', value: action.description || '', rows: 2 })}
      ${textarea({ id: 'edit-act-review', name: 'review', label: 'Registro de Revisão de Eficácia', value: action.review || '', rows: 2, hint: 'Obrigatório para concluir como Eficaz ou Ineficaz.' })}

      <div class="card p-3 bg-subtle mt-3">
        <label class="form-label text-xs font-semibold mb-1">Adicionar Nova Evidência de Execução</label>
        ${field({ id: 'edit-act-evidence-desc', name: 'evidenceDesc', label: 'Descrição da Evidência', placeholder: 'ex: Treinamento concluído com lista de presença assinada' })}
        ${field({ id: 'edit-act-evidence-url', name: 'evidenceUrl', label: 'Link da Evidência (HTTPS opcional)', placeholder: 'https://...' })}
      </div>
    </form>
  `;

  const footer = `
    <button type="button" class="btn btn-secondary" data-action="close-dialog">Cancelar</button>
    <button type="button" class="btn btn-primary" data-action="submit-edit-action" data-id="${attr(action.id)}">Salvar Alterações</button>
  `;

  openDialog({ title: 'Editar / Revisar Medida Preventiva', content, footer });
}

export async function submitEditAction(actionId) {
  const form = document.getElementById('edit-action-form');
  if (!form) return;

  const management = store.state.management || {};
  const actions = management.actions || [];
  const action = actions.find(a => a.id === actionId);
  if (!action) {
    showToast('Ação não encontrada.', 'error');
    return;
  }

  const title = form.title.value.trim();
  const owner = form.owner.value.trim();
  const dueDate = form.dueDate.value;
  const reviewDate = form.reviewDate.value;
  const status = form.status.value;
  const description = form.description.value.trim();
  const review = form.review.value.trim();
  const evidenceDesc = form.evidenceDesc?.value?.trim();
  const evidenceUrl = form.evidenceUrl?.value?.trim();

  if (!title || !owner || !dueDate || !reviewDate) {
    showToast('Preencha os campos obrigatórios.', 'error');
    return;
  }

  try {
    if (evidenceDesc) {
      await post(`/management/actions/${actionId}/evidence`, {
        description: evidenceDesc,
        url: evidenceUrl || undefined
      });
    }

    await put(`/management/actions/${actionId}`, {
      title,
      owner,
      dueDate,
      reviewDate,
      status,
      priority: action.priority || 'medium',
      successCriteria: action.successCriteria || description || title,
      description,
      review: review || undefined,
      version: action.version
    });

    await store.loadManagement();
    closeDialog();
    showToast('Ação preventiva atualizada com sucesso!', 'success');
    router.refresh();
  } catch (err) {
    showToast(err.message || 'Erro ao atualizar ação.', 'error');
  }
}
