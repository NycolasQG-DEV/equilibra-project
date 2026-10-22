/* Organization feature: People & Groups management */

import { renderShell } from '../../ui/shell.js';
import { esc, attr } from '../../domain/formatters.js';
import { post, put, del } from '../../core/api.js';
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
      ${field({ id: 'em-phone', name: 'phone', label: 'Telefone (opcional)', value: member.phone || '' })}
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

  try {
    await put(`/members/${memberId}`, { name, email, phone, registration, groupIds });
    await store.loadOrganization();
    closeDialog();
    showToast('Colaborador atualizado com sucesso.', 'success');
  } catch (err) {
    showToast(err.message || 'Erro ao atualizar colaborador.', 'error');
  }
}

export function openDeleteMemberConfirm(memberId) {
  const member = (store.getState().members || []).find((m) => m.id === memberId);
  if (!member) return;

  const content = `
    <div class="p-2">
      <p class="text-sm color-text-primary mb-3">
        Tem certeza que deseja remover o colaborador <strong>${esc(member.name)}</strong> (${esc(member.email)})?
      </p>
      <div class="privacy-notice privacy-warning">
        <i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i>
        <div>
          <strong>Atenção</strong>
          <p class="m-0 text-xs">O colaborador será desvinculado de todas as equipes. O histórico de respostas anônimas previamente submetidas é preservado para segurança estatística.</p>
        </div>
      </div>
    </div>
  `;

  const footer = `
    <button type="button" class="btn btn-secondary" data-action="close-dialog">Cancelar</button>
    <button type="button" class="btn btn-danger" data-action="confirm-delete-member" data-id="${attr(member.id)}">
      <i class="fa-solid fa-trash" aria-hidden="true"></i> Remover Colaborador
    </button>
  `;

  openDialog({ title: 'Remover Colaborador', content, footer });
}

export async function confirmDeleteMember(memberId) {
  try {
    await del(`/members/${memberId}`);
    await store.loadOrganization();
    closeDialog();
    showToast('Colaborador removido com sucesso.', 'success');
  } catch (err) {
    showToast(err.message || 'Erro ao remover colaborador.', 'error');
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
    await store.loadOrganization();
    closeDialog();
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
            <strong>Regra de Anonimato (N < 5)</strong>
            <p class="m-0 text-xs">Equipes com menos de 5 colaboradores são agrupadas em "Demais áreas" nos relatórios para assegurar o sigilo das respostas.</p>
          </div>
        `;
      } else {
        privacyIndicator.className = 'privacy-notice privacy-success';
        privacyIndicator.innerHTML = `
          <i class="fa-solid fa-circle-check" aria-hidden="true"></i>
          <div>
            <strong>Apto para matriz individual (N ≥ 5)</strong>
            <p class="m-0 text-xs">Esta equipe atende ao quórum mínimo e terá visualização própria de fatores e relatórios.</p>
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
          <strong>Regra de Anonimato (N < 5)</strong>
          <p class="m-0 text-xs">Equipes com menos de 5 colaboradores são agrupadas em "Demais áreas" nos relatórios para assegurar o sigilo das respostas.</p>
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
    await store.loadOrganization();
    closeDialog();
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
          <strong>${groupMemberIds.size < 5 ? 'Regra de Anonimato (N < 5)' : 'Apto para matriz individual (N ≥ 5)'}</strong>
          <p class="m-0 text-xs">
            ${groupMemberIds.size < 5
              ? 'Equipes com menos de 5 colaboradores são agrupadas em "Demais áreas" nos relatórios para assegurar o sigilo das respostas.'
              : 'Esta equipe atende ao quórum mínimo e terá visualização própria de fatores e relatórios.'}
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
    await store.loadOrganization();
    closeDialog();
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
    await store.loadOrganization();
    closeDialog();
    showToast('Equipe excluída com sucesso.', 'success');
  } catch (err) {
    showToast(err.message || 'Erro ao excluir equipe.', 'error');
  }
}
