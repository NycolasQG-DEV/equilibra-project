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
import { get, post } from './core/api';
import type { Survey, Account } from '../../types';

type Route =
  | 'hoje'
  | 'pesquisas'
  | 'pesquisas/nova'
  | 'resultados'
  | 'acoes'
  | 'organizacao'
  | 'configuracoes'
  | 'onboarding'
  | 'evidencias';

interface AppUser {
  name: string;
  email: string;
  companyName: string;
  role?: string;
}

const App: React.FC = () => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [route, setRoute] = useState<Route>('hoje');
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [surveyModalOpen, setSurveyModalOpen] = useState(false);
  const [actionModalOpen, setActionModalOpen] = useState(false);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);

  // ───── 1. Verificar sessão existente ao montar ─────
  useEffect(() => {
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
          // Verificar se precisa de onboarding
          try {
            const ws = await get<{ onboardingContext: unknown }>('/management/workspace');
            if (!ws.onboardingContext) {
              setNeedsOnboarding(true);
            }
          } catch {
            // Ignora — não bloqueia o app
          }
        }
      } catch {
        // Sem sessão — mostra AuthView
      } finally {
        setAuthLoading(false);
      }
    }

    checkSession();
  }, []);

  // ───── 2. Carregar surveys abertos ─────
  const loadSurveys = async () => {
    try {
      const data = await get<Survey[]>('/surveys');
      if (Array.isArray(data)) setSurveys(data);
    } catch {
      // Silencioso — TodayView tem seu próprio fetch
    }
  };

  // ───── 3. Handler de Login ─────
  const handleLogin = useCallback(async (account: Account & { token?: string }) => {
    setUser({
      name: account.name,
      email: account.email,
      companyName: (account as any).company || (account as any).companyName || 'Equilibra',
      role: account.role,
    });
    // Verificar onboarding após login
    try {
      const ws = await get<{ onboardingContext: unknown }>('/management/workspace');
      if (!ws.onboardingContext) {
        setNeedsOnboarding(true);
        setRoute('onboarding');
        return;
      }
    } catch {
      // Ignora — não bloqueia o app
    }
    setRoute('hoje');
    loadSurveys();
  }, []);

  // ───── 4. Handler de Logout ─────
  const handleLogout = useCallback(async () => {
    try {
      await post('/auth/logout', {});
    } catch {
      // Continua mesmo se falhar
    }
    setUser(null);
    setSurveys([]);
    setNeedsOnboarding(false);
    setRoute('hoje');
  }, []);

  // ───── 5. Handler de Navegação ─────
  const handleNavigate = useCallback((r: string) => {
    setRoute(r as Route);
  }, []);

  // ───── 6. Handler de Nova Pesquisa (criada com sucesso) ─────
  const handleSurveyCreated = useCallback(() => {
    setSurveyModalOpen(false);
    loadSurveys();
    setRoute('pesquisas');
  }, []);

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

  // ───── Tela de Login ─────
  if (!user) {
    return <AuthView onLogin={handleLogin} />;
  }

  // ───── Onboarding (primeira vez) ─────
  if (needsOnboarding || route === 'onboarding') {
    return (
      <OnboardingView
        onComplete={() => {
          setNeedsOnboarding(false);
          setRoute('hoje');
          loadSurveys();
        }}
        onSkip={() => {
          setNeedsOnboarding(false);
          setRoute('hoje');
          loadSurveys();
        }}
      />
    );
  }

  // ───── App Principal ─────
  const renderView = () => {
    switch (route) {
      case 'hoje':
        return (
          <TodayView
            user={user}
            onNavigate={handleNavigate}
            onOpenNewSurvey={() => setSurveyModalOpen(true)}
            onOpenNewAction={() => setActionModalOpen(true)}
          />
        );

      case 'pesquisas':
        return (
          <SurveysView
            surveys={surveys}
            onCreateNew={() => setSurveyModalOpen(true)}
            onOpenSurvey={(id) => handleNavigate(`pesquisas`)}
            onDeleteSurvey={(id) => {
              setSurveys((prev) => prev.filter((s) => s.id !== id));
            }}
            onViewResults={(id) => handleNavigate('resultados')}
          />
        );

      case 'resultados':
        return (
          <ResultsView
            onNavigateToActions={() => handleNavigate('acoes')}
          />
        );

      case 'acoes':
        return (
          <ActionsView />
        );

      case 'organizacao':
        return <OrganizationView />;

      case 'configuracoes':
        return (
          <div className="p-8 max-w-2xl mx-auto text-center space-y-3">
            <i className="fa-solid fa-gear text-4xl color-text-muted" aria-hidden="true" />
            <h2 className="text-lg font-bold text-primary">Configurações</h2>
            <p className="text-xs color-text-secondary">
              Gestão da conta, permissões de equipe, integrações (WhatsApp, e-mail) e preferências do workspace Equilibra.
            </p>
            <p className="badge badge-neutral text-xs">Em desenvolvimento — FASE 03</p>
          </div>
        );

      case 'evidencias':
        return <EvidenceCollectionView />;

      default:
        return (
          <TodayView
            user={user}
            onNavigate={handleNavigate}
            onOpenNewSurvey={() => setSurveyModalOpen(true)}
            onOpenNewAction={() => setActionModalOpen(true)}
          />
        );
    }
  };

  return (
    <>
      <Shell
        currentRoute={route.split('/')[0]}
        user={user}
        onNavigate={handleNavigate}
        onLogout={handleLogout}
      >
        {renderView()}
      </Shell>

      {/* Modal de Nova Pesquisa (global) */}
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
