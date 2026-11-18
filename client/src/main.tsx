import React, { useEffect, useState, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
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
            const ws = await get<{ onboardingContext: unknown }>('/management/workspace');
            if (!ws.onboardingContext) {
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
        const ws = await get<{ onboardingContext: unknown }>('/management/workspace');
        if (!ws.onboardingContext) {
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
          <div className="p-8 max-w-2xl mx-auto text-center space-y-3">
            <i className="fa-solid fa-gear text-4xl color-text-muted" aria-hidden="true" />
            <h2 className="text-lg font-bold text-primary">Configurações do Workspace</h2>
            <p className="text-xs color-text-secondary leading-relaxed">
              Gestão de credenciais, parâmetros de retenção LGPD, notificações por e-mail/WhatsApp e preferências
              de faturamento da empresa <strong>{user.companyName}</strong>.
            </p>
            <div className="pt-4 flex justify-center gap-3">
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => navigateTo('onboarding')}
              >
                <i className="fa-solid fa-sliders mr-1" aria-hidden="true" /> Revisar Perfil da Empresa
              </button>
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
            onOpenNewAction={() => setActionModalOpen(true)}
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
