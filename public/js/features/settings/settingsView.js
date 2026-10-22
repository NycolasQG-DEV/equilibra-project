/* Settings feature: Account, Team, Subscription, Data & Retention */

import { renderShell } from '../../ui/shell.js';
import { esc } from '../../domain/formatters.js';
import { roleLabels } from '../../domain/labels.js';
import { store } from '../../core/store.js';
import { field } from '../../ui/fields.js';

export function renderSettings({ params, state }) {
  const section = params.section || 'conta';
  const account = state.account || {};
  const meta = state.meta || {};
  const management = state.management || {};
  const collaborators = management.collaborators || [];

  let sectionContent = '';

  if (section === 'conta') {
    sectionContent = `
      <div class="card mb-6">
        <div class="card-header">
          <h2 class="card-title">Dados da Organização</h2>
        </div>
        <div class="card-body">
          <form id="account-settings-form">
            ${field({ id: 'acc-company', name: 'companyName', label: 'Nome da Empresa', value: meta.account?.companyName || '', required: true })}
            ${field({ id: 'acc-email', name: 'email', label: 'E-mail do Administrador', value: account.email || '', type: 'email', disabled: true })}
            <button type="button" class="btn btn-primary" data-action="save-company-name">
              Salvar Alterações
            </button>
          </form>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <h2 class="card-title">Alterar Senha</h2>
        </div>
        <div class="card-body">
          <form id="change-password-form">
            ${field({ id: 'pwd-current', name: 'currentPassword', label: 'Senha Atual', type: 'password', required: true })}
            ${field({ id: 'pwd-new', name: 'newPassword', label: 'Nova Senha', type: 'password', required: true })}
            <button type="button" class="btn btn-secondary" data-action="submit-change-password">
              Atualizar Senha
            </button>
          </form>
        </div>
      </div>
    `;
  } else if (section === 'equipe') {
    sectionContent = `
      <div class="card">
        <div class="card-header">
          <h2 class="card-title">Equipe Interna de RH & SST</h2>
          <button type="button" class="btn btn-primary btn-sm" data-action="open-invite-user-modal">
            <i class="fa-solid fa-user-plus" aria-hidden="true"></i> Convidar Membro
          </button>
        </div>
        <div class="card-body p-0">
          <div class="table-wrap table-borderless">
            <table class="table">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>E-mail</th>
                  <th>Papel / Permissão</th>
                </tr>
              </thead>
              <tbody>
                <tr class="bg-subtle">
                  <td><strong>${esc(account.name || 'Administrador')}</strong></td>
                  <td>${esc(account.email)}</td>
                  <td><span class="badge badge-primary">${esc(roleLabels[account.role] || account.role)}</span></td>
                </tr>
                ${collaborators.map(c => `
                  <tr>
                    <td><strong>${esc(c.name)}</strong></td>
                    <td>${esc(c.email)}</td>
                    <td><span class="badge badge-neutral">${esc(roleLabels[c.role] || c.role)}</span></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  } else if (section === 'dados') {
    sectionContent = `
      <div class="card mb-6">
        <div class="card-header">
          <h2 class="card-title">Políticas de Retenção & Privacidade (LGPD / NR-1)</h2>
        </div>
        <div class="card-body">
          <p class="mb-3">
            <strong>Pseudonimização e Anonimização:</strong> Ao registrar uma resposta em uma pesquisa, os tokens individuais são invalidados para impedir qualquer reidentificação individual.
          </p>
          <p class="mb-3">
            <strong>Quórum de Segurança (N ≥ 5):</strong> Nenhum relatório ou matriz divulga respostas de grupos ou interseções com menos de 5 respondentes.
          </p>
          <p class="m-0">
            <strong>Retenção de Laudos e Planos de Ação:</strong> Conforme os prazos previstos na NR-1, os relatórios e registros de ações preventivas são preservados para fins de comprovação em auditorias e fiscalizações.
          </p>
        </div>
      </div>
    `;
  }

  const content = `
    <div class="settings-page">
      <div class="mb-4">
        <h1 class="view-title">Configurações</h1>
        <p class="view-subtitle">
          Preferências da organização, equipe interna e conformidade de dados
        </p>
      </div>

      <nav class="tabs-nav mb-6" aria-label="Seções de configurações">
        <a href="#configuracoes/conta" class="tab-link" ${section === 'conta' ? 'aria-current="page"' : ''}>Conta</a>
        <a href="#configuracoes/equipe" class="tab-link" ${section === 'equipe' ? 'aria-current="page"' : ''}>Equipe</a>
        <a href="#configuracoes/dados" class="tab-link" ${section === 'dados' ? 'aria-current="page"' : ''}>Dados & LGPD</a>
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
