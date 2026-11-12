import React from 'react';

interface ShellProps {
  currentRoute: string;
  user?: { name: string; email: string; companyName: string } | null;
  children: React.ReactNode;
  onNavigate: (route: string) => void;
  onLogout: () => void;
}

export const Shell: React.FC<ShellProps> = ({
  currentRoute,
  user,
  children,
  onNavigate,
  onLogout,
}) => {
  const navItems = [
    { id: 'hoje', label: 'Hoje & Pulso', icon: 'fa-heart-pulse' },
    { id: 'pesquisas', label: 'Pesquisas & Ciclos', icon: 'fa-clipboard-list' },
    { id: 'resultados', label: 'Diagnóstico & IA', icon: 'fa-chart-pie' },
    { id: 'acoes', label: 'Plano de Ação', icon: 'fa-list-check' },
    { id: 'organizacao', label: 'Organização', icon: 'fa-building-user' },
    { id: 'configuracoes', label: 'Configurações', icon: 'fa-gear' },
  ];

  return (
    <div className="shell-layout">
      {/* Sidebar Lateral */}
      <aside className="shell-sidebar">
        <div className="shell-brand">
          <i className="fa-solid fa-scale-balanced shell-brand-icon" aria-hidden="true" />
          <div className="shell-brand-info">
            <span className="shell-brand-title">Equilibra</span>
            <span className="shell-brand-sub">SST Psicossocial</span>
          </div>
        </div>

        <nav className="shell-nav" aria-label="Navegação principal">
          {navItems.map((item) => {
            const isActive = currentRoute === item.id || currentRoute.startsWith(`${item.id}/`);
            return (
              <button
                key={item.id}
                type="button"
                className={`shell-nav-link ${isActive ? 'active' : ''}`}
                onClick={() => onNavigate(item.id)}
              >
                <i className={`fa-solid ${item.icon} shell-nav-icon`} aria-hidden="true" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="shell-sidebar-footer">
          <div className="shell-user-card">
            <div className="shell-user-avatar">
              <i className="fa-solid fa-user" aria-hidden="true" />
            </div>
            <div className="shell-user-details">
              <span className="shell-user-name">{user?.name || 'Gestor'}</span>
              <span className="shell-user-company">{user?.companyName || 'Empresa'}</span>
            </div>
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-sm shell-logout-btn"
            onClick={onLogout}
            title="Sair do sistema"
          >
            <i className="fa-solid fa-right-from-bracket" aria-hidden="true" />
          </button>
        </div>
      </aside>

      {/* Conteúdo Principal */}
      <main className="shell-content">
        <header className="shell-topbar">
          <div className="shell-topbar-breadcrumb">
            <span className="color-text-muted">Equilibra</span>
            <i className="fa-solid fa-chevron-right text-xs color-text-muted" aria-hidden="true" />
            <span className="font-semibold">{currentRoute.toUpperCase()}</span>
          </div>
        </header>

        <div className="shell-viewport">{children}</div>
      </main>
    </div>
  );
};
