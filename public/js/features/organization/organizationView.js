/* Organization feature: People & Groups management */

import { renderShell } from '../../ui/shell.js';
import { esc, attr } from '../../domain/formatters.js';
import { post } from '../../core/api.js';
import { store } from '../../core/store.js';
import { openDialog, closeDialog } from '../../ui/dialog.js';
import { showToast } from '../../ui/toast.js';
import { field } from '../../ui/fields.js';

export function renderPeople({ state }) {
  const members = state.members || [];
  const groups = state.groups || [];
  const filterGroupId = state.filterGroupId;

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
        <div class="flex gap-2">
          <button type="button" class="btn btn-secondary" data-action="open-import-modal">
            <i class="fa-solid fa-file-import" aria-hidden="true"></i> Importar Planilha
          </button>
          <button type="button" class="btn btn-primary" data-action="open-add-member-modal">
            <i class="fa-solid fa-user-plus" aria-hidden="true"></i> Adicionar Colaborador
          </button>
        </div>
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

      <div class="table-wrap">
        <table class="table" id="members-table">
          <thead>
            <tr>
              <th>Nome</th>
              <th>E-mail</th>
              <th>Matrícula</th>
              <th>Grupos / Segmentos</th>
              <th class="text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            ${filteredMembers.length === 0 ? `
              <tr>
                <td colspan="5" class="table-empty-cell">
                  Nenhum colaborador encontrado com os filtros selecionados.
                </td>
              </tr>
            ` : filteredMembers.map(m => {
              const memberGroups = groups.filter(g => (m.groupIds || []).includes(g.id) || g.id === m.groupId);
              return `
                <tr data-member-id="${attr(m.id)}" data-member-name="${attr(m.name?.toLowerCase())}" data-member-email="${attr(m.email?.toLowerCase())}">
                  <td><strong>${esc(m.name)}</strong></td>
                  <td>${esc(m.email)}</td>
                  <td>${esc(m.registration || '—')}</td>
                  <td>
                    ${memberGroups.map(g => `
                      <span class="badge badge-neutral mr-1">${esc(g.name)}</span>
                    `).join('') || '<span class="color-muted">Sem grupo</span>'}
                  </td>
                  <td class="text-right">
                    <button type="button" class="btn btn-ghost btn-sm" data-action="edit-member" data-id="${attr(m.id)}">
                      Editar
                    </button>
                    <button type="button" class="btn btn-ghost btn-sm color-danger" data-action="delete-member" data-id="${attr(m.id)}">
                      Remover
                    </button>
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

  const content = `
    <div class="org-page">
      <div class="flex items-center justify-between mb-4">
        <div>
          <h1 class="view-title">Organização</h1>
          <p class="view-subtitle">
            Gestão de grupos, áreas e segmentos organizacionais
          </p>
        </div>
        <div class="flex gap-2">
          <button type="button" class="btn btn-primary" data-action="open-add-group-modal">
            <i class="fa-solid fa-folder-plus" aria-hidden="true"></i> Novo Grupo
          </button>
        </div>
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
              <th>Privacidade (Mínimo N ≥ 5)</th>
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
                      <span class="badge badge-warning" title="Grupos com menos de 5 pessoas são agrupados automaticamente em 'Demais áreas' nos relatórios">
                        <i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i> Abaixo do mínimo (N < 5)
                      </span>
                    ` : `
                      <span class="badge badge-success">
                        <i class="fa-solid fa-check" aria-hidden="true"></i> Apto para matriz individual
                      </span>
                    `}
                  </td>
                  <td class="text-right">
                    <button type="button" class="btn btn-ghost btn-sm" data-action="edit-group" data-id="${attr(g.id)}">
                      Editar
                    </button>
                    ${!isGeneral ? `
                      <button type="button" class="btn btn-ghost btn-sm color-danger" data-action="delete-group" data-id="${attr(g.id)}">
                        Excluir
                      </button>
                    ` : ''}
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
  const email = form.email.value.trim();
  const registration = form.registration.value.trim();
  const groupCheckboxes = form.querySelectorAll('input[name="groupIds"]:checked');
  const groupIds = Array.from(groupCheckboxes).map(cb => cb.value);

  if (!name || !email) {
    showToast('Preencha o nome e o e-mail.', 'error');
    return;
  }

  try {
    await post('/members', { name, email, registration, groupIds });
    await store.loadOrganization();
    closeDialog();
    showToast('Colaborador adicionado com sucesso.', 'success');
  } catch (err) {
    showToast(err.message || 'Erro ao cadastrar.', 'error');
  }
}

export function openAddGroupModal() {
  const content = `
    <form id="add-group-form">
      ${field({ id: 'g-name', name: 'name', label: 'Nome do grupo / área', required: true, placeholder: 'ex: Operações, Financeiro' })}
      ${field({ id: 'g-color', name: 'color', label: 'Cor identificadora', type: 'color', value: '#581c43' })}
    </form>
  `;

  const footer = `
    <button type="button" class="btn btn-secondary" data-action="close-dialog">Cancelar</button>
    <button type="button" class="btn btn-primary" data-action="submit-add-group">Criar Grupo</button>
  `;

  openDialog({ title: 'Novo Grupo', content, footer });
}

export async function submitAddGroup() {
  const form = document.getElementById('add-group-form');
  if (!form) return;

  const name = form.name.value.trim();
  const color = form.color.value;

  if (!name) {
    showToast('Informe o nome do grupo.', 'error');
    return;
  }

  try {
    await post('/groups', { name, color });
    await store.loadOrganization();
    closeDialog();
    showToast('Grupo criado com sucesso.', 'success');
  } catch (err) {
    showToast(err.message || 'Erro ao criar grupo.', 'error');
  }
}
