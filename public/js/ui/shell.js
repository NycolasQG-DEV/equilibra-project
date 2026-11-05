/* Main application shell layout */

import { esc, attr } from '../domain/formatters.js';
import { roleLabels } from '../domain/labels.js';

function getInitials(name) {
  if (!name || typeof name !== 'string') return 'U';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'U';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function renderShell({
  activePath = 'hoje',
  breadcrumbs = [],
  content = '',
  state = {}
}) {
  const account = state.account;
  const isViewer = account?.role === 'viewer';
  const userName = account?.name || account?.email?.split('@')[0] || 'Usuário';
  const initials = getInitials(userName);
  const roleName = roleLabels[account?.role] || (account?.role === 'owner' ? 'Administrador' : account?.role) || '';

  const navItems = [
    { key: 'hoje', path: 'hoje', label: 'Hoje', icon: 'table-cells-large' },
    ...(!isViewer ? [{ key: 'organizacao', path: 'organizacao/pessoas', label: 'Organização', icon: 'users' }] : []),
    { key: 'pesquisas', path: 'pesquisas', label: 'Pesquisas', icon: 'clipboard-list' },
    { key: 'resultados', path: 'resultados/ciclos', label: 'Resultados', icon: 'chart-column' },
    { key: 'acoes', path: 'acoes', label: 'Planos de Ação', icon: 'list-check' },
    { key: 'configuracoes', path: 'configuracoes/conta', label: 'Configurações', icon: 'gear' }
  ];

  const currentSection = activePath.split('/')[0];

  const navHtml = navItems.map((item) => {
    const isCurrent = currentSection === item.key;
    return `
      <a href="#${item.path}" class="app-nav-link" ${isCurrent ? 'aria-current="page"' : ''}>
        <i class="fa-solid fa-${item.icon}" aria-hidden="true"></i>
        <span>${esc(item.label)}</span>
      </a>
    `;
  }).join('');

  // Breadcrumbs
  let breadcrumbHtml = '';
  if (breadcrumbs && breadcrumbs.length > 0) {
    breadcrumbHtml = `
      <nav class="app-breadcrumb-bar" aria-label="Navegação estrutural">
        <div class="app-breadcrumb-inner">
          <a href="#hoje" class="app-breadcrumb-link">Início</a>
          ${breadcrumbs.map((b, i) => {
            const isLast = i === breadcrumbs.length - 1;
            return `
              <span class="breadcrumb-separator" aria-hidden="true">/</span>
              ${isLast || !b.path ? `
                <span class="app-breadcrumb-current" aria-current="page">${esc(b.label)}</span>
              ` : `
                <a href="#${attr(b.path)}" class="app-breadcrumb-link">${esc(b.label)}</a>
              `}
            `;
          }).join('')}
        </div>
      </nav>
    `;
  }

  return `
    <div class="app-shell">
      <a href="#main-content" class="skip-link">Ir para o conteúdo principal</a>

      <header class="app-header">
        <div class="app-header-inner">
          <div class="flex items-center gap-3">
            <button type="button" class="mobile-nav-toggle" data-action="toggle-mobile-drawer" aria-label="Abrir menu de navegação">
              <i class="fa-solid fa-bars" aria-hidden="true"></i>
            </button>
            <a href="#hoje" class="app-brand" aria-label="Equilibra - Página inicial">
              <i class="fa-solid fa-scale-balanced" aria-hidden="true"></i>
              <span>Equilibra</span>
            </a>
          </div>

          <nav class="app-nav" aria-label="Navegação principal">
            ${navHtml}
          </nav>

          <div class="app-user-menu">
            <a href="#configuracoes/conta" class="app-profile-badge" title="Meu Perfil e Configurações">
              ${account?.avatarUrl ? `
                <img src="${attr(account.avatarUrl)}" alt="${attr(userName)}" class="app-avatar-img" />
              ` : `
                <div class="app-avatar-fallback">${esc(initials)}</div>
              `}
              <div class="app-user-info">
                <span class="app-user-name">${esc(userName)}</span>
                ${roleName ? `<span class="app-user-role">${esc(roleName)}</span>` : ''}
              </div>
            </a>
            <button type="button" class="btn btn-ghost btn-sm app-logout-btn" data-action="logout" title="Encerrar sessão">
              <i class="fa-solid fa-arrow-right-from-bracket" aria-hidden="true"></i>
              <span class="sr-only">Sair</span>
            </button>
          </div>
        </div>
      </header>

      ${breadcrumbHtml}

      <main id="main-content" class="app-main">
        ${content}
      </main>

      <!-- Mobile drawer -->
      <div id="mobile-drawer" class="mobile-drawer" role="dialog" aria-modal="true" aria-label="Menu móvel">
        <div class="mobile-drawer-backdrop" data-action="toggle-mobile-drawer"></div>
        <div class="mobile-drawer-content">
          <div class="flex items-center justify-between pb-3 border-b">
            <span class="app-brand">
              <i class="fa-solid fa-scale-balanced" aria-hidden="true"></i> Equilibra
            </span>
            <button type="button" class="btn btn-ghost btn-icon" data-action="toggle-mobile-drawer" aria-label="Fechar menu">
              <i class="fa-solid fa-xmark" aria-hidden="true"></i>
            </button>
          </div>
          <nav class="flex flex-col gap-2">
            ${navItems.map(item => `
              <a href="#${item.path}" class="app-nav-link" data-action="toggle-mobile-drawer">
                <i class="fa-solid fa-${item.icon}" aria-hidden="true"></i>
                <span>${esc(item.label)}</span>
              </a>
            `).join('')}
          </nav>
        </div>
      </div>
    </div>
  `;
}
