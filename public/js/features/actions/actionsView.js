/* Action Plans and Assessments feature (NR-1 / PGR) */

import { renderShell } from '../../ui/shell.js';
import { esc, attr, date, actionStatusBadge } from '../../domain/formatters.js';
import { post, put } from '../../core/api.js';
import { store } from '../../core/store.js';
import { openDialog, closeDialog } from '../../ui/dialog.js';
import { showToast } from '../../ui/toast.js';
import { field, textarea, select } from '../../ui/fields.js';
import { router } from '../../core/router.js';

export function renderActionsList({ state }) {
  const management = state.management || {};
  const actions = management.actions || [];
  const assessments = management.assessments || [];
  const isViewer = state.account?.role === 'viewer';

  const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
  const overdueCount = actions.filter(a => ['planned', 'in_progress'].includes(a.status) && a.dueDate < todayStr).length;
  const reviewCount = actions.filter(a => a.status === 'implemented' && a.reviewDate <= todayStr).length;

  const content = `
    <div class="actions-page">
      <div class="flex items-center justify-between mb-4">
        <div>
          <h1 class="view-title">Planos de Ação e Intervenções (NR-1)</h1>
          <p class="view-subtitle">
            Acompanhamento e gestão contínua de medidas preventivas NR-1
          </p>
        </div>
        <div>
          ${!isViewer ? `
            <button type="button" class="btn btn-primary" data-action="open-add-action-modal">
              <i class="fa-solid fa-plus" aria-hidden="true"></i> Nova Ação Preventiva
            </button>
          ` : ''}
        </div>
      </div>

      <!-- Action status KPI banner -->
      <div class="grid grid-cols-3 gap-4 mb-6">
        <div class="kpi-card">
          <span class="kpi-title">Total de Ações</span>
          <div class="kpi-val">${actions.length}</div>
          <span class="kpi-sub">Cadastradas no plano de ação da empresa</span>
        </div>
        <div class="kpi-card">
          <span class="kpi-title">Ações em Atraso</span>
          <div class="kpi-val ${overdueCount > 0 ? 'color-danger' : ''}">
            ${overdueCount}
          </div>
          <span class="kpi-sub">Prazo de execução ultrapassado</span>
        </div>
        <div class="kpi-card">
          <span class="kpi-title">Aguardando Revisão de Eficácia</span>
          <div class="kpi-val ${reviewCount > 0 ? 'color-warning' : ''}">
            ${reviewCount}
          </div>
          <span class="kpi-sub">Medidas implementadas prontas para avaliação</span>
        </div>
      </div>

      <div class="card mb-6">
        <div class="card-header">
          <h2 class="card-title">Medidas Preventivas Cadastradas</h2>
        </div>
        <div class="card-body p-0">
          <div class="table-wrap table-borderless">
            <table class="table">
              <thead>
                <tr>
                  <th>Título da Ação</th>
                  <th>Fator Associado</th>
                  <th>Responsável</th>
                  <th>Prazo</th>
                  <th>Revisão de Eficácia</th>
                  <th>Status</th>
                  ${!isViewer ? '<th class="text-right">Ações</th>' : ''}
                </tr>
              </thead>
              <tbody>
                ${actions.length === 0 ? `
                  <tr>
                    <td colspan="${isViewer ? '6' : '7'}" class="table-empty-cell">
                      Nenhuma ação cadastrada. Transforme os achados dos relatórios em medidas preventivas ou adicione uma nova ação acima.
                    </td>
                  </tr>
                ` : actions.map(a => {
                  const ass = assessments.find(x => x.id === a.assessmentId);
                  const isOverdue = ['planned', 'in_progress'].includes(a.status) && a.dueDate < todayStr;
                  const isReviewDue = a.status === 'implemented' && a.reviewDate <= todayStr;
                  const factorLabel = ass?.factor || a.factor || 'Geral';
                  const ownerLabel = a.owner || a.responsible || '—';

                  return `
                    <tr>
                      <td>
                        <strong>${esc(a.title)}</strong>
                        ${a.description ? `<div class="table-subtext">${esc(a.description)}</div>` : ''}
                      </td>
                      <td>
                        <span class="badge badge-neutral">${esc(factorLabel)}</span>
                      </td>
                      <td>${esc(ownerLabel)}</td>
                      <td>
                        <span class="num ${isOverdue ? 'color-danger font-semibold' : ''}">
                          ${date(a.dueDate)}
                        </span>
                        ${isOverdue ? '<span class="badge badge-danger">Atrasada</span>' : ''}
                      </td>
                      <td>
                        <span class="num ${isReviewDue ? 'color-warning font-semibold' : ''}">
                          ${date(a.reviewDate)}
                        </span>
                        ${isReviewDue ? '<span class="badge badge-warning">Revisar</span>' : ''}
                      </td>
                      <td>${actionStatusBadge(a.status)}</td>
                      ${!isViewer ? `
                        <td class="text-right">
                          <button type="button" class="btn btn-ghost btn-sm" data-action="edit-action" data-id="${attr(a.id)}">
                            Editar / Revisar
                          </button>
                        </td>
                      ` : ''}
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  `;

  return renderShell({
    activePath: 'acoes',
    breadcrumbs: [{ label: 'Planos de Ação' }],
    content,
    state
  });
}

export function openAddActionModal() {
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
      ${field({ id: 'act-title', name: 'title', label: 'Título da ação preventiva', required: true, placeholder: 'ex: Treinamento de liderança preventiva em SST' })}
      ${select({ id: 'act-factor', name: 'factor', label: 'Fator psicossocial associado', options: factorOptions, selected: 'Geral', required: true })}
      ${field({ id: 'act-resp', name: 'responsible', label: 'Responsável pela execução', required: true, placeholder: 'ex: Equipe de RH / Gestor Operacional' })}
      <div class="grid grid-cols-2 gap-3">
        ${field({ id: 'act-due', name: 'dueDate', label: 'Prazo de conclusão', type: 'date', required: true })}
        ${field({ id: 'act-rev', name: 'reviewDate', label: 'Data de revisão de eficácia', type: 'date', required: true })}
      </div>
      ${textarea({ id: 'act-desc', name: 'description', label: 'Descrição detalhada e evidências esperadas', rows: 3 })}
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
