import React from 'react';

interface ShellProps {
  currentRoute: string;
  user?: { name: string; email: string; companyName: string; role?: string } | null;
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
    { id: 'hoje', label: 'Hoje', icon: 'fa-gauge-high', description: 'Painel & Pulso' },
    { id: 'pesquisas', label: 'Pesquisas', icon: 'fa-clipboard-list', description: 'Ciclos de Escuta' },
    { id: 'evidencias', label: 'Evidências', icon: 'fa-folder-open', description: 'AEP Multimétodo' },
    { id: 'resultados', label: 'Diagnóstico', icon: 'fa-chart-pie', description: 'Relatórios & IA' },
    { id: 'riscos', label: 'Riscos NR-1', icon: 'fa-shield-halved', description: 'Matriz 5x5 & Achados' },
    { id: 'acoes', label: 'Plano de Ação', icon: 'fa-list-check', description: 'Medidas 5W2H' },
    { id: 'organizacao', label: 'Organização', icon: 'fa-building-user', description: 'Colaboradores & Setores' },
    { id: 'configuracoes', label: 'Configurações', icon: 'fa-gear', description: 'Conta & Integrações' },
  ];

  const initials = user?.name
    ? user.name
      .trim()
      .split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase()
    : 'G';

  return (
    <div className="shell-layout">
      {/* Sidebar Lateral */}
        <aside className="shell-sidebar" aria-label="Menu principal">
          {/* Brand */}
          <div className="shell-brand">
            <div className="shell-brand-icon-wrap">
              <i className="fa-solid fa-scale-balanced shell-brand-icon" aria-hidden="true" />
            </div>
            <div className="shell-brand-info">
              <span className="shell-brand-title">Equilibra</span>
              <span className="shell-brand-sub">Riscos Psicossociais</span>
            </div>
          </div>

          {/* Nav */}
          <nav className="shell-nav" aria-label="Navegação principal">
            {navItems.map((item) => {
              const isActive = currentRoute === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`shell-nav-link ${isActive ? 'active' : ''}`}
                  onClick={() => onNavigate(item.id)}
                  title={item.description}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <i className={`fa-solid ${item.icon} shell-nav-icon`} aria-hidden="true" />
                  <span className="shell-nav-label">{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Footer do Sidebar */}
          <div className="shell-sidebar-footer">
            <div className="shell-user-card">
                <div className="shell-user-avatar" aria-hidden="true">
                  {initials}
                </div>
                <div className="shell-user-details">
                  <span className="shell-user-name" title={user?.name}>{user?.name || 'Gestor'}</span>
                  <span className="shell-user-company" title={user?.companyName}>
                    {user?.companyName || 'Empresa'}
                  </span>
                </div>
              </div>
              <button
                type="button"
                className="shell-logout-btn"
                onClick={onLogout}
                title="Sair do sistema"
                aria-label="Sair"
              >
                <i className="fa-solid fa-right-from-bracket" aria-hidden="true" />
              </button>
            </div>
        </aside>

        {/* Conteúdo Principal */}
          <main className="shell-content" id="main-content">
            <div className="shell-viewport">{children}</div>
          </main>
        </div>
        );
};
