/* Organization feature: People & Groups management */

import { renderShell } from '../../ui/shell.js';
import { esc, attr } from '../../domain/formatters.js';
import { post, put, del } from '../../core/api.js';
import { store } from '../../core/store.js';
import { router } from '../../core/router.js';
import { openDialog, closeDialog } from '../../ui/dialog.js';
import { showToast } from '../../ui/toast.js';
import { field } from '../../ui/fields.js';

export function renderPeople({ state }) {
  const members = state.members || [];
  const groups = state.groups || [];
  const filterGroupId = state.filterGroupId;
  const isOwner = state.account?.role === 'owner';

  const filteredMembers = filterGroupId
    ? members.filter(m => (m.groupIds || []).includes(filterGroupId) || m.groupId === filterGroupId)
    : members;

  const groupOptions = [
    { value: '', label: 'Todos os grupos' },
    ...groups.map(g => ({ value: g.id, label: `${g.name} (${g.memberIds?.length || 0})` }))
  ];

  const content = `
    <div class="org-page">
      <div class="flex items-center justify-between mb-4">
        <div>
          <h1 class="view-title">Organização</h1>
          <p class="view-subtitle">
            Gestão de colaboradores, equipes e segmentos da empresa
          </p>
        </div>
        ${isOwner ? `
          <div class="flex gap-2">
            <button type="button" class="btn btn-secondary" data-action="open-import-modal">
              <i class="fa-solid fa-file-import" aria-hidden="true"></i> Importar Planilha
            </button>
            <button type="button" class="btn btn-primary" data-action="open-add-member-modal">
              <i class="fa-solid fa-user-plus" aria-hidden="true"></i> Adicionar Colaborador
            </button>
          </div>
        ` : ''}
      </div>

      <nav class="tabs-nav mb-6" aria-label="Seções de organização">
        <a href="#organizacao/pessoas" class="tab-link" aria-current="page">Pessoas (${members.length})</a>
        <a href="#organizacao/grupos" class="tab-link">Grupos (${groups.length})</a>
      </nav>

      <div class="card mb-4">
        <div class="card-body p-4">
          <div class="flex items-center gap-4 flex-wrap">
            <div class="flex-1 search-wrap">
              <input
                type="search"
                id="member-search-input"
                class="form-input"
                placeholder="Buscar por nome, e-mail ou matrícula..."
                aria-label="Buscar colaboradores"
              >
            </div>
            <div class="filter-wrap">
              <select id="member-group-filter" class="form-select" aria-label="Filtrar por grupo">
                ${groupOptions.map(o => `
                  <option value="${attr(o.value)}" ${o.value === filterGroupId ? 'selected' : ''}>
                    ${esc(o.label)}
                  </option>
                `).join('')}
              </select>
            </div>
          </div>
        </div>
      </div>

      <!-- Barra de Ações em Massa para Colaboradores -->
      <div id="members-bulk-toolbar" class="members-bulk-toolbar hidden mb-4">
        <div class="flex items-center gap-3">
          <span class="badge badge-primary font-semibold" id="members-bulk-count-label">0 colaboradores selecionados</span>
        </div>
        <div class="flex items-center gap-2">
          <button type="button" class="btn btn-ghost btn-sm" data-action="toggle-select-all-members">
            <i class="fa-solid fa-check-double" aria-hidden="true"></i> Marcar todos
          </button>
          <button type="button" class="btn btn-ghost btn-sm" data-action="clear-member-selection">
            Desmarcar todos
          </button>
          ${isOwner ? `
            <button type="button" class="btn btn-danger btn-sm" data-action="open-bulk-delete-members-modal">
              <i class="fa-solid fa-trash-can" aria-hidden="true"></i> Excluir selecionados
            </button>
          ` : ''}
        </div>
      </div>

      <div class="table-wrap">
        <table class="table" id="members-table">
          <thead>
            <tr>
              ${isOwner ? `
                <th class="member-select-col">
                  <input type="checkbox" id="select-all-members" class="member-checkbox" title="Marcar todos os colaboradores" aria-label="Marcar todos os colaboradores">
                </th>
              ` : ''}
              <th>Nome</th>
              <th>WhatsApp / Telefone</th>
              <th>E-mail</th>
              <th>Matrícula</th>
              <th>Grupos / Segmentos</th>
              <th class="text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            ${filteredMembers.length === 0 ? `
              <tr>
                <td colspan="${isOwner ? '7' : '6'}" class="table-empty-cell">
                  Nenhum colaborador encontrado com os filtros selecionados.
                </td>
              </tr>
            ` : filteredMembers.map(m => {
              const memberGroups = groups.filter(g => (m.groupIds || []).includes(g.id) || g.id === m.groupId);
              return `
                <tr data-member-id="${attr(m.id)}" data-member-name="${attr(m.name?.toLowerCase())}" data-member-email="${attr(m.email?.toLowerCase())}">
                  ${isOwner ? `
                    <td class="member-select-col">
                      <input type="checkbox" class="member-checkbox member-row-checkbox" value="${attr(m.id)}" data-member-id="${attr(m.id)}" aria-label="Selecionar ${attr(m.name)}">
                    </td>
                  ` : ''}
                  <td><strong>${esc(m.name)}</strong></td>
                  <td><span class="num text-xs">${esc(m.phone || '—')}</span></td>
                  <td>${esc(m.email)}</td>
                  <td>${esc(m.registration || '—')}</td>
                  <td>
                    ${memberGroups.map(g => `
                      <span class="badge badge-neutral mr-1">${esc(g.name)}</span>
                    `).join('') || '<span class="color-muted">Sem grupo</span>'}
                  </td>
                  <td class="text-right">
                    ${isOwner ? `
                      <button type="button" class="btn btn-ghost btn-sm member-action-btn" data-action="edit-member" data-id="${attr(m.id)}">
                        Editar
                      </button>
                      <button type="button" class="btn btn-ghost btn-sm color-danger member-action-btn member-row-delete-btn" data-action="delete-member" data-id="${attr(m.id)}">
                        Remover
                      </button>
                    ` : '<span class="color-muted text-xs">—</span>'}
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;

  return renderShell({
    activePath: 'organizacao/pessoas',
    breadcrumbs: [{ label: 'Organização' }, { label: 'Pessoas' }],
    content,
    state
  });
}

