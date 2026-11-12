import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Shell } from './components/Shell';
import { SurveysView } from './views/SurveysView';
import type { Survey } from '../../types';

// Mock inicial para validação de montagem e tipos
const initialSurveys: Survey[] = [
  {
    id: 'survey-1',
    title: 'Pesquisa de Clima & Condições de Trabalho',
    cycle: 'Ciclo Mensal - Novembro/2026',
    model: 'Organização e condições de trabalho',
    collectionChannel: 'web',
    status: 'open',
    groupIds: ['group-1'],
    startsAt: new Date().toISOString(),
    endsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    createdAt: new Date().toISOString(),
    totalMembersCount: 28,
    responseCount: 14,
  },
];

const App: React.FC = () => {
  const [currentRoute, setCurrentRoute] = useState('pesquisas');
  const [surveys, setSurveys] = useState<Survey[]>(initialSurveys);

  const user = {
    name: 'Gestor SST',
    email: 'gestor@equilibra.com.br',
    companyName: 'Equilibra Saúde Ocupacional',
  };

  return (
    <Shell
      currentRoute={currentRoute}
      user={user}
      onNavigate={(route) => setCurrentRoute(route)}
      onLogout={() => console.log('Logout executado')}
    >
      {currentRoute === 'pesquisas' && (
        <SurveysView
          surveys={surveys}
          onCreateNew={() => setCurrentRoute('pesquisas/novo')}
          onOpenSurvey={(id) => console.log('Abrir pesquisa', id)}
          onDeleteSurvey={(id) => setSurveys((prev) => prev.filter((s) => s.id !== id))}
          onViewResults={(id) => console.log('Ver resultados', id)}
        />
      )}
    </Shell>
  );
};

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}
