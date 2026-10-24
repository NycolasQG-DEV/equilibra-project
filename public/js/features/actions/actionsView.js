/* Action Plans and Assessments feature (NR-1 / PGR) */

import { renderShell } from '../../ui/shell.js';
import { esc, attr, date, actionStatusBadge } from '../../domain/formatters.js';
import { post } from '../../core/api.js';
import { store } from '../../core/store.js';
import { openDialog, closeDialog } from '../../ui/dialog.js';
import { showToast } from '../../ui/toast.js';
import { field, textarea, select } from '../../ui/fields.js';

export function renderActionsList({ state }) {
  const management = state.management || {};
  const actions = management.actions || [];
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
            Ciclo contínuo de planejamento, implementação e revisão de eficácia das medidas preventivas
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
                      Nenhuma ação cadastrada. Transforme os achados dos relatórios em medidas preventivas.
                    </td>
                  </tr>
                ` : actions.map(a => {
                  const isOverdue = ['planned', 'in_progress'].includes(a.status) && a.dueDate < todayStr;
                  const isReviewDue = a.status === 'implemented' && a.reviewDate <= todayStr;

                  return `
                    <tr>
                      <td><strong>${esc(a.title)}</strong></td>
                      <td>${esc(a.factor || 'Geral')}</td>
                      <td>${esc(a.responsible || '—')}</td>
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

  const content = `
    <form id="add-action-form">
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
    await post('/management/actions', {
      title,
      factor,
      responsible,
      dueDate,
      reviewDate,
      description,
      status: 'planned'
    });
    await store.loadManagement();
    closeDialog();
    showToast('Ação preventiva cadastrada com sucesso.', 'success');
  } catch (err) {
    showToast(err.message || 'Erro ao cadastrar ação.', 'error');
  }
}