export function renderGroups({ state }) {
  const groups = state.groups || [];
  const members = state.members || [];
  const isOwner = state.account?.role === 'owner';

  const content = `
    <div class="org-page">
      <div class="flex items-center justify-between mb-4">
        <div>
          <h1 class="view-title">Organização</h1>
          <p class="view-subtitle">
            Gestão de grupos, áreas e segmentos organizacionais
          </p>
        </div>
        ${isOwner ? `
          <div class="flex gap-2">
            <button type="button" class="btn btn-primary" data-action="open-add-group-modal">
              <i class="fa-solid fa-folder-plus" aria-hidden="true"></i> Novo Grupo
            </button>
          </div>
        ` : ''}
      </div>

      <nav class="tabs-nav mb-6" aria-label="Seções de organização">
        <a href="#organizacao/pessoas" class="tab-link">Pessoas (${members.length})</a>
        <a href="#organizacao/grupos" class="tab-link" aria-current="page">Grupos (${groups.length})</a>
      </nav>

      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>Nome do Grupo</th>
              <th>Integrantes</th>
              <th>Elegibilidade</th>
              <th class="text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            ${groups.length === 0 ? `
              <tr>
                <td colspan="4" class="table-empty-cell">
                  Nenhum grupo cadastrado. O grupo padrão "Geral" reúne todos os colaboradores.
                </td>
              </tr>
            ` : groups.map(g => {
              const count = g.memberIds?.length || 0;
              const isBelowMin = count < 5;
              const isGeneral = g.name === 'Geral';

              return `
                <tr>
                  <td>
                    <div class="flex items-center gap-2">
                      <span class="group-dot" data-color="${attr(g.color || '#581c43')}"></span>
                      <strong>${esc(g.name)}</strong>
                      ${isGeneral ? '<span class="badge badge-info">Padrão</span>' : ''}
                    </div>
                  </td>
                  <td><span class="num">${count}</span> colaboradores</td>
                  <td>
                    ${isBelowMin ? `
                      <span class="badge badge-warning" title="Grupos menores são agregados automaticamente nos relatórios">
                        <i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i> Poucos integrantes
                      </span>
                    ` : `
                      <span class="badge badge-success">
                        <i class="fa-solid fa-check" aria-hidden="true"></i> Apto para relatório
                      </span>
                    `}
                  </td>
                  <td class="text-right">
                    ${isOwner ? `
                      <button type="button" class="btn btn-ghost btn-sm" data-action="edit-group" data-id="${attr(g.id)}">
                        Editar
                      </button>
                      ${!isGeneral ? `
                        <button type="button" class="btn btn-ghost btn-sm color-danger" data-action="delete-group" data-id="${attr(g.id)}">
                          Excluir
                        </button>
                      ` : ''}
                    ` : '<span class="color-muted text-xs">—</span>'}
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;

  return renderShell({
    activePath: 'organizacao/grupos',
    breadcrumbs: [{ label: 'Organização' }, { label: 'Grupos' }],
    content,
    state
  });
}

// ── Modals and Handlers ──
export function openAddMemberModal() {
  const groups = store.getState().groups || [];
  const content = `
    <form id="add-member-form">
      ${field({ id: 'm-name', name: 'name', label: 'Nome completo', required: true })}
      ${field({ id: 'm-phone', name: 'phone', label: 'Telefone / WhatsApp (com DDD)', placeholder: '(11) 98765-4321', required: true, hint: 'Obrigatório para receber as pesquisas via WhatsApp.' })}
      ${field({ id: 'm-email', name: 'email', label: 'E-mail corporativo', type: 'email', required: true })}
      ${field({ id: 'm-reg', name: 'registration', label: 'Matrícula (opcional)' })}
      <div class="form-group">
        <label class="form-label">Grupos pertencentes</label>
        <div class="card p-2 scroll-box-sm">
          ${groups.map(g => `
            <label class="form-check mb-1">
              <input type="checkbox" name="groupIds" value="${attr(g.id)}" ${g.name === 'Geral' ? 'checked' : ''}>
              <span>${esc(g.name)}</span>
            </label>
          `).join('')}
        </div>
      </div>
    </form>
  `;

  const footer = `
    <button type="button" class="btn btn-secondary" data-action="close-dialog">Cancelar</button>
    <button type="button" class="btn btn-primary" data-action="submit-add-member">Salvar Colaborador</button>
  `;

  openDialog({ title: 'Adicionar Colaborador', content, footer });
}

export async function submitAddMember() {
  const form = document.getElementById('add-member-form');
  if (!form) return;

  const name = form.name.value.trim();
  const phone = form.phone ? form.phone.value.trim() : '';
  const email = form.email.value.trim();
  const registration = form.registration.value.trim();
  const groupCheckboxes = form.querySelectorAll('input[name="groupIds"]:checked');
  const groupIds = Array.from(groupCheckboxes).map(cb => cb.value);

  if (!name || !email) {
    showToast('Preencha o nome e o e-mail.', 'error');
    return;
  }

  const member = (store.getState().members || []).find((m) => m.id === memberId);
  const isUnchangedMasked = member && member.phone && phone === member.phone;

  if (!isUnchangedMasked) {
    if (!phone) {
      showToast('Informe o telefone com DDD para envio de pesquisas pelo WhatsApp.', 'error');
      form.phone?.focus();
      return;
    }

    const phoneDigits = phone.replace(/\D/g, '');
    if (phoneDigits.length < 10 || phoneDigits.length > 13) {
      showToast('Telefone inválido. Informe o DDD e o número completo (ex: 11987654321).', 'error');
      form.phone?.focus();
      return;
    }
  }

  try {
    await post('/members', { name, email, phone, registration, groupIds });
    closeDialog();
    await store.loadOrganization();
    router.refresh();
    showToast('Colaborador adicionado com sucesso.', 'success');
  } catch (err) {
    showToast(err.message || 'Erro ao cadastrar.', 'error');
  }
}

export function openEditMemberModal(memberId) {
  const state = store.getState();
  const members = state.members || [];
  const groups = state.groups || [];
  const member = members.find((m) => m.id === memberId);
  if (!member) {
    showToast('Colaborador não encontrado.', 'error');
    return;
  }

  const memberGroupIds = groups
    .filter((g) => (g.memberIds || []).includes(member.id) || (member.groupIds || []).includes(g.id))
    .map((g) => g.id);

  const content = `
    <form id="edit-member-form">
      ${field({ id: 'em-name', name: 'name', label: 'Nome completo', value: member.name || '', required: true })}
      ${field({ id: 'em-email', name: 'email', label: 'E-mail corporativo', type: 'email', value: member.email || '', required: true })}
      ${field({ id: 'em-phone', name: 'phone', label: 'Telefone / WhatsApp (com DDD)', value: member.phone || '', placeholder: '(11) 98765-4321', required: true, hint: 'Obrigatório para receber as pesquisas via WhatsApp.' })}
      ${field({ id: 'em-reg', name: 'registration', label: 'Matrícula (opcional)', value: member.registration || '' })}
      <div class="form-group mb-2">
        <label class="form-label">Equipes / Grupos vinculados</label>
        <div class="card p-2 scroll-box-sm">
          ${groups.map((g) => `
            <label class="form-check mb-1">
              <input type="checkbox" name="groupIds" value="${attr(g.id)}" ${g.name === 'Geral' || memberGroupIds.includes(g.id) ? 'checked' : ''}>
              <span>${esc(g.name)}</span>
            </label>
          `).join('')}
        </div>
      </div>
    </form>
  `;

  const footer = `
    <button type="button" class="btn btn-secondary" data-action="close-dialog">Cancelar</button>
    <button type="button" class="btn btn-primary" data-action="submit-edit-member" data-id="${attr(member.id)}">Salvar Alterações</button>
  `;

  openDialog({ title: 'Editar Colaborador', content, footer });
}

