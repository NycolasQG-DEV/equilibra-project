/* Settings feature: Account, Team, Subscription, Data & Retention */

import { renderShell } from '../../ui/shell.js';
import { esc, attr } from '../../domain/formatters.js';
import { roleLabels } from '../../domain/labels.js';
import { store } from '../../core/store.js';
import { field } from '../../ui/fields.js';
import { post } from '../../core/api.js';
import { showToast } from '../../ui/toast.js';
import { router } from '../../core/router.js';

const ROLE_BADGE = {
  owner: 'badge-primary',
  editor: 'badge-success',
  viewer: 'badge-neutral'
};

function renderTeamSection(account, team) {
  const isOwner = account.role === 'owner';
  const users = team?.users || [];
  const invitations = (team?.invitations || []).filter(
    (inv) => !inv.usedAt && inv.expiresAt > Date.now()
  );

  const userRows = users.map((u) => {
    const isSelf = u.id === account.userId;
    const badgeClass = ROLE_BADGE[u.role] || 'badge-neutral';
    return `
      <tr>
        <td>
          <strong>${esc(u.name)}</strong>
          ${isSelf ? '<span class="badge badge-info ml-1">Você</span>' : ''}
          ${u.disabled ? '<span class="badge badge-danger ml-1">Desativado</span>' : ''}
        </td>
        <td>${esc(u.email)}</td>
        <td><span class="badge ${badgeClass}">${esc(roleLabels[u.role] || u.role)}</span></td>
        <td class="text-right">
          ${isOwner && !isSelf ? `
            <div class="table-actions-inline">
              <select class="form-select form-select-sm"
                data-action="change-team-role"
                data-id="${attr(u.id)}"
                aria-label="Alterar papel de ${esc(u.name)}">
                <option value="editor" ${u.role === 'editor' ? 'selected' : ''}>Editor</option>
                <option value="viewer" ${u.role === 'viewer' ? 'selected' : ''}>Visualizador</option>
              </select>
              <button type="button"
                class="btn btn-ghost btn-sm color-danger"
                data-action="remove-team-member"
                data-id="${attr(u.id)}"
                data-name="${attr(u.name)}"
                title="Desativar acesso de ${esc(u.name)}">
                <i class="fa-solid fa-user-minus" aria-hidden="true"></i>
              </button>
            </div>
          ` : '<span class="color-muted text-xs">—</span>'}
        </td>
      </tr>
    `;
  }).join('');

  const inviteRows = invitations.length === 0 ? '' : `
    <div class="mt-4">
      <h3 class="card-title mb-3 text-sm">Convites Pendentes</h3>
      <div class="table-wrap table-borderless">
        <table class="table">
          <thead>
            <tr>
              <th>E-mail Convidado</th>
              <th>Papel</th>
              <th>Expira em</th>
              ${isOwner ? '<th class="text-right">Ações</th>' : ''}
            </tr>
          </thead>
          <tbody>
            ${invitations.map((inv) => {
              const expiresDate = new Date(inv.expiresAt).toLocaleDateString('pt-BR');
              return `
                <tr>
                  <td>${esc(inv.email)}</td>
                  <td><span class="badge badge-neutral">${esc(roleLabels[inv.role] || inv.role)}</span></td>
                  <td><span class="color-muted text-xs">${expiresDate}</span></td>
                  ${isOwner ? `
                    <td class="text-right">
                      <div class="table-actions-inline">
                        ${inv.token ? `
                          <button type="button"
                            class="btn btn-ghost btn-sm"
                            data-action="copy-invite-link"
                            data-token="${attr(inv.token)}"
                            title="Copiar link de convite">
                            <i class="fa-regular fa-copy" aria-hidden="true"></i> Copiar Link
                          </button>
                        ` : ''}
                        <button type="button"
                          class="btn btn-ghost btn-sm color-danger"
                          data-action="revoke-team-invitation"
                          data-id="${attr(inv.id)}"
                          title="Revogar convite para ${esc(inv.email)}">
                          <i class="fa-solid fa-ban" aria-hidden="true"></i> Revogar
                        </button>
                      </div>
                    </td>
                  ` : ''}
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;

  return `
    <div class="card">
      <div class="card-header">
        <h2 class="card-title">Equipe Interna</h2>
        ${isOwner ? `
          <button type="button" class="btn btn-primary btn-sm" data-action="open-invite-user-modal">
            <i class="fa-solid fa-user-plus" aria-hidden="true"></i> Convidar Membro
          </button>
        ` : ''}
      </div>
      <div class="card-body">
        <div class="privacy-notice privacy-info mb-4">
          <i class="fa-solid fa-circle-info" aria-hidden="true"></i>
          <div>
            <strong>Papéis e permissões</strong>
            <p class="m-0 text-xs">
              <strong>Administrador:</strong> acesso total. &nbsp;
              <strong>Editor:</strong> cria pesquisas e gerencia ciclos, mas não gerencia equipe. &nbsp;
              <strong>Visualizador:</strong> apenas leitura de relatórios e dados — sem ações de escrita.
            </p>
          </div>
        </div>

        <div class="table-wrap table-borderless">
          <table class="table">
            <thead>
              <tr>
                <th>Nome</th>
                <th>E-mail</th>
                <th>Papel</th>
                ${isOwner ? '<th class="text-right">Ações</th>' : ''}
              </tr>
            </thead>
            <tbody>${userRows}</tbody>
          </table>
        </div>

        ${inviteRows}
      </div>
    </div>
  `;
}

