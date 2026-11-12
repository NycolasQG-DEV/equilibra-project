import React, { useEffect, useRef, useState } from 'react';
import type { Survey } from '../../../types';

interface SurveysViewProps {
  surveys: Survey[];
  onCreateNew: () => void;
  onOpenSurvey: (id: string) => void;
  onDeleteSurvey: (id: string) => void;
  onViewResults: (id: string) => void;
}

export const SurveysView: React.FC<SurveysViewProps> = ({
  surveys,
  onCreateNew,
  onOpenSurvey,
  onDeleteSurvey,
  onViewResults,
}) => {
  const [filter, setFilter] = useState<'all' | 'open' | 'closed' | 'draft'>('all');
  const [search, setSearch] = useState('');
  const [surveyToDelete, setSurveyToDelete] = useState<Survey | null>(null);
  const [deleteSecondsLeft, setDeleteSecondsLeft] = useState(4);
  const [deleteProgress, setDeleteProgress] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);

  // Efeito de entrada suave dos cards com Anime.js
  useEffect(() => {
    const anime = (window as any).anime;
    if (anime && containerRef.current) {
      const cards = containerRef.current.querySelectorAll('.survey-card-item');
      if (cards.length > 0) {
        anime({
          targets: cards,
          opacity: [0, 1],
          translateY: [24, 0],
          duration: 520,
          delay: anime.stagger(60),
          easing: 'cubicBezier(0.16, 1, 0.3, 1)',
        });
      }
    }
  }, [filter, search]);

  // Contagem regressiva segura e barra de progresso para exclusão
  useEffect(() => {
    if (!surveyToDelete) {
      setDeleteSecondsLeft(4);
      setDeleteProgress(0);
      return;
    }

    const duration = 4000;
    const start = Date.now();

    const interval = setInterval(() => {
      const elapsed = Date.now() - start;
      const progress = Math.min(100, (elapsed / duration) * 100);
      const remaining = Math.max(0, Math.ceil((duration - elapsed) / 1000));

      setDeleteProgress(progress);
      setDeleteSecondsLeft(remaining);

      if (elapsed >= duration) {
        clearInterval(interval);
      }
    }, 50);

    return () => clearInterval(interval);
  }, [surveyToDelete]);

  const filteredSurveys = surveys.filter((s) => {
    const matchesFilter = filter === 'all' || s.status === filter;
    const matchesSearch =
      s.title.toLowerCase().includes(search.toLowerCase()) ||
      s.cycle.toLowerCase().includes(search.toLowerCase()) ||
      s.model.toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  return (
    <div className="p-6 max-w-7xl mx-auto" ref={containerRef}>
      {/* Cabeçalho da View */}
      <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
        <div>
          <h1 className="view-title">Pesquisas & Ciclos de Diagnóstico</h1>
          <p className="view-subtitle">
            Gerencie os ciclos psicossociais, acompanhe a taxa de quorum e abra novas coletas.
          </p>
        </div>
        <button type="button" className="btn btn-primary btn-lg" onClick={onCreateNew}>
          <i className="fa-solid fa-plus" aria-hidden="true" />
          <span>Nova Pesquisa</span>
        </button>
      </div>

      {/* Barra de Filtros e Busca */}
      <div className="card p-4 mb-6 flex items-center justify-between flex-wrap gap-4 bg-surface">
        <div className="flex items-center gap-2 flex-wrap">
          {(['all', 'open', 'closed', 'draft'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              className={`btn btn-sm ${filter === mode ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setFilter(mode)}
            >
              {mode === 'all' && 'Todos os Ciclos'}
              {mode === 'open' && 'Em Andamento'}
              {mode === 'closed' && 'Encerrados'}
              {mode === 'draft' && 'Rascunhos'}
            </button>
          ))}
        </div>

        <div className="w-full max-w-xs">
          <input
            type="text"
            className="input"
            placeholder="Buscar por título, ciclo ou modelo..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Grid de Pesquisas */}
      {filteredSurveys.length === 0 ? (
        <div className="card p-12 text-center bg-surface">
          <i className="fa-solid fa-clipboard-question text-4xl color-text-muted mb-3" aria-hidden="true" />
          <h3 className="font-semibold text-lg mb-1">Nenhuma pesquisa encontrada</h3>
          <p className="table-subtext mb-4">
            {search ? 'Tente ajustar os termos da sua busca.' : 'Crie um novo ciclo para iniciar a escuta da equipe.'}
          </p>
          {!search && (
            <button type="button" className="btn btn-primary" onClick={onCreateNew}>
              <i className="fa-solid fa-plus" aria-hidden="true" /> Criar Primeira Pesquisa
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredSurveys.map((survey) => (
            <div key={survey.id} className="card p-5 survey-card-item flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className={`badge ${survey.status === 'open' ? 'badge-success' : survey.status === 'closed' ? 'badge-neutral' : 'badge-warning'}`}>
                    {survey.status === 'open' && 'Coleta Ativa'}
                    {survey.status === 'closed' && 'Encerrada'}
                    {survey.status === 'draft' && 'Agendada / Rascunho'}
                  </span>
                  <span className="text-xs color-text-muted flex items-center gap-1">
                    <i className={`fa-solid ${survey.collectionChannel === 'whatsapp' ? 'fa-brands fa-whatsapp color-success' : 'fa-globe color-primary'}`} aria-hidden="true" />
                    {survey.collectionChannel === 'whatsapp' ? 'WhatsApp' : 'Web Link'}
                  </span>
                </div>

                <h3 className="font-bold text-lg mb-1 text-primary">{survey.title}</h3>
                <p className="table-subtext mb-3">{survey.cycle} • {survey.model}</p>

                <div className="card bg-surface-subtle p-3 mb-4 rounded-md flex justify-between text-sm">
                  <div>
                    <span className="color-text-muted block text-xs">Respostas</span>
                    <strong className="num">{survey.responseCount || 0}</strong>
                  </div>
                  <div>
                    <span className="color-text-muted block text-xs">Público Alvo</span>
                    <strong className="num">{survey.totalMembersCount || 0}</strong>
                  </div>
                  <div>
                    <span className="color-text-muted block text-xs">Quorum Mínimo</span>
                    <strong className="num">5</strong>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between gap-2 pt-3 border-t">
                {survey.status === 'closed' ? (
                  <button type="button" className="btn btn-primary btn-sm w-full" onClick={() => onViewResults(survey.id)}>
                    <i className="fa-solid fa-chart-column" aria-hidden="true" /> Ver Diagnóstico
                  </button>
                ) : survey.status === 'open' ? (
                  <button type="button" className="btn btn-secondary btn-sm flex-1" onClick={() => onOpenSurvey(survey.id)}>
                    <i className="fa-solid fa-arrow-up-right-from-square" aria-hidden="true" /> Acompanhar
                  </button>
                ) : (
                  <button type="button" className="btn btn-primary btn-sm flex-1" onClick={() => onOpenSurvey(survey.id)}>
                    <i className="fa-solid fa-play" aria-hidden="true" /> Iniciar Coleta
                  </button>
                )}

                <button
                  type="button"
                  className="btn btn-ghost btn-sm color-danger"
                  onClick={() => setSurveyToDelete(survey)}
                  title="Excluir Pesquisa"
                >
                  <i className="fa-solid fa-trash-can" aria-hidden="true" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal de Exclusão com Progress Bar */}
      {surveyToDelete && (
        <div className="dialog-overlay" role="dialog" aria-modal="true">
          <div className="dialog-box max-w-md">
            <div className="dialog-header">
              <h2 className="dialog-title color-danger">
                <i className="fa-solid fa-triangle-exclamation mr-2" aria-hidden="true" />
                Excluir Pesquisa Permanentemente
              </h2>
            </div>
            <div className="dialog-body">
              <p className="mb-4">
                Você está prestes a excluir <strong>{surveyToDelete.title}</strong>. Esta ação não poderá ser desfeita.
              </p>

              <div className="card bg-surface-subtle p-3 mb-4 rounded-md">
                <div className="flex items-center justify-between text-xs mb-2">
                  <span>Aguarde para confirmar:</span>
                  <strong className="badge badge-neutral">{deleteSecondsLeft}s</strong>
                </div>
                <div className="delete-survey-progress">
                  <div
                    className="delete-survey-progress-bar"
                    style={{ width: `${deleteProgress}%` }}
                  />
                </div>
              </div>
            </div>
            <div className="dialog-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setSurveyToDelete(null)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn btn-danger"
                disabled={deleteSecondsLeft > 0}
                onClick={() => {
                  onDeleteSurvey(surveyToDelete.id);
                  setSurveyToDelete(null);
                }}
              >
                <i className="fa-solid fa-trash-can" aria-hidden="true" /> Confirmar Exclusão
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