export async function submitEditMember(memberId) {
  const form = document.getElementById('edit-member-form');
  if (!form) return;

  const name = form.name.value.trim();
  const email = form.email.value.trim();
  const phone = form.phone.value.trim();
  const registration = form.registration.value.trim();
  const groupCheckboxes = form.querySelectorAll('input[name="groupIds"]:checked');
  const groupIds = Array.from(groupCheckboxes).map((cb) => cb.value);

  if (!name || !email) {
    showToast('Preencha o nome e o e-mail.', 'error');
    return;
  }

  const member = (store.getState().members || []).find((m) => m.id === memberId);
  const isUnchangedMasked = member && member.phone && phone === member.phone;

  if (!isUnchangedMasked) {
    if (!phone) {
      showToast('Informe o telefone com DDD para envio de pesquisas pelo WhatsApp.', 'error');
      form.phone?.focus();
      return;
    }

    const phoneDigits = phone.replace(/\D/g, '');
    if (phoneDigits.length < 10 || phoneDigits.length > 13) {
      showToast('Telefone inválido. Informe o DDD e o número completo (ex: 11987654321).', 'error');
      form.phone?.focus();
      return;
    }
  }

  try {
    await put(`/members/${memberId}`, { name, email, phone, registration, groupIds });
    closeDialog();
    await store.loadOrganization();
    router.refresh();
    showToast('Colaborador atualizado com sucesso.', 'success');
  } catch (err) {
    showToast(err.message || 'Erro ao atualizar colaborador.', 'error');
  }
}

let deleteMemberCountdownTimer = null;

function startMemberDeleteCountdown({
  duration = 10,
  containerId = 'delete-member-timer-container',
  badgeId = 'delete-member-timer-badge',
  secondsId = 'delete-member-seconds-count',
  progressId = 'delete-member-progress-bar',
  messageId = 'delete-member-timer-msg',
  consentRowId = 'delete-member-consent-label',
  consentCheckboxId = 'delete-member-consent-checkbox',
  confirmBtnId = 'btn-confirm-delete-member'
} = {}) {
  if (deleteMemberCountdownTimer) {
    clearInterval(deleteMemberCountdownTimer);
    deleteMemberCountdownTimer = null;
  }

  const timerContainer = document.getElementById(containerId);
  const timerBadge = document.getElementById(badgeId);
  const secondsSpan = document.getElementById(secondsId);
  const progressBar = document.getElementById(progressId);
  const timerMsg = document.getElementById(messageId);
  const consentLabel = document.getElementById(consentRowId);
  const consentCheckbox = document.getElementById(consentCheckboxId);
  const confirmBtn = document.getElementById(confirmBtnId);

  const totalMs = duration * 1000;
  const startTime = Date.now();

  if (progressBar) {
    progressBar.style.width = '100%';
  }
  if (secondsSpan) {
    secondsSpan.textContent = String(duration);
  }

  deleteMemberCountdownTimer = setInterval(() => {
    const elapsed = Date.now() - startTime;
    const remainingMs = Math.max(0, totalMs - elapsed);
    const secondsRemaining = Math.ceil(remainingMs / 1000);
    const pct = Math.max(0, (remainingMs / totalMs) * 100);

    if (secondsSpan) {
      secondsSpan.textContent = String(secondsRemaining);
    }
    if (progressBar) {
      progressBar.style.width = `${pct.toFixed(1)}%`;
    }

    if (remainingMs <= 0) {
      clearInterval(deleteMemberCountdownTimer);
      deleteMemberCountdownTimer = null;

      if (timerContainer) {
        timerContainer.classList.add('timer-completed');
      }
      if (timerMsg) {
        timerMsg.innerHTML = '<i class="fa-solid fa-circle-check color-success" aria-hidden="true"></i> Tempo de leitura concluído. Você já pode marcar a confirmação abaixo:';
      }
      if (timerBadge) {
        timerBadge.style.display = 'none';
      }
      if (progressBar) {
        progressBar.style.width = '0%';
      }

      if (consentCheckbox && consentLabel) {
        consentCheckbox.disabled = false;
        consentLabel.classList.remove('disabled');
      }
    }
  }, 50);

  if (consentCheckbox && confirmBtn) {
    consentCheckbox.addEventListener('change', (e) => {
      confirmBtn.disabled = !e.target.checked;
      if (e.target.checked) {
        confirmBtn.focus();
      }
    });
  }
}

export function openDeleteMemberConfirm(memberId) {
  const member = (store.getState().members || []).find((m) => m.id === memberId);
  if (!member) return;

  if (deleteMemberCountdownTimer) {
    clearInterval(deleteMemberCountdownTimer);
    deleteMemberCountdownTimer = null;
  }

  const content = `
    <div class="delete-survey-modal-content">
      <div class="delete-survey-warning">
        <div class="delete-survey-warning__header">
          <i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i>
          <span>Atenção: Ação irreversível de exclusão</span>
        </div>
        <p class="delete-survey-warning__body">
          Você está prestes a remover permanentemente o colaborador <strong>"${esc(member.name)}"</strong> (${esc(member.email || 'sem e-mail')}).
        </p>
        <ul class="delete-survey-warning__list">
          <li>O colaborador será desvinculado de todas as equipes e grupos da organização.</li>
          <li>Convites de pesquisa pendentes vinculados a ele serão cancelados.</li>
          <li>Respostas anônimas submetidas anteriormente permanecem anônimas para integridade estatística.</li>
        </ul>

        <div class="delete-survey-timer-box" id="delete-member-timer-container">
          <div class="delete-survey-timer-text">
            <span id="delete-member-timer-msg">
              <i class="fa-regular fa-clock" aria-hidden="true"></i> Leia o aviso com atenção antes de confirmar:
            </span>
            <span class="delete-survey-timer-badge" id="delete-member-timer-badge">
              <span id="delete-member-seconds-count">10</span>s
            </span>
          </div>
          <div class="delete-survey-progress">
            <div class="delete-survey-progress-bar" id="delete-member-progress-bar"></div>
          </div>
        </div>
      </div>

      <label class="delete-survey-consent-row disabled" id="delete-member-consent-label">
        <input type="checkbox" id="delete-member-consent-checkbox" disabled />
        <span class="delete-survey-consent-label">
          Compreendo que a remoção do colaborador <strong>"${esc(member.name)}"</strong> é irreversível e desejo prosseguir.
        </span>
      </label>
    </div>
  `;

  const footer = `
    <button type="button" class="btn btn-secondary" data-action="close-dialog">Cancelar</button>
    <button type="button" class="btn btn-danger" id="btn-confirm-delete-member" data-action="confirm-delete-member" data-id="${attr(member.id)}" disabled>
      <i class="fa-solid fa-trash-can" aria-hidden="true"></i> Remover Colaborador
    </button>
  `;

  openDialog({
    title: 'Remover Colaborador',
    content,
    footer,
    onClose: () => {
      if (deleteMemberCountdownTimer) {
        clearInterval(deleteMemberCountdownTimer);
        deleteMemberCountdownTimer = null;
      }
    }
  });

  startMemberDeleteCountdown();
}