function getInitials(name) {
  if (!name || typeof name !== 'string') return 'U';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'U';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function renderSettings({ params, state }) {
  const section = params.section || 'conta';
  const account = state.account || {};
  const meta = state.meta || {};
  const team = state.team || { users: [], invitations: [] };
  const isOwner = account.role === 'owner';
  const isViewer = account.role === 'viewer';

  let sectionContent = '';

  if (section === 'conta') {
    sectionContent = `
      <!-- Perfil Pessoal & Foto de Perfil -->
      <div class="card mb-8">
        <div class="card-header px-6 py-5">
          <div>
            <h2 class="card-title text-base font-semibold">Perfil do Usuário</h2>
            <p class="text-xs color-text-secondary m-0 mt-0.5">Gerencie sua foto e dados de identificação pessoal</p>
          </div>
        </div>
        <div class="card-body p-6 md:p-8">
          <form id="profile-settings-form" class="settings-form-flow">
            <div class="profile-avatar-section">
              <div class="flex items-center gap-6 flex-wrap">
                <div class="profile-avatar-preview-wrap">
                  ${account.avatarUrl ? `
                    <img id="profile-avatar-preview" src="${attr(account.avatarUrl)}" alt="Foto de perfil" class="profile-avatar-preview" />
                  ` : `
                    <div id="profile-avatar-preview-fallback" class="profile-avatar-preview-fallback">
                      ${esc(getInitials(account.name || 'U'))}
                    </div>
                  `}
                </div>
                <div class="flex-1 min-w-[240px]">
                  <strong class="block text-sm font-semibold mb-1">Foto de Perfil</strong>
                  <p class="table-subtext text-xs mb-3">Foto exibida na barra de navegação e identificação da sua conta.</p>
                  <div class="flex items-center gap-3 flex-wrap">
                    <label for="user-avatar-file" class="btn btn-secondary btn-sm cursor-pointer">
                      <i class="fa-solid fa-camera" aria-hidden="true"></i> Escolher Foto
                    </label>
                    <input type="file" id="user-avatar-file" accept="image/png, image/jpeg, image/webp" class="hidden" data-action="pick-avatar-file" />
                    ${account.avatarUrl ? `
                      <button type="button" class="btn btn-ghost btn-sm color-danger" data-action="remove-avatar-photo">
                        <i class="fa-solid fa-trash-can" aria-hidden="true"></i> Remover
                      </button>
                    ` : ''}
                  </div>
                  <input type="hidden" id="profile-avatar-url" name="avatarUrl" value="${attr(account.avatarUrl || '')}" />
                </div>
              </div>
            </div>

            <div class="settings-fields-grid max-w-2xl">
              ${field({ id: 'acc-user-name', name: 'userName', label: 'Seu Nome Completo', value: account.name || '', required: true })}
              ${field({ id: 'acc-email-display', name: 'userEmail', label: 'E-mail de Acesso', value: account.email || '', type: 'email', disabled: true, hint: 'O e-mail de acesso não pode ser alterado diretamente.' })}
            </div>

            <div class="settings-form-actions">
              <button type="button" class="btn btn-primary" data-action="save-user-profile">
                Salvar Perfil
              </button>
            </div>
          </form>
        </div>
      </div>

      <div class="card mb-8">
        <div class="card-header px-6 py-5">
          <div>
            <h2 class="card-title text-base font-semibold">Dados da Organização</h2>
            <p class="text-xs color-text-secondary m-0 mt-0.5">Informações corporativas visíveis nos relatórios e pesquisas</p>
          </div>
        </div>
        <div class="card-body p-6 md:p-8">
          <form id="account-settings-form" class="settings-form-flow">
            <div class="settings-fields-grid max-w-2xl">
              ${field({ id: 'acc-company', name: 'companyName', label: 'Nome da Empresa', value: meta?.account?.companyName || account?.company || '', required: true, disabled: !isOwner })}
            </div>
            ${isOwner ? `
              <div class="settings-form-actions">
                <button type="button" class="btn btn-primary" data-action="save-company-name">
                  Salvar Alterações
                </button>
              </div>
            ` : ''}
          </form>
        </div>
      </div>

      <div class="card">
        <div class="card-header px-6 py-5">
          <div>
            <h2 class="card-title text-base font-semibold">Alterar Senha</h2>
            <p class="text-xs color-text-secondary m-0 mt-0.5">Mantenha sua conta protegida com uma senha segura</p>
          </div>
        </div>
        <div class="card-body p-6 md:p-8">
          <form id="change-password-form" class="settings-form-flow">
            <div class="settings-fields-grid max-w-2xl">
              ${field({ id: 'pwd-current', name: 'currentPassword', label: 'Senha Atual', type: 'password', required: true })}
              ${field({ id: 'pwd-new', name: 'newPassword', label: 'Nova Senha', type: 'password', required: true })}
            </div>
            <div class="settings-form-actions">
              <button type="button" class="btn btn-secondary" data-action="submit-change-password">
                Atualizar Senha
              </button>
            </div>
          </form>
        </div>
      </div>

      ${isOwner ? `
        <div class="card mt-8 border-danger-subtle">
          <div class="card-header px-6 py-5">
            <div>
              <h2 class="card-title text-base font-semibold color-danger flex items-center gap-2 m-0">
                <i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i> Zona de Perigo: Excluir Conta e Organização
              </h2>
              <p class="text-xs color-text-secondary m-0 mt-0.5">
                Exclui permanentemente todos os dados da empresa, incluindo colaboradores, pesquisas, respostas e relatórios.
              </p>
            </div>
          </div>
          <div class="card-body p-6 md:p-8">
            <p class="text-sm color-muted mb-4">
              Esta ação é <strong>irreversível</strong>. Todos os registros serão removidos definitivamente tanto localmente quanto do banco de dados na nuvem.
            </p>
            <button type="button" class="btn btn-danger" data-action="open-delete-account-modal">
              <i class="fa-solid fa-trash-can" aria-hidden="true"></i> Excluir Minha Conta e Organização
            </button>
          </div>
        </div>
      ` : ''}
    `;
  } else if (section === 'equipe') {
    sectionContent = renderTeamSection(account, team);
  } else if (section === 'dados') {
    sectionContent = `
      <div class="card mb-6">
        <div class="card-header">
          <h2 class="card-title">Políticas de Retenção &amp; Privacidade (LGPD / NR-1)</h2>
        </div>
        <div class="card-body">
          <p class="mb-3">
            <strong>Pseudonimização e Anonimização:</strong> Ao registrar uma resposta em uma pesquisa, os tokens individuais são invalidados para impedir qualquer reidentificação individual.
          </p>
          <p class="mb-3">
            <strong>Quórum de Segurança:</strong> Nenhum relatório ou matriz divulga respostas de grupos com número reduzido de respondentes, garantindo a proteção de todos os participantes.
          </p>
          <p class="m-0">
            <strong>Retenção de Laudos e Planos de Ação:</strong> Conforme os prazos previstos na NR-1, os relatórios e registros de ações preventivas são preservados para fins de comprovação em auditorias e fiscalizações.
          </p>
        </div>
      </div>
    `;
  }

  // Build nav tabs: hide Equipe tab for viewers (they have no team management context)
  const tabs = [
    { key: 'conta', label: 'Conta' },
    ...(!isViewer ? [{ key: 'equipe', label: 'Equipe' }] : []),
    { key: 'dados', label: 'Dados & LGPD' }
  ];

  const content = `
    <div class="settings-page">
      <div class="mb-4">
        <h1 class="view-title">Configurações</h1>
        <p class="view-subtitle">
          Preferências da organização, equipe interna e conformidade de dados
        </p>
      </div>

      <nav class="tabs-nav mb-6" aria-label="Seções de configurações">
        ${tabs.map((t) => `
          <a href="#configuracoes/${attr(t.key)}" class="tab-link"
            ${section === t.key ? 'aria-current="page"' : ''}>
            ${esc(t.label)}
          </a>
        `).join('')}
      </nav>

      ${sectionContent}
    </div>
  `;

  return renderShell({
    activePath: `configuracoes/${section}`,
    breadcrumbs: [{ label: 'Configurações' }, { label: section === 'conta' ? 'Conta' : section === 'equipe' ? 'Equipe' : 'Dados' }],
    content,
    state
  });
}

// ── Invite Modal ──
export function openInviteUserModal() {
  const content = `
    <form id="invite-user-form">
      ${field({ id: 'inv-email', name: 'email', label: 'E-mail do convidado', type: 'email', required: true })}
      <div class="form-group">
        <label class="form-label" for="inv-role">Papel / Permissão</label>
        <select id="inv-role" name="role" class="form-select">
          <option value="editor">Editor — cria pesquisas e gerencia ciclos</option>
          <option value="viewer">Visualizador — apenas leitura de relatórios</option>
        </select>
      </div>
    </form>
  `;

  const footer = `
    <button type="button" class="btn btn-secondary" data-action="close-dialog">Cancelar</button>
    <button type="button" class="btn btn-primary" data-action="submit-invite-user">
      <i class="fa-solid fa-paper-plane" aria-hidden="true"></i> Enviar Convite
    </button>
  `;

  import('../../ui/dialog.js').then(({ openDialog }) => {
    openDialog({ title: 'Convidar Membro da Equipe', content, footer });
  });
}

export function openInviteSuccessModal({ email, role, token }) {
  const fullLink = `${window.location.origin}/#registro?invite=${token}`;
  const roleName = roleLabels[role] || role;

  const content = `
    <div class="py-2">
      <div class="privacy-notice privacy-success mb-4">
        <i class="fa-solid fa-circle-check" aria-hidden="true"></i>
        <div>
          <strong>Convite gerado com sucesso!</strong>
          <p class="m-0 text-xs">
            O convite para <strong>${esc(email)}</strong> como <strong>${esc(roleName)}</strong> foi criado.
          </p>
        </div>
      </div>
      <p class="text-sm mb-3">
        Envie o link abaixo para que o novo membro conclua o cadastro com a permissão correta:
      </p>
      <div class="flex items-center gap-2 mb-3">
        <input type="text" id="generated-invite-link-input" class="input flex-1 font-mono text-xs" value="${attr(fullLink)}" readonly />
        <button type="button" class="btn btn-primary btn-sm" data-action="copy-invite-link" data-token="${attr(token)}">
          <i class="fa-regular fa-copy" aria-hidden="true"></i> Copiar
        </button>
      </div>
      <p class="table-subtext m-0">O link é válido por 7 dias e expira automaticamente após o primeiro uso.</p>
    </div>
  `;

  const footer = `
    <button type="button" class="btn btn-secondary" data-action="close-dialog">Concluir</button>
  `;

  import('../../ui/dialog.js').then(({ openDialog }) => {
    openDialog({ title: 'Link de Convite Criado', content, footer });
  });
}

export async function submitChangePassword() {
  const form = document.getElementById('change-password-form');
  if (!form) return;

  const currentPassword = form.currentPassword?.value || '';
  const newPassword = form.newPassword?.value || '';

  if (!currentPassword) {
    showToast('Informe a senha atual.', 'error');
    form.currentPassword?.focus();
    return;
  }
  if (!newPassword || newPassword.length < 10) {
    showToast('A nova senha deve ter no mínimo 10 caracteres.', 'error');
    form.newPassword?.focus();
    return;
  }

  try {
    await post('/management/account/password', {
      currentPassword,
      password: newPassword
    });
    form.reset();
    showToast('Senha atualizada com sucesso! Faça login novamente com a nova senha.', 'success');
    setTimeout(() => {
      post('/auth/logout', {}).finally(() => {
        store.logout();
        router.navigate('login');
      });
    }, 1500);
  } catch (err) {
    showToast(err.message || 'Erro ao atualizar senha.', 'error');
  }
}
