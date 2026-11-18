import React, { useEffect, useState, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/index.css';
import { Shell } from './components/Shell';
import { AuthView } from './views/AuthView';
import { TodayView } from './views/TodayView';
import { SurveysView } from './views/SurveysView';
import { SurveyCreateModal } from './views/SurveyCreateModal';
import { ResultsView } from './views/ResultsView';
import { ActionsView } from './views/ActionsView';
import { OrganizationView } from './views/OrganizationView';
import { OnboardingView } from './views/OnboardingView';
import { EvidenceCollectionView } from './views/EvidenceCollectionView';
import { RiskAssessmentView } from './views/RiskAssessmentView';
import { RespondView } from './views/RespondView';
import { get, post, del } from './core/api';
import type { Survey, Account } from '../../types';

export type Route =
  | 'hoje'
  | 'pesquisas'
  | 'resultados'
  | 'acoes'
  | 'organizacao'
  | 'configuracoes'
  | 'onboarding'
  | 'evidencias'
  | 'riscos'
  | 'responder';

interface AppUser {
  name: string;
  email: string;
  companyName: string;
  role?: string;
}

/**
 * Extrai a rota e possíveis parâmetros da URL do navegador.
 */
function parseUrlRoute(): { route: Route; token?: string; targetId?: string } {
  const pathname = window.location.pathname;

  // 1. Rota pública de resposta (/responder/:token ou /respond/:token)
  const matchRespond = pathname.match(/^\/(?:responder|respond)\/([a-zA-Z0-9_-]+)/);
  if (matchRespond) {
    return { route: 'responder', token: matchRespond[1] };
  }

  // 2. Parâmetro de query ?token=...
  const urlParams = new URLSearchParams(window.location.search);
  const queryToken = urlParams.get('token');
  if (queryToken && pathname.includes('respond')) {
    return { route: 'responder', token: queryToken };
  }

  // 3. Rotas administrativas principais
  const clean = pathname.replace(/^\/+/, '').split('/')[0].toLowerCase();
  const validRoutes: Route[] = [
    'hoje',
    'pesquisas',
    'resultados',
    'acoes',
    'organizacao',
    'configuracoes',
    'onboarding',
    'evidencias',
    'riscos',
  ];

  if (validRoutes.includes(clean as Route)) {
    const targetId = urlParams.get('id') || pathname.split('/')[1] || undefined;
    return { route: clean as Route, targetId };
  }

  return { route: 'hoje' };
}

const App: React.FC = () => {
  const [initialUrl] = useState(() => parseUrlRoute());
  const [route, setRoute] = useState<Route>(initialUrl.route);
  const [respondToken, setRespondToken] = useState<string | undefined>(initialUrl.token);
  const [selectedReportId, setSelectedReportId] = useState<string | undefined>(initialUrl.targetId);

  const [user, setUser] = useState<AppUser | null>(null);
  const [authLoading, setAuthLoading] = useState(initialUrl.route !== 'responder');
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [surveyModalOpen, setSurveyModalOpen] = useState(false);
  const [actionModalOpen, setActionModalOpen] = useState(false);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);

  // ───── 1. Ouvir evento de navegação nativa do navegador (Popstate / Voltar / Avançar) ─────
  useEffect(() => {
    const handlePopState = () => {
      const parsed = parseUrlRoute();
      setRoute(parsed.route);
      setRespondToken(parsed.token);
      setSelectedReportId(parsed.targetId);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // ───── 2. Navegador SPA com atualização real de URL ─────
  const navigateTo = useCallback((newRoute: string, targetId?: string) => {
    const r = newRoute.split('/')[0] as Route;
    setRoute(r);
    setSelectedReportId(targetId);

    const path = targetId ? `/${newRoute}?id=${targetId}` : `/${newRoute}`;
    if (window.location.pathname !== path) {
      window.history.pushState(null, '', path);
    }
  }, []);

  // ───── 3. Carregar surveys abertos ─────
  const loadSurveys = useCallback(async () => {
    try {
      const data = await get<Survey[]>('/surveys');
      if (Array.isArray(data)) setSurveys(data);
    } catch {
      // Silencioso
    }
  }, []);

  // ───── 4. Verificar sessão existente ao montar (se não for rota pública de resposta) ─────
  useEffect(() => {
    if (route === 'responder') {
      setAuthLoading(false);
      return;
    }

    async function checkSession() {
      try {
        const account = await get<Account & { company?: string; companyName?: string }>('/auth/me');
        if (account && account.id) {
          setUser({
            name: account.name,
            email: account.email,
            companyName: account.companyName || (account as any).company || 'Equilibra',
            role: account.role,
          });
          await loadSurveys();

          try {
            const hasOnboarding = (account as any).onboardingContext || sessionStorage.getItem('equilibra_onboarding_skipped') === 'true';
            if (!hasOnboarding) {
              setNeedsOnboarding(true);
            }
          } catch {
            // Ignora
          }
        }
      } catch {
        // Sem sessão ativa
      } finally {
        setAuthLoading(false);
      }
    }

    checkSession();
  }, [route, loadSurveys]);

  // ───── 5. Handler de Login ─────
  const handleLogin = useCallback(
    async (account: Account & { token?: string }) => {
      setUser({
        name: account.name,
        email: account.email,
        companyName: (account as any).company || (account as any).companyName || 'Equilibra',
        role: account.role,
      });

      try {
        const hasOnboarding = (account as any).onboardingContext || sessionStorage.getItem('equilibra_onboarding_skipped') === 'true';
        if (!hasOnboarding) {
          setNeedsOnboarding(true);
          navigateTo('onboarding');
          return;
        }
      } catch {
        // Ignora
      }

      navigateTo('hoje');
      loadSurveys();
    },
    [navigateTo, loadSurveys],
  );

  // ───── 6. Handler de Logout ─────
  const handleLogout = useCallback(async () => {
    try {
      await post('/auth/logout', {});
    } catch {
      // Ignora falha de rede
    }
    setUser(null);
    setSurveys([]);
    setNeedsOnboarding(false);
    navigateTo('hoje');
  }, [navigateTo]);

  // ───── 7. Handler de Exclusão Real de Pesquisa no Servidor ─────
  const handleDeleteSurvey = useCallback(
    async (id: string) => {
      try {
        await del(`/surveys/${id}`);
        setSurveys((prev) => prev.filter((s) => s.id !== id));
      } catch (err: any) {
        alert(err?.data?.error || err?.message || 'Não foi possível excluir a pesquisa.');
      }
    },
    [],
  );

  // ───── 8. Handler de Nova Pesquisa criada ─────
  const handleSurveyCreated = useCallback(() => {
    setSurveyModalOpen(false);
    loadSurveys();
    navigateTo('pesquisas');
  }, [loadSurveys, navigateTo]);

  // ───── Renderização da Rota Pública de Resposta ─────
  if (route === 'responder' && respondToken) {
    return <RespondView token={respondToken} />;
  }

  // ───── Loading inicial ─────
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-subtle">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
            <i className="fa-solid fa-scale-balanced text-primary text-xl animate-pulse" aria-hidden="true" />
          </div>
          <p className="text-xs color-text-muted font-medium">Carregando Equilibra…</p>
        </div>
      </div>
    );
  }

  // ───── Tela de Autenticação ─────
  if (!user) {
    return <AuthView onLogin={handleLogin} />;
  }

  // ───── Onboarding Contextual Obrigatório ─────
  if (needsOnboarding || route === 'onboarding') {
    return (
      <OnboardingView
        onComplete={() => {
          setNeedsOnboarding(false);
          navigateTo('hoje');
          loadSurveys();
        }}
        onSkip={() => {
          sessionStorage.setItem('equilibra_onboarding_skipped', 'true');
          setNeedsOnboarding(false);
          navigateTo('hoje');
          loadSurveys();
        }}
      />
    );
  }

  // ───── Visualizações Administrativas no Shell ─────
  const renderView = () => {
    switch (route) {
      case 'hoje':
        return (
          <TodayView
            user={user}
            onNavigate={(r) => navigateTo(r)}
            onOpenNewSurvey={() => setSurveyModalOpen(true)}
            onOpenNewAction={() => setActionModalOpen(true)}
          />
        );

      case 'pesquisas':
        return (
          <SurveysView
            surveys={surveys}
            onCreateNew={() => setSurveyModalOpen(true)}
            onOpenSurvey={(id) => navigateTo('pesquisas', id)}
            onDeleteSurvey={handleDeleteSurvey}
            onViewResults={(id) => navigateTo('resultados', id)}
          />
        );

      case 'resultados':
        return (
          <ResultsView
            selectedReportId={selectedReportId}
            onNavigateToActions={() => navigateTo('acoes')}
          />
        );

      case 'acoes':
        return <ActionsView />;

      case 'organizacao':
        return <OrganizationView />;

      case 'configuracoes':
        return (
          <div className="page-container space-y-6">
            <div className="page-header">
              <div>
                <h1 className="page-title">Configurações do Workspace</h1>
                <p className="page-subtitle">
                  Gestão da empresa, conformidade LGPD, integrações de comunicação e parâmetros da NR-1 / NR-17.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Card 1: Perfil da Empresa */}
              <div className="card p-5 bg-surface border border-border space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-border">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-surface-subtle color-text-secondary flex items-center justify-center font-bold border border-border">
                      <i className="fa-solid fa-building" aria-hidden="true" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-sm color-text-primary m-0">Perfil Organizacional</h3>
                      <span className="text-[11px] color-text-muted">Dados cadastrais e enquadramento</span>
                    </div>
                  </div>
                  <span className="badge badge-success text-[10px]">Ativo</span>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex justify-between py-1 border-b border-border-subtle">
                    <span className="color-text-muted">Razão Social:</span>
                    <strong className="color-text-primary">{user.companyName}</strong>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border-subtle">
                    <span className="color-text-muted">Gestor Responsável:</span>
                    <span className="color-text-secondary">{user.name}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border-subtle">
                    <span className="color-text-muted">E-mail Corporativo:</span>
                    <span className="color-text-secondary">{user.email}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="color-text-muted">Perfil de Permissão:</span>
                    <span className="badge badge-neutral text-[10px]">{user.role || 'Administrador / SST'}</span>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm w-full"
                    onClick={() => navigateTo('onboarding')}
                  >
                    <i className="fa-solid fa-sliders mr-1" aria-hidden="true" /> Atualizar Contexto & CNAE
                  </button>
                </div>
              </div>

              {/* Card 2: Privacidade & LGPD */}
              <div className="card p-5 bg-surface border border-border space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-border">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-success-subtle text-success flex items-center justify-center font-bold border border-success-border">
                      <i className="fa-solid fa-shield-halved" aria-hidden="true" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-sm color-text-primary m-0">Privacidade & LGPD (NR-1)</h3>
                      <span className="text-[11px] color-text-muted">Anonimização e salvaguardas</span>
                    </div>
                  </div>
                  <span className="badge badge-success text-[10px]">Conforme</span>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex justify-between py-1 border-b border-border-subtle">
                    <span className="color-text-muted">Quórum de Anonimato:</span>
                    <strong className="color-text-primary">Mínimo de 5 respostas</strong>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border-subtle">
                    <span className="color-text-muted">Criptografia em Repouso:</span>
                    <span>HMAC-SHA256 Fail-Closed</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border-subtle">
                    <span className="color-text-muted">Isolamento Multi-tenant:</span>
                    <span>Segregação estrita por Workspace</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="color-text-muted">Auditoria de Expurgo:</span>
                    <span>Logs imutáveis de expurgo seguro</span>
                  </div>
                </div>

                <div className="notice-box notice-box--info text-[11px]">
                  <i className="fa-solid fa-lock notice-icon" aria-hidden="true" />
                  <span>Respostas individuais são irrevogavelmente anonimizadas e agrupadas por setor.</span>
                </div>
              </div>

              {/* Card 3: Canais de Escuta */}
              <div className="card p-5 bg-surface border border-border space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-border">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-surface-subtle color-text-secondary flex items-center justify-center font-bold border border-border">
                      <i className="fa-solid fa-share-nodes" aria-hidden="true" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-sm color-text-primary m-0">Canais de Coleta & Disparo</h3>
                      <span className="text-[11px] color-text-muted">WhatsApp e Web Links</span>
                    </div>
                  </div>
                  <span className="badge badge-neutral text-[10px]">Habilitado</span>
                </div>

                <div className="space-y-2 text-xs color-text-secondary">
                  <div className="p-2 bg-surface-subtle rounded-md flex items-center justify-between border border-border">
                    <span className="flex items-center gap-2">
                      <i className="fa-brands fa-whatsapp text-success text-base" aria-hidden="true" />
                      <strong className="color-text-primary">WhatsApp API (Baileys / Evolution)</strong>
                    </span>
                    <span className="badge badge-success text-[10px]">Pronto</span>
                  </div>
                  <div className="p-2 bg-surface-subtle rounded-md flex items-center justify-between border border-border">
                    <span className="flex items-center gap-2">
                      <i className="fa-solid fa-globe color-text-secondary text-base" aria-hidden="true" />
                      <strong className="color-text-primary">Link Web Individual e Resposta Pública</strong>
                    </span>
                    <span className="badge badge-success text-[10px]">Ativo</span>
                  </div>
                </div>
              </div>

              {/* Card 4: Backup & Snapshot */}
              <div className="card p-5 bg-surface border border-border space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-border">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-surface-subtle color-text-secondary flex items-center justify-center font-bold border border-border">
                      <i className="fa-solid fa-floppy-disk" aria-hidden="true" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-sm color-text-primary m-0">Persistência & Backup</h3>
                      <span className="text-[11px] color-text-muted">Sincronização Cloud & Local</span>
                    </div>
                  </div>
                  <span className="badge badge-neutral text-[10px]">Sincronizado</span>
                </div>

                <p className="text-xs color-text-secondary leading-relaxed m-0">
                  O workspace possui persistência atômica transacional no servidor com suporte a espelhamento contínuo
                  em PostgreSQL gerenciado via Supabase.
                </p>

                <div className="pt-2 flex gap-2">
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm flex-1"
                    onClick={() => navigateTo('hoje')}
                  >
                    <i className="fa-solid fa-gauge-high mr-1" aria-hidden="true" /> Ir para o Painel
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm flex-1"
                    onClick={() => navigateTo('pesquisas')}
                  >
                    <i className="fa-solid fa-clipboard-list mr-1" aria-hidden="true" /> Ver Pesquisas
                  </button>
                </div>
              </div>
            </div>
          </div>
        );

      case 'evidencias':
        return <EvidenceCollectionView />;

      case 'riscos':
        return <RiskAssessmentView />;

      default:
        return (
          <TodayView
            user={user}
            onNavigate={(r) => navigateTo(r)}
            onOpenNewSurvey={() => setSurveyModalOpen(true)}
            onOpenNewAction={() => navigateTo('acoes')}
          />
        );
    }
  };

  return (
    <>
      <Shell
        currentRoute={route}
        user={user}
        onNavigate={(r) => navigateTo(r)}
        onLogout={handleLogout}
      >
        {renderView()}
      </Shell>

      <SurveyCreateModal
        isOpen={surveyModalOpen}
        onClose={() => setSurveyModalOpen(false)}
        onSuccess={handleSurveyCreated}
      />
    </>
  );
};

const container = document.getElementById('root');
if (container) {
  createRoot(container).render(<App />);
}