export async function confirmDeleteMember(memberId) {
  const consentCheckbox = document.getElementById('delete-member-consent-checkbox');
  if (consentCheckbox && !consentCheckbox.checked) {
    showToast('Você precisa marcar a caixa de confirmação para poder remover o colaborador.', 'warning');
    return;
  }

  try {
    await del(`/members/${memberId}`);
    closeDialog();
    await store.loadOrganization();
    router.refresh();
    showToast('Colaborador removido com sucesso.', 'success');
  } catch (err) {
    showToast(err.message || 'Erro ao remover colaborador.', 'error');
  }
}

export function getSelectedMemberIds() {
  const checkboxes = document.querySelectorAll('.member-row-checkbox:checked');
  return Array.from(checkboxes).map(cb => cb.value);
}

export function updateMemberSelectionUI() {
  const visibleCheckboxes = Array.from(document.querySelectorAll('#members-table tbody tr:not([style*="display: none"]) .member-row-checkbox'));
  const allRowCheckboxes = Array.from(document.querySelectorAll('.member-row-checkbox'));
  const checkedCheckboxes = allRowCheckboxes.filter(cb => cb.checked);
  const selectedCount = checkedCheckboxes.length;
  const visibleCount = visibleCheckboxes.length;

  const selectAllCheckbox = document.getElementById('select-all-members');
  const bulkToolbar = document.getElementById('members-bulk-toolbar');
  const bulkCountLabel = document.getElementById('members-bulk-count-label');
  const table = document.getElementById('members-table');

  if (selectAllCheckbox) {
    const visibleCheckedCount = visibleCheckboxes.filter(cb => cb.checked).length;
    if (visibleCount > 0 && visibleCheckedCount === visibleCount) {
      selectAllCheckbox.checked = true;
      selectAllCheckbox.indeterminate = false;
    } else if (visibleCheckedCount > 0) {
      selectAllCheckbox.checked = false;
      selectAllCheckbox.indeterminate = true;
    } else {
      selectAllCheckbox.checked = false;
      selectAllCheckbox.indeterminate = false;
    }
  }

  // Visual highlight for selected rows
  allRowCheckboxes.forEach(cb => {
    const row = cb.closest('tr');
    if (row) {
      if (cb.checked) {
        row.classList.add('member-row-selected');
      } else {
        row.classList.remove('member-row-selected');
      }
    }
  });

  if (selectedCount > 0) {
    if (table) table.classList.add('selection-active');
    if (bulkToolbar) bulkToolbar.classList.remove('hidden');
    if (bulkCountLabel) {
      bulkCountLabel.textContent = `${selectedCount} ${selectedCount === 1 ? 'colaborador selecionado' : 'colaboradores selecionados'}`;
    }
  } else {
    if (table) table.classList.remove('selection-active');
    if (bulkToolbar) bulkToolbar.classList.add('hidden');
  }
}

export function openBulkDeleteMembersModal() {
  const ids = getSelectedMemberIds();
  const count = ids.length;
  if (count === 0) {
    showToast('Nenhum colaborador selecionado para exclusão.', 'warning');
    return;
  }

  if (deleteMemberCountdownTimer) {
    clearInterval(deleteMemberCountdownTimer);
    deleteMemberCountdownTimer = null;
  }

  const content = `
    <div class="delete-survey-modal-content">
      <div class="delete-survey-warning">
        <div class="delete-survey-warning__header">
          <i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i>
          <span>Atenção: Ação irreversível de exclusão (${count} ${count === 1 ? 'colaborador' : 'colaboradores'})</span>
        </div>
        <p class="delete-survey-warning__body">
          Você está prestes a remover permanentemente <strong>${count}</strong> ${count === 1 ? 'colaborador selecionado' : 'colaboradores selecionados'}.
        </p>
        <ul class="delete-survey-warning__list">
          <li>Os colaboradores serão desvinculados de todas as equipes e grupos da organização.</li>
          <li>Convites pendentes vinculados a eles serão desativados.</li>
          <li>Respostas anônimas submetidas anteriormente permanecem anônimas para integridade estatística.</li>
        </ul>

        <div class="delete-survey-timer-box" id="bulk-delete-member-timer-container">
          <div class="delete-survey-timer-text">
            <span id="bulk-delete-member-timer-msg">
              <i class="fa-regular fa-clock" aria-hidden="true"></i> Leia o aviso com atenção antes de confirmar:
            </span>
            <span class="delete-survey-timer-badge" id="bulk-delete-member-timer-badge">
              <span id="bulk-delete-member-seconds-count">10</span>s
            </span>
          </div>
          <div class="delete-survey-progress">
            <div class="delete-survey-progress-bar" id="bulk-delete-member-progress-bar"></div>
          </div>
        </div>
      </div>

      <label class="delete-survey-consent-row disabled" id="bulk-delete-member-consent-label">
        <input type="checkbox" id="bulk-delete-member-consent-checkbox" disabled />
        <span class="delete-survey-consent-label">
          Compreendo que a exclusão de todos os <strong>${count}</strong> colaboradores selecionados é definitiva e irreversível.
        </span>
      </label>
    </div>
  `;

  const footer = `
    <button type="button" class="btn btn-secondary" data-action="close-dialog">Cancelar</button>
    <button type="button" class="btn btn-danger" id="btn-confirm-bulk-delete-members" data-action="confirm-bulk-delete-members" disabled>
      <i class="fa-solid fa-trash-can" aria-hidden="true"></i> Apagar ${count} ${count === 1 ? 'Colaborador' : 'Colaboradores'}
    </button>
  `;

  openDialog({
    title: `Remover ${count} ${count === 1 ? 'Colaborador' : 'Colaboradores'}`,
    content,
    footer,
    onClose: () => {
      if (deleteMemberCountdownTimer) {
        clearInterval(deleteMemberCountdownTimer);
        deleteMemberCountdownTimer = null;
      }
    }
  });

  startMemberDeleteCountdown({
    containerId: 'bulk-delete-member-timer-container',
    badgeId: 'bulk-delete-member-timer-badge',
    secondsId: 'bulk-delete-member-seconds-count',
    progressId: 'bulk-delete-member-progress-bar',
    messageId: 'bulk-delete-member-timer-msg',
    consentRowId: 'bulk-delete-member-consent-label',
    consentCheckboxId: 'bulk-delete-member-consent-checkbox',
    confirmBtnId: 'btn-confirm-bulk-delete-members'
  });
}

export async function submitBulkDeleteMembers() {
  const consentCheckbox = document.getElementById('bulk-delete-member-consent-checkbox');
  if (consentCheckbox && !consentCheckbox.checked) {
    showToast('Você precisa marcar a caixa de confirmação para poder apagar os colaboradores.', 'warning');
    return;
  }

  const ids = getSelectedMemberIds();
  if (ids.length === 0) {
    showToast('Nenhum colaborador selecionado.', 'warning');
    return;
  }

  const confirmBtn = document.getElementById('btn-confirm-bulk-delete-members');
  if (confirmBtn) {
    confirmBtn.disabled = true;
    confirmBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Apagando...';
  }

  try {
    await del('/members', { ids });
    closeDialog();
    await store.loadOrganization();
    router.refresh();
    showToast(`${ids.length} ${ids.length === 1 ? 'colaborador removido' : 'colaboradores removidos'} com sucesso!`, 'success');
  } catch (err) {
    showToast(err.message || 'Erro ao excluir colaboradores.', 'error');
    if (confirmBtn) {
      confirmBtn.disabled = false;
      confirmBtn.innerHTML = '<i class="fa-solid fa-trash-can"></i> Tentar novamente';
    }
  }
}

// ── Spreadsheet Import and Team Modals ──
let currentImportPayload = null;

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      const base64 = typeof result === 'string' ? result.split(',')[1] : '';
      resolve(base64);
    };
    reader.onerror = () => reject(new Error('Erro ao ler o arquivo selecionado.'));
    reader.readAsDataURL(file);
  });
}

export function downloadExcelTemplate() {
  window.location.href = '/api/members/template';
}

export function downloadCsvTemplate() {
  const csvContent = '\uFEFFNome;Telefone;Email;Grupo\nAna Silva;(11) 98765-4321;ana.silva@exemplo.com.br;Operações\nBruno Costa;(11) 98765-4322;bruno.costa@exemplo.com.br;Financeiro\nCarla Dias;(11) 98765-4323;carla.dias@exemplo.com.br;\n';
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', 'equilibra-pessoas.csv');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  showToast('Modelo CSV baixado com sucesso.', 'success');
}

export function resetImportView() {
  currentImportPayload = null;
  const uploadContainer = document.getElementById('import-upload-container');
  const previewContainer = document.getElementById('import-preview-container');
  const confirmBtn = document.getElementById('import-confirm-btn');

  if (previewContainer) {
    previewContainer.classList.add('d-none');
    previewContainer.innerHTML = '';
  }
  if (confirmBtn) {
    confirmBtn.classList.add('d-none');
    confirmBtn.disabled = true;
  }
  if (uploadContainer) {
    uploadContainer.classList.remove('d-none');
    uploadContainer.innerHTML = `
      <input type="file" id="import-file-input" class="visually-hidden" accept=".xlsx,.csv">
      <label for="import-file-input" class="import-dropzone" id="import-dropzone">
        <i class="fa-solid fa-cloud-arrow-up import-icon" aria-hidden="true"></i>
        <span class="text-sm font-semibold color-text-primary">Clique para selecionar ou arraste sua planilha aqui</span>
        <span class="text-xs color-text-muted">Formatos suportados: .xlsx ou .csv (tamanho máximo: 1 MB)</span>
      </label>
    `;
    setupImportEvents();
  }
}

function renderImportPreview(preview, fileName) {
  const uploadContainer = document.getElementById('import-upload-container');
  const previewContainer = document.getElementById('import-preview-container');
  const confirmBtn = document.getElementById('import-confirm-btn');
  if (!previewContainer) return;

  if (uploadContainer) uploadContainer.classList.add('d-none');
  previewContainer.classList.remove('d-none');

  const rows = preview.rows || [];
  const valid = preview.valid || 0;
  const invalid = preview.invalid || 0;

  const newGroups = [...new Set(rows.map((r) => r.group).filter((g) => g && g.toLowerCase() !== 'geral'))];

  previewContainer.innerHTML = `
    <div class="import-kpis">
      <div class="import-kpi-card">
        <div class="import-kpi-num">${rows.length}</div>
        <div class="import-kpi-label">Total de Linhas</div>
      </div>
      <div class="import-kpi-card">
        <div class="import-kpi-num color-success">${valid}</div>
        <div class="import-kpi-label">Válidas para Cadastro</div>
      </div>
      <div class="import-kpi-card">
        <div class="import-kpi-num ${invalid > 0 ? 'color-danger' : 'color-text-muted'}">${invalid}</div>
        <div class="import-kpi-label">Com Inconsistências</div>
      </div>
      <div class="import-kpi-card">
        <div class="import-kpi-num color-primary">${newGroups.length}</div>
        <div class="import-kpi-label">Novas Equipes</div>
      </div>
    </div>

    ${invalid > 0 ? `
      <div class="privacy-notice privacy-warning mb-3">
        <i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i>
        <div>
          <strong>Atenção: ${invalid} ${invalid === 1 ? 'linha possui' : 'linhas possuem'} pendências</strong>
          <p class="m-0 text-xs">Para manter a integridade cadastral, corrija os erros apontados na tabela antes de importar.</p>
        </div>
      </div>
    ` : `
      <div class="privacy-notice privacy-success mb-3">
        <i class="fa-solid fa-circle-check" aria-hidden="true"></i>
        <div>
          <strong>Tudo pronto para a importação!</strong>
          <p class="m-0 text-xs">Todas as ${valid} linhas foram validadas com sucesso. Clique em Confirmar Cadastro para finalizar.</p>
        </div>
      </div>
    `}

    <div class="import-preview-table-wrap">
      <table class="table">
        <thead>
          <tr>
            <th>Linha</th>
            <th>Nome</th>
            <th>Telefone</th>
            <th>E-mail</th>
            <th>Equipe / Grupo</th>
            <th class="text-right">Status</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map((r) => {
            const hasError = r.errors && r.errors.length > 0;
            return `
              <tr>
                <td><span class="num text-xs">${r.line}</span></td>
                <td><strong>${esc(r.name || '—')}</strong></td>
                <td><span class="text-xs">${esc(r.phone || '—')}</span></td>
                <td><span class="text-xs">${esc(r.email || '—')}</span></td>
                <td><span class="badge badge-neutral">${esc(r.group || 'Geral')}</span></td>
                <td class="text-right">
                  ${hasError ? `
                    <span class="badge badge-danger" title="${attr(r.errors.join('; '))}">
                      <i class="fa-solid fa-circle-xmark" aria-hidden="true"></i> ${esc(r.errors[0])}
                    </span>
                  ` : `
                    <span class="badge badge-success">
                      <i class="fa-solid fa-circle-check" aria-hidden="true"></i> Válido
                    </span>
                  `}
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>

    <div class="flex items-center justify-between">
      <button type="button" class="btn btn-ghost btn-sm" data-action="reset-import-file">
        <i class="fa-solid fa-arrow-left" aria-hidden="true"></i> Escolher outro arquivo
      </button>
      <span class="text-xs color-text-secondary">${esc(fileName)}</span>
    </div>
  `;

  if (confirmBtn) {
    confirmBtn.classList.remove('d-none');
    if (invalid > 0 || valid === 0) {
      confirmBtn.disabled = true;
      confirmBtn.innerHTML = '<i class="fa-solid fa-ban" aria-hidden="true"></i> Corrija os erros para importar';
    } else {
      confirmBtn.disabled = false;
      confirmBtn.innerHTML = `<i class="fa-solid fa-file-import" aria-hidden="true"></i> Confirmar Cadastro (${valid})`;
    }
  }
}

function setupImportEvents() {
  const fileInput = document.getElementById('import-file-input');
  const dropzone = document.getElementById('import-dropzone');
  if (!fileInput || !dropzone) return;

  const handleFile = async (file) => {
    if (!file) return;
    if (!/\.(xlsx|csv)$/i.test(file.name)) {
      showToast('Formato não suportado. Envie um arquivo .xlsx ou .csv.', 'error');
      return;
    }
    if (file.size > 1024 * 1024) {
      showToast('O arquivo excede o limite máximo de 1 MB.', 'error');
      return;
    }

    const uploadContainer = document.getElementById('import-upload-container');
    if (uploadContainer) {
      uploadContainer.innerHTML = `
        <div class="card p-6 text-center">
          <i class="fa-solid fa-spinner fa-spin fa-2x color-primary mb-3" aria-hidden="true"></i>
          <div class="text-sm font-semibold color-text-primary">Validando dados da planilha...</div>
          <div class="text-xs color-text-muted">${esc(file.name)} (${Math.round(file.size / 1024)} KB)</div>
        </div>
      `;
    }

    try {
      const base64 = await readFileAsBase64(file);
      currentImportPayload = { fileName: file.name, base64 };
      const preview = await post('/members/import/preview', currentImportPayload);
      renderImportPreview(preview, file.name);
    } catch (err) {
      showToast(err.message || 'Erro ao processar planilha.', 'error');
      resetImportView();
    }
  };

  fileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  });

  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('dragover');
  });

  dropzone.addEventListener('dragleave', () => {
    dropzone.classList.remove('dragover');
  });

  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    if (e.dataTransfer?.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  });
}

export function openImportModal() {
  currentImportPayload = null;

  const content = `
    <div class="import-modal-content">
      <div class="template-download-bar">
        <div>
          <div class="text-xs font-semibold color-text-primary">Modelos de planilha disponíveis</div>
          <div class="text-xs color-text-secondary">Baixe o modelo com cabeçalhos pré-configurados (Nome, Telefone, Email, Grupo).</div>
        </div>
        <div class="flex gap-2">
          <button type="button" class="btn btn-secondary btn-sm" data-action="download-template-xlsx">
            <i class="fa-solid fa-file-excel color-primary" aria-hidden="true"></i> Baixar Excel (.xlsx)
          </button>
          <button type="button" class="btn btn-secondary btn-sm" data-action="download-template-csv">
            <i class="fa-solid fa-file-csv" aria-hidden="true"></i> Baixar CSV (.csv)
          </button>
        </div>
      </div>

      <div id="import-upload-container">
        <input type="file" id="import-file-input" class="visually-hidden" accept=".xlsx,.csv">
        <label for="import-file-input" class="import-dropzone" id="import-dropzone">
          <i class="fa-solid fa-cloud-arrow-up import-icon" aria-hidden="true"></i>
          <span class="text-sm font-semibold color-text-primary">Clique para selecionar ou arraste sua planilha aqui</span>
          <span class="text-xs color-text-muted">Formatos suportados: .xlsx ou .csv (tamanho máximo: 1 MB)</span>
        </label>
      </div>

      <div id="import-preview-container" class="d-none"></div>
    </div>
  `;

  const footer = `
    <button type="button" class="btn btn-secondary" data-action="close-dialog">Cancelar</button>
    <button type="button" class="btn btn-primary d-none" id="import-confirm-btn" data-action="submit-confirm-import">
      <i class="fa-solid fa-file-import" aria-hidden="true"></i> Importar Colaboradores
    </button>
  `;

  openDialog({
    title: 'Importar Colaboradores via Planilha',
    content,
    footer,
    size: 'lg'
  });

  setupImportEvents();
}

export async function submitConfirmImport() {
  if (!currentImportPayload) {
    showToast('Nenhuma planilha selecionada.', 'error');
    return;
  }

  const confirmBtn = document.getElementById('import-confirm-btn');
  if (confirmBtn) {
    confirmBtn.disabled = true;
    confirmBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i> Cadastrando...';
  }

  try {
    const result = await post('/members/import', currentImportPayload);
    closeDialog();
    await store.loadOrganization();
    router.refresh();
    const count = result.imported || 0;
    const groups = result.groupsCreated || 0;
    showToast(`Sucesso! ${count} colaboradores cadastrados${groups > 0 ? ` e ${groups} novas equipes criadas` : ''}.`, 'success');
  } catch (err) {
    showToast(err.message || 'Erro ao importar colaboradores.', 'error');
    if (confirmBtn) {
      confirmBtn.disabled = false;
      confirmBtn.innerHTML = '<i class="fa-solid fa-file-import" aria-hidden="true"></i> Confirmar Cadastro';
    }
  }
}

const CURATED_COLORS = [
  { hex: '#581c43', name: 'Bordô Equilíbrio' },
  { hex: '#1d684a', name: 'Verde Floresta' },
  { hex: '#1e40af', name: 'Azul Corporativo' },
  { hex: '#b45309', name: 'Âmbar Executivo' },
  { hex: '#475569', name: 'Ardósia Neutra' },
  { hex: '#a23b72', name: 'Rosa Framboesa' },
  { hex: '#0f766e', name: 'Verde Petróleo' },
  { hex: '#3730a3', name: 'Índigo Profundo' }
];

export function pickTeamColor(trigger) {
  const color = trigger.dataset.color;
  const hiddenInput = document.getElementById('g-color');
  const previewDot = document.getElementById('team-preview-dot');
  const swatches = document.querySelectorAll('.swatch-btn');
  swatches.forEach((s) => s.classList.remove('active'));
  trigger.classList.add('active');
  if (hiddenInput) hiddenInput.value = color;
  if (previewDot) previewDot.dataset.color = color;
}

export function selectAllTeamMembers() {
  const memberList = document.getElementById('team-member-picker-list');
  if (!memberList) return;
  const items = memberList.querySelectorAll('.member-picker-item:not(.d-none) .team-member-checkbox');
  items.forEach((cb) => { cb.checked = true; });
  const event = new Event('change', { bubbles: true });
  memberList.dispatchEvent(event);
}

export function clearAllTeamMembers() {
  const memberList = document.getElementById('team-member-picker-list');
  if (!memberList) return;
  const items = memberList.querySelectorAll('.team-member-checkbox');
  items.forEach((cb) => { cb.checked = false; });
  const event = new Event('change', { bubbles: true });
  memberList.dispatchEvent(event);
}

function setupTeamModalEvents(isEditing = false) {
  const nameInput = document.getElementById('g-edit-name') || document.getElementById('g-name');
  const previewName = document.getElementById('team-preview-name');
  const previewCount = document.getElementById('team-preview-count');
  const privacyIndicator = document.getElementById('team-privacy-indicator');
  const submitBtn = document.getElementById('submit-edit-group-btn') || document.getElementById('submit-add-group-btn');
  const searchInput = document.getElementById('team-member-search');
  const memberList = document.getElementById('team-member-picker-list');
  const counterEl = document.getElementById('team-selected-counter');

  const updateCounts = () => {
    const checked = memberList?.querySelectorAll('.team-member-checkbox:checked') || [];
    const count = checked.length;

    if (previewCount) previewCount.textContent = `${count} ${count === 1 ? 'integrante' : 'integrantes'}`;
    if (counterEl) counterEl.textContent = `${count} selecionado${count === 1 ? '' : 's'}`;
    if (submitBtn) {
      if (isEditing) {
        submitBtn.textContent = `Salvar Alterações (${count})`;
      } else {
        submitBtn.innerHTML = `<i class="fa-solid fa-folder-plus" aria-hidden="true"></i> Criar Equipe (${count})`;
      }
    }

    if (privacyIndicator) {
      if (count < 5) {
        privacyIndicator.className = 'privacy-notice privacy-warning';
        privacyIndicator.innerHTML = `
          <i class="fa-solid fa-shield-halved" aria-hidden="true"></i>
          <div>
            <strong>Equipe com poucos integrantes</strong>
            <p class="m-0 text-xs">Adicione mais colaboradores para que esta equipe gere relatório próprio nos ciclos de pesquisa.</p>
          </div>
        `;
      } else {
        privacyIndicator.className = 'privacy-notice privacy-success';
        privacyIndicator.innerHTML = `
          <i class="fa-solid fa-circle-check" aria-hidden="true"></i>
          <div>
            <strong>Elegível para relatório individual</strong>
            <p class="m-0 text-xs">Esta equipe terá visualização própria de fatores e relatórios nos ciclos de pesquisa.</p>
          </div>
        `;
      }
    }
  };

  if (nameInput && previewName) {
    nameInput.addEventListener('input', () => {
      previewName.textContent = nameInput.value.trim() || 'Nome da Equipe';
    });
  }

  if (searchInput && memberList) {
    searchInput.addEventListener('input', () => {
      const q = searchInput.value.trim().toLowerCase();
      const items = memberList.querySelectorAll('.member-picker-item');
      items.forEach((item) => {
        const name = item.dataset.memberName || '';
        const email = item.dataset.memberEmail || '';
        const match = !q || name.includes(q) || email.includes(q);
        if (match) {
          item.classList.remove('d-none');
        } else {
          item.classList.add('d-none');
        }
      });
    });
  }

  if (memberList) {
    memberList.addEventListener('change', (e) => {
      if (e.target.classList.contains('team-member-checkbox')) {
        updateCounts();
      }
    });
  }
}

export function openAddGroupModal() {
  const members = store.getState().members || [];

  const content = `
    <form id="add-group-form">
      <div class="form-group mb-3">
        <label class="form-label" for="g-name">Nome da equipe ou segmento <span class="color-danger">*</span></label>
        <input type="text" id="g-name" name="name" class="form-input" placeholder="ex: Operações, Financeiro, Logística..." required autofocus>
      </div>

      <div class="form-group mb-4">
        <label class="form-label">Cor identificadora</label>
        <div class="group-color-swatches" id="group-color-swatches">
          ${CURATED_COLORS.map((c, i) => `
            <button type="button" class="swatch-btn ${i === 0 ? 'active' : ''}" data-color="${c.hex}" data-action="pick-team-color" title="${c.name}" aria-label="${c.name}"></button>
          `).join('')}
        </div>
        <input type="hidden" id="g-color" name="color" value="#581c43">
      </div>

      <div class="team-preview-card mb-4" id="team-preview-card">
        <div class="flex items-center gap-2">
          <span class="group-dot" id="team-preview-dot" data-color="#581c43"></span>
          <strong id="team-preview-name">Nome da Equipe</strong>
        </div>
        <span class="badge badge-neutral" id="team-preview-count">0 integrantes</span>
      </div>

      <div id="team-privacy-indicator" class="privacy-notice privacy-warning">
        <i class="fa-solid fa-shield-halved" aria-hidden="true"></i>
        <div>
          <strong>Equipe com poucos integrantes</strong>
          <p class="m-0 text-xs">Adicione mais colaboradores para que esta equipe gere relatório próprio nos ciclos de pesquisa.</p>
        </div>
      </div>

      <div class="form-group mb-1">
        <div class="flex items-center justify-between mb-1">
          <label class="form-label m-0">Colaboradores vinculados</label>
          <span class="text-xs color-text-muted" id="team-selected-counter">0 selecionados</span>
        </div>

        <div class="member-picker-box">
          <div class="member-picker-search flex items-center justify-between gap-2">
            <input type="search" id="team-member-search" class="form-input form-input-sm flex-1" placeholder="Filtrar colaboradores por nome ou e-mail..." aria-label="Filtrar colaboradores">
            <div class="flex gap-1">
              <button type="button" class="btn btn-ghost btn-sm" data-action="select-all-team-members">Todos</button>
              <button type="button" class="btn btn-ghost btn-sm" data-action="clear-all-team-members">Limpar</button>
            </div>
          </div>
          <div class="member-picker-list" id="team-member-picker-list">
            ${members.length === 0 ? `
              <div class="p-4 text-center text-xs color-text-muted">
                Nenhum colaborador cadastrado. Cadastre colaboradores ou importe uma planilha para vinculá-los à equipe.
              </div>
            ` : members.map((m) => `
              <label class="member-picker-item" data-member-name="${attr((m.name || '').toLowerCase())}" data-member-email="${attr((m.email || '').toLowerCase())}">
                <input type="checkbox" name="memberIds" value="${attr(m.id)}" class="team-member-checkbox" data-action="toggle-team-member">
                <span class="member-avatar-chip">${esc((m.name || 'C').slice(0, 2).toUpperCase())}</span>
                <div class="flex-1 min-w-0">
                  <div class="text-xs font-semibold color-text-primary text-truncate">${esc(m.name)}</div>
                  <div class="text-xs color-text-secondary text-truncate">${esc(m.email)}</div>
                </div>
              </label>
            `).join('')}
          </div>
        </div>
      </div>
    </form>
  `;

  const footer = `
    <button type="button" class="btn btn-secondary" data-action="close-dialog">Cancelar</button>
    <button type="button" class="btn btn-primary" data-action="submit-add-group" id="submit-add-group-btn">
      <i class="fa-solid fa-folder-plus" aria-hidden="true"></i> Criar Equipe (0)
    </button>
  `;

  openDialog({
    title: 'Nova Equipe ou Segmento',
    content,
    footer,
    size: 'md'
  });

  setupTeamModalEvents(false);
}

export async function submitAddGroup() {
  const form = document.getElementById('add-group-form');
  if (!form) return;

  const name = form.name.value.trim();
  const color = form.color.value;
  const checkboxes = form.querySelectorAll('.team-member-checkbox:checked');
  const memberIds = Array.from(checkboxes).map((cb) => cb.value);

  if (!name) {
    showToast('Informe o nome da equipe.', 'error');
    return;
  }

  try {
    await post('/groups', { name, color, memberIds });
    closeDialog();
    await store.loadOrganization();
    router.refresh();
    showToast('Equipe criada com sucesso.', 'success');
  } catch (err) {
    showToast(err.message || 'Erro ao criar equipe.', 'error');
  }
}

export function openEditGroupModal(groupId) {
  const state = store.getState();
  const groups = state.groups || [];
  const members = state.members || [];
  const group = groups.find((g) => g.id === groupId);

  if (!group) {
    showToast('Equipe não encontrada.', 'error');
    return;
  }
  if (group.isDefault || group.name === 'Geral') {
    showToast('A equipe padrão Geral não pode ser editada.', 'info');
    return;
  }

  const groupColor = group.color || '#581c43';
  const groupMemberIds = new Set(group.memberIds || []);

  const content = `
    <form id="edit-group-form">
      <div class="form-group mb-3">
        <label class="form-label" for="g-edit-name">Nome da equipe ou segmento <span class="color-danger">*</span></label>
        <input type="text" id="g-edit-name" name="name" class="form-input" value="${attr(group.name)}" required autofocus>
      </div>

      <div class="form-group mb-4">
        <label class="form-label">Cor identificadora</label>
        <div class="group-color-swatches" id="group-color-swatches">
          ${CURATED_COLORS.map((c) => `
            <button type="button" class="swatch-btn ${c.hex.toLowerCase() === groupColor.toLowerCase() ? 'active' : ''}" data-color="${c.hex}" data-action="pick-team-color" title="${c.name}" aria-label="${c.name}"></button>
          `).join('')}
        </div>
        <input type="hidden" id="g-color" name="color" value="${attr(groupColor)}">
      </div>

      <div class="team-preview-card mb-4" id="team-preview-card">
        <div class="flex items-center gap-2">
          <span class="group-dot" id="team-preview-dot" data-color="${attr(groupColor)}"></span>
          <strong id="team-preview-name">${esc(group.name)}</strong>
        </div>
        <span class="badge badge-neutral" id="team-preview-count">${groupMemberIds.size} integrantes</span>
      </div>

      <div id="team-privacy-indicator" class="privacy-notice ${groupMemberIds.size < 5 ? 'privacy-warning' : 'privacy-success'}">
        <i class="fa-solid ${groupMemberIds.size < 5 ? 'fa-shield-halved' : 'fa-circle-check'}" aria-hidden="true"></i>
        <div>
          <strong>${groupMemberIds.size < 5 ? 'Equipe com poucos integrantes' : 'Elegível para relatório individual'}</strong>
          <p class="m-0 text-xs">
            ${groupMemberIds.size < 5
              ? 'Adicione mais colaboradores para que esta equipe gere relatório próprio nos ciclos de pesquisa.'
              : 'Esta equipe terá visualização própria de fatores e relatórios nos ciclos de pesquisa.'}
          </p>
        </div>
      </div>

      <div class="form-group mb-1">
        <div class="flex items-center justify-between mb-1">
          <label class="form-label m-0">Colaboradores vinculados</label>
          <span class="text-xs color-text-muted" id="team-selected-counter">${groupMemberIds.size} selecionados</span>
        </div>

        <div class="member-picker-box">
          <div class="member-picker-search flex items-center justify-between gap-2">
            <input type="search" id="team-member-search" class="form-input form-input-sm flex-1" placeholder="Filtrar colaboradores por nome ou e-mail..." aria-label="Filtrar colaboradores">
            <div class="flex gap-1">
              <button type="button" class="btn btn-ghost btn-sm" data-action="select-all-team-members">Todos</button>
              <button type="button" class="btn btn-ghost btn-sm" data-action="clear-all-team-members">Limpar</button>
            </div>
          </div>
          <div class="member-picker-list" id="team-member-picker-list">
            ${members.length === 0 ? `
              <div class="p-4 text-center text-xs color-text-muted">
                Nenhum colaborador cadastrado.
              </div>
            ` : members.map((m) => {
              const isChecked = groupMemberIds.has(m.id);
              return `
                <label class="member-picker-item" data-member-name="${attr((m.name || '').toLowerCase())}" data-member-email="${attr((m.email || '').toLowerCase())}">
                  <input type="checkbox" name="memberIds" value="${attr(m.id)}" class="team-member-checkbox" ${isChecked ? 'checked' : ''} data-action="toggle-team-member">
                  <span class="member-avatar-chip">${esc((m.name || 'C').slice(0, 2).toUpperCase())}</span>
                  <div class="flex-1 min-w-0">
                    <div class="text-xs font-semibold color-text-primary text-truncate">${esc(m.name)}</div>
                    <div class="text-xs color-text-secondary text-truncate">${esc(m.email)}</div>
                  </div>
                </label>
              `;
            }).join('')}
          </div>
        </div>
      </div>
    </form>
  `;

  const footer = `
    <button type="button" class="btn btn-secondary" data-action="close-dialog">Cancelar</button>
    <button type="button" class="btn btn-primary" data-action="submit-edit-group" data-id="${attr(group.id)}" id="submit-edit-group-btn">
      Salvar Alterações (${groupMemberIds.size})
    </button>
  `;

  openDialog({
    title: 'Editar Equipe ou Segmento',
    content,
    footer,
    size: 'md'
  });

  setupTeamModalEvents(true);
}

export async function submitEditGroup(groupId) {
  const form = document.getElementById('edit-group-form');
  if (!form) return;

  const name = form.name.value.trim();
  const color = form.color.value;
  const checkboxes = form.querySelectorAll('.team-member-checkbox:checked');
  const memberIds = Array.from(checkboxes).map((cb) => cb.value);

  if (!name) {
    showToast('Informe o nome da equipe.', 'error');
    return;
  }

  try {
    await put(`/groups/${groupId}`, { name, color, memberIds });
    closeDialog();
    await store.loadOrganization();
    router.refresh();
    showToast('Equipe atualizada com sucesso.', 'success');
  } catch (err) {
    showToast(err.message || 'Erro ao atualizar equipe.', 'error');
  }
}

export function openDeleteGroupConfirm(groupId) {
  const group = (store.getState().groups || []).find((g) => g.id === groupId);
  if (!group) return;

  if (group.isDefault || group.name === 'Geral') {
    showToast('O grupo Geral é automático e não pode ser excluído.', 'error');
    return;
  }

  const content = `
    <div class="p-2">
      <p class="text-sm color-text-primary mb-3">
        Tem certeza que deseja excluir a equipe <strong>${esc(group.name)}</strong>?
      </p>
      <div class="privacy-notice privacy-warning">
        <i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i>
        <div>
          <strong>Informação importante</strong>
          <p class="m-0 text-xs">Os colaboradores vinculados a esta equipe não serão excluídos da organização; eles apenas deixarão de pertencer a este recorte.</p>
        </div>
      </div>
    </div>
  `;

  const footer = `
    <button type="button" class="btn btn-secondary" data-action="close-dialog">Cancelar</button>
    <button type="button" class="btn btn-danger" data-action="confirm-delete-group" data-id="${attr(group.id)}">
      <i class="fa-solid fa-trash" aria-hidden="true"></i> Excluir Equipe
    </button>
  `;

  openDialog({ title: 'Excluir Equipe', content, footer });
}

export async function confirmDeleteGroup(groupId) {
  try {
    await del(`/groups/${groupId}`);
    closeDialog();
    await store.loadOrganization();
    router.refresh();
    showToast('Equipe excluída com sucesso.', 'success');
  } catch (err) {
    showToast(err.message || 'Erro ao excluir equipe.', 'error');
  }
}


