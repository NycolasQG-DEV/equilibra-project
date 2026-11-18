import React, { useEffect, useState } from 'react';
import { get, post } from '../core/api';
import type { Survey, Action5W2H, RiskAssessment } from '../../../types';

interface TodayKPIs {
  openSurveys?: Survey[];
  population?: {
    membersCount: number;
    groupsCount: number;
  };
  charts?: {
    participationTrend?: Array<{ cycle: string; rate: number }>;
    factorRanking?: Array<{ label: string; average: number }>;
  };
}

interface TodayData {
  greeting?: string;
  dateFormatted?: string;
  kpis?: TodayKPIs;
  queue?: Array<{
    id: string;
    type: string;
    title: string;
    subtitle?: string;
    urgency: 'high' | 'medium' | 'low';
    actionUrl?: string;
  }>;
}

interface TodayViewProps {
  user: { name: string; email: string; companyName: string } | null;
  onNavigate: (route: string) => void;
  onOpenNewSurvey: () => void;
  onOpenNewAction: () => void;
}

export const TodayView: React.FC<TodayViewProps> = ({
  user,
  onNavigate,
  onOpenNewSurvey,
  onOpenNewAction,
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [todayData, setTodayData] = useState<TodayData | null>(null);
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [actions, setActions] = useState<Action5W2H[]>([]);
  const [membersCount, setMembersCount] = useState(0);
  const [groupsCount, setGroupsCount] = useState(1);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

  const firstName = user?.name ? user.name.trim().split(' ')[0] : 'Gestor';
  const hour = new Date().getHours();
  const timeGreeting = hour >= 5 && hour < 12 ? 'Bom dia' : hour >= 12 && hour < 18 ? 'Boa tarde' : 'Boa noite';
  const dateFormatted = new Date().toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  useEffect(() => {
    async function loadToday() {
      try {
        setLoading(true);
        setError(null);

        const [todayRes, surveysRes, workspaceRes, membersRes, groupsRes] = await Promise.allSettled([
          get<TodayData>('/today'),
          get<Survey[]>('/surveys'),
          get<{ actions?: Action5W2H[]; assessments?: RiskAssessment[] }>('/management/workspace'),
          get<any[]>('/members'),
          get<any[]>('/groups'),
        ]);

        if (todayRes.status === 'fulfilled') {
          setTodayData(todayRes.value);
        }

        if (surveysRes.status === 'fulfilled' && Array.isArray(surveysRes.value)) {
          setSurveys(surveysRes.value.filter((s) => s.status === 'open'));
        }

        if (workspaceRes.status === 'fulfilled' && workspaceRes.value?.actions) {
          setActions(workspaceRes.value.actions);
        }

        if (membersRes.status === 'fulfilled' && Array.isArray(membersRes.value)) {
          setMembersCount(membersRes.value.length);
        }

        if (groupsRes.status === 'fulfilled' && Array.isArray(groupsRes.value)) {
          setGroupsCount(Math.max(1, groupsRes.value.length));
        }
      } catch (err: any) {
        setError(err?.message || 'Não foi possível carregar os dados do painel.');
      } finally {
        setLoading(false);
      }
    }

    loadToday();
  }, []);

  const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
  const activeActions = actions.filter((a) => ['planned', 'in_progress', 'implemented'].includes(a.status));
  const overdueActions = actions.filter(
    (a) => ['planned', 'in_progress'].includes(a.status) && a.dueDate && a.dueDate < todayStr
  );
  const reviewDueActions = actions.filter(
    (a) => a.status === 'implemented' && a.reviewDate && a.reviewDate <= todayStr
  );
  const onTrackActionsCount = Math.max(0, activeActions.length - overdueActions.length - reviewDueActions.length);

  const totalResponses = surveys.reduce((acc, s) => acc + (s.responseCount || 0), 0);
  const totalInvited = surveys.reduce((acc, s) => acc + (s.totalMembersCount || 0), 0);
  const aggregateRate = totalInvited > 0 ? (totalResponses / totalInvited) * 100 : 0;

  const noResponseSurveys = surveys.filter((s) => !s.responseCount || s.responseCount === 0);

  const handleCopyLink = (surveyId: string) => {
    const url = `${window.location.origin}/responder/${surveyId}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopyFeedback(surveyId);
      setTimeout(() => setCopyFeedback(null), 3000);
    });
  };

  if (loading) {
    return (
      <div className="p-8 max-w-7xl mx-auto">
        <div className="skeleton h-10 w-64 mb-4" />
        <div className="skeleton h-6 w-96 mb-8" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="skeleton h-32 rounded-xl" />
          <div className="skeleton h-32 rounded-xl" />
          <div className="skeleton h-32 rounded-xl" />
        </div>
        <div className="skeleton h-64 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* 1. Header de Boas-Vindas */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-border">
        <div>
          <h1 className="text-2xl font-bold text-primary">
            {timeGreeting}, {firstName}.
          </h1>
          <p className="text-sm color-text-secondary capitalize">
            {dateFormatted} · Painel integrado de riscos psicossociais e planos de ação (NR-1 / NR-17)
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={onOpenNewAction}
          >
            <i className="fa-solid fa-plus mr-1" aria-hidden="true" /> Nova Ação
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={onOpenNewSurvey}
          >
            <i className="fa-solid fa-clipboard-list mr-1" aria-hidden="true" /> Nova Pesquisa
          </button>
        </div>
      </div>

      {error && (
        <div className="alert alert-danger flex items-center justify-between">
          <div className="flex items-center gap-2">
            <i className="fa-solid fa-triangle-exclamation" aria-hidden="true" />
            <span>{error}</span>
          </div>
          <button type="button" className="btn btn-ghost btn-xs" onClick={() => window.location.reload()}>
            Tentar novamente
          </button>
        </div>
      )}

      {/* 2. Faixa Situacional de Status Operacional */}
      {overdueActions.length > 0 ? (
        <div className="card-warning-edge p-3 rounded-lg flex items-center gap-3 bg-surface border border-warning">
          <i className="fa-solid fa-clock text-warning text-lg" aria-hidden="true" />
          <div className="text-sm">
            <strong className="font-semibold text-warning">Atenção ao cronograma NR-1: </strong>
            <span>
              {overdueActions.length} {overdueActions.length === 1 ? 'medida preventiva está atrasada' : 'medidas preventivas estão atrasadas'} no plano de ação.
            </span>
          </div>
        </div>
      ) : noResponseSurveys.length > 0 ? (
        <div className="p-3 rounded-lg flex items-center gap-3 bg-surface border border-primary-light">
          <i className="fa-solid fa-paper-plane text-primary text-lg" aria-hidden="true" />
          <div className="text-sm">
            <strong className="font-semibold text-primary">Coletas ativas em campo: </strong>
            <span>
              {noResponseSurveys.length} {noResponseSurveys.length === 1 ? 'pesquisa ainda não recebeu respostas' : 'pesquisas ainda não receberam respostas'}. Dispare os convites para compor a base amostral.
            </span>
          </div>
        </div>
      ) : (
        <div className="p-3 rounded-lg flex items-center gap-3 bg-surface border border-success">
          <i className="fa-solid fa-circle-check text-success text-lg" aria-hidden="true" />
          <div className="text-sm">
            <strong className="font-semibold text-success">Operação em conformidade: </strong>
            <span>Todas as coletas ativas estão recebendo respostas e o plano de ação segue o cronograma estabelecido.</span>
          </div>
        </div>
      )}

      {/* 3. Três Cards de Pulso Operacional */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Coletas em Campo */}
        <div className="card p-5 bg-surface flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider color-text-muted">Coletas em Campo</span>
            <span className="badge badge-primary">{surveys.length} ativas</span>
          </div>
          <div>
            <div className="text-3xl font-extrabold text-primary mb-1">{surveys.length}</div>
            <p className="text-xs color-text-secondary">
              {totalResponses} de {totalInvited} respostas recebidas ({aggregateRate.toFixed(1)}% de adesão global)
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-border flex justify-between items-center text-xs">
            <span className="color-text-muted">Quórum de privacidade:</span>
            <strong className="font-semibold">mín. 5 respostas / setor</strong>
          </div>
        </div>

        {/* Card 2: Colaboradores Mapeados */}
        <div className="card p-5 bg-surface flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider color-text-muted">Colaboradores Mapeados</span>
            <i className="fa-solid fa-users text-primary-light" aria-hidden="true" />
          </div>
          <div>
            <div className="text-3xl font-extrabold text-primary mb-1">{membersCount}</div>
            <p className="text-xs color-text-secondary">
              Distribuídos em {groupsCount} {groupsCount === 1 ? 'setor ativo' : 'setores ativos'} na organização
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-border flex justify-between items-center text-xs">
            <button
              type="button"
              className="text-primary hover:underline font-medium"
              onClick={() => onNavigate('organizacao')}
            >
              Gerenciar equipe & setores →
            </button>
          </div>
        </div>

        {/* Card 3: Planos de Ação NR-1 */}
        <div className="card p-5 bg-surface flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider color-text-muted">Planos de Ação (NR-1)</span>
            <span className={`badge ${overdueActions.length > 0 ? 'badge-danger' : 'badge-success'}`}>
              {overdueActions.length > 0 ? `${overdueActions.length} em atraso` : 'Em dia'}
            </span>
          </div>
          <div>
            <div className="text-3xl font-extrabold text-primary mb-1">{activeActions.length}</div>
            <p className="text-xs color-text-secondary">
              {onTrackActionsCount} no prazo · {overdueActions.length} em atraso · {reviewDueActions.length} para revisão
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-border flex justify-between items-center text-xs">
            <button
              type="button"
              className="text-primary hover:underline font-medium"
              onClick={() => onNavigate('acoes')}
            >
              Ver Kanban de Ações 5W2H →
            </button>
          </div>
        </div>
      </div>

      {/* 4. Layout Principal: Ações & Tarefas em Destaque + Coletas em Andamento */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Seção A: Planos de Ação & Tarefas em Execução (EM EVIDÊNCIA no topo) */}
          <div className="card bg-surface overflow-hidden">
            <div className="p-4 border-b border-border flex items-center justify-between bg-surface-subtle">
              <div className="flex items-center gap-2">
                <i className="fa-solid fa-list-check text-primary" aria-hidden="true" />
                <h2 className="text-base font-bold text-primary m-0">
                  Planos de Ação & Tarefas em Execução
                </h2>
                <span className="badge badge-primary">{activeActions.length}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={onOpenNewAction}
                >
                  <i className="fa-solid fa-plus mr-1" aria-hidden="true" /> Nova Ação
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm text-xs font-medium"
                  onClick={() => onNavigate('acoes')}
                >
                  Ver Todas →
                </button>
              </div>
            </div>

            <div className="p-4">
              {activeActions.length === 0 ? (
                <div className="text-center py-8">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary-subtle text-primary mb-3">
                    <i className="fa-solid fa-shield-heart text-xl" aria-hidden="true" />
                  </div>
                  <h3 className="text-sm font-semibold mb-1">Nenhum plano de ação ativo no ciclo</h3>
                  <p className="text-xs color-text-secondary max-w-md mx-auto mb-4">
                    Após consolidar as respostas das pesquisas ou registrar observações ergonômicas, adote medidas preventivas estruturadas para o PGR.
                  </p>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={onOpenNewAction}
                  >
                    <i className="fa-solid fa-plus mr-1" aria-hidden="true" /> Cadastrar Medida Preventiva
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {activeActions.slice(0, 4).map((action) => {
                    const isOverdue = action.dueDate && action.dueDate < todayStr && ['planned', 'in_progress'].includes(action.status);
                    const isReview = action.status === 'implemented' && action.reviewDate && action.reviewDate <= todayStr;
                    return (
                      <div key={action.id} className="py-3 flex items-center justify-between gap-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span
                              className={`badge ${
                                isOverdue
                                  ? 'badge-danger'
                                  : isReview
                                  ? 'badge-warning'
                                  : action.status === 'in_progress'
                                  ? 'badge-primary'
                                  : 'badge-neutral'
                              } text-[11px]`}
                            >
                              {isOverdue
                                ? 'Atrasada'
                                : isReview
                                ? 'Aferir Eficácia'
                                : action.status === 'in_progress'
                                ? 'Em Execução'
                                : 'Planejada'}
                            </span>
                            <span className="font-semibold text-sm hover:text-primary cursor-pointer" onClick={() => onNavigate('acoes')}>
                              {action.title}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-xs color-text-muted">
                            <span>
                              <i className="fa-solid fa-user-tie mr-1" aria-hidden="true" />
                              {action.who || 'Responsável não atribuído'}
                            </span>
                            {action.dueDate && (
                              <span className={isOverdue ? 'color-danger font-medium' : ''}>
                                <i className="fa-regular fa-calendar mr-1" aria-hidden="true" />
                                Prazo: {new Date(action.dueDate).toLocaleDateString('pt-BR')}
                              </span>
                            )}
                            {action.controlHierarchy && (
                              <span className="badge badge-neutral text-[10px]">
                                {action.controlHierarchy}
                              </span>
                            )}
                          </div>
                        </div>
                        <button
                          type="button"
                          className="btn btn-secondary btn-xs whitespace-nowrap"
                          onClick={() => onNavigate('acoes')}
                        >
                          Gerenciar
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Seção B: Coletas em Andamento */}
          <div className="card bg-surface overflow-hidden">
            <div className="p-4 border-b border-border flex items-center justify-between bg-surface-subtle">
              <div className="flex items-center gap-2">
                <i className="fa-solid fa-clipboard-question text-primary" aria-hidden="true" />
                <h2 className="text-base font-bold text-primary m-0">
                  Coletas em Andamento
                </h2>
                <span className="badge badge-primary">{surveys.length} ativas</span>
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-sm text-xs font-medium"
                onClick={() => onNavigate('pesquisas')}
              >
                Ver Todas as Pesquisas →
              </button>
            </div>

            <div className="p-0">
              {surveys.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-xs color-text-secondary mb-3">Nenhuma coleta ativa neste ciclo.</p>
                  <button type="button" className="btn btn-primary btn-sm" onClick={onOpenNewSurvey}>
                    <i className="fa-solid fa-plus mr-1" aria-hidden="true" /> Abrir Nova Coleta
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="table w-full">
                    <thead>
                      <tr>
                        <th>Pesquisa</th>
                        <th>Setor / Ciclo</th>
                        <th>Prazo</th>
                        <th>Adesão</th>
                        <th className="text-right">Ação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {surveys.map((s) => {
                        const responses = s.responseCount || 0;
                        const total = s.totalMembersCount || 0;
                        const rate = total > 0 ? (responses / total) * 100 : 0;
                        const endsAtDate = s.endsAt ? new Date(s.endsAt) : null;
                        const daysLeft = endsAtDate
                          ? Math.max(0, Math.ceil((endsAtDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
                          : null;
                        const hasNoResponses = responses === 0;

                        return (
                          <tr key={s.id} className={hasNoResponses ? 'bg-danger-subtle/10' : ''}>
                            <td>
                              <div className="font-semibold text-sm hover:text-primary cursor-pointer" onClick={() => onNavigate('pesquisas')}>
                                {s.title}
                              </div>
                              {hasNoResponses && (
                                <span className="badge badge-danger text-[10px] mt-1">sem respostas</span>
                              )}
                            </td>
                            <td>
                              <span className="badge badge-neutral text-xs">{s.cycle || 'Geral'}</span>
                            </td>
                            <td>
                              <span className={`text-xs ${daysLeft != null && daysLeft <= 5 ? 'color-danger font-bold' : 'color-text-secondary'}`}>
                                <i className="fa-regular fa-clock mr-1" aria-hidden="true" />
                                {daysLeft != null ? `${daysLeft}d restantes` : 'Aberto'}
                              </span>
                            </td>
                            <td>
                              <div className="text-xs font-semibold">{rate.toFixed(0)}%</div>
                              <div className="text-[11px] color-text-muted">
                                ({responses} de {total})
                              </div>
                            </td>
                            <td className="text-right">
                              {hasNoResponses ? (
                                <button
                                  type="button"
                                  className="btn btn-primary btn-xs"
                                  onClick={() => handleCopyLink(s.id)}
                                >
                                  {copyFeedback === s.id ? (
                                    <>
                                      <i className="fa-solid fa-check mr-1" aria-hidden="true" /> Link Copiado!
                                    </>
                                  ) : (
                                    <>
                                      <i className="fa-solid fa-share-nodes mr-1" aria-hidden="true" /> Disparar Convites
                                    </>
                                  )}
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  className="btn btn-secondary btn-xs"
                                  onClick={() => onNavigate('pesquisas')}
                                >
                                  Acompanhar
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 5. Barra Lateral Direita: Situação das Coletas + Governança NR-1 */}
        <div className="space-y-6">
          {/* Card: Diagnóstico Imediato das Coletas */}
          <div className="card p-5 bg-surface border border-border">
            <h3 className="text-xs font-bold uppercase tracking-wider color-text-muted mb-3">
              Situação Operacional das Coletas
            </h3>
            {noResponseSurveys.length > 0 ? (
              <div className="space-y-3">
                <div className="p-3 rounded-lg bg-danger-subtle text-danger text-xs font-medium">
                  <i className="fa-solid fa-triangle-exclamation mr-1" aria-hidden="true" />
                  {noResponseSurveys.length} {noResponseSurveys.length === 1 ? 'pesquisa não possui nenhuma resposta' : 'pesquisas não possuem nenhuma resposta'}.
                </div>
                <p className="text-xs color-text-secondary">
                  Envie o link seguro aos colaboradores ou dispare via WhatsApp para garantir o quórum amostral mínimo de 5 respostas.
                </p>
                <button
                  type="button"
                  className="btn btn-primary btn-sm w-full"
                  onClick={() => handleCopyLink(noResponseSurveys[0].id)}
                >
                  <i className="fa-solid fa-paper-plane mr-1" aria-hidden="true" />
                  {copyFeedback === noResponseSurveys[0].id ? 'Link Copiado para Envio!' : 'Copiar Link de Disparo'}
                </button>
              </div>
            ) : (
              <div className="space-y-2 text-xs color-text-secondary">
                <div className="flex items-center gap-2 text-success font-semibold">
                  <i className="fa-solid fa-circle-check" aria-hidden="true" />
                  <span>Adesão em ritmo adequado</span>
                </div>
                <p>
                  As pesquisas ativas estão recebendo respostas. Acompanhe a evolução do quórum de cada setor.
                </p>
              </div>
            )}
          </div>

          {/* Card: Governança & Eficácia NR-1 */}
          <div className="card p-5 bg-surface border border-border">
            <h3 className="text-xs font-bold uppercase tracking-wider color-text-muted mb-3">
              Governança & Ciclo NR-1
            </h3>
            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between pb-2 border-b border-border">
                <span className="color-text-secondary">Ações em execução</span>
                <strong className="font-semibold text-primary">{onTrackActionsCount}</strong>
              </div>
              <div className="flex items-center justify-between pb-2 border-b border-border">
                <span className="color-text-secondary">Ações em atraso</span>
                <strong className={`font-semibold ${overdueActions.length > 0 ? 'text-danger' : 'color-text-muted'}`}>
                  {overdueActions.length}
                </strong>
              </div>
              <div className="flex items-center justify-between pb-2 border-b border-border">
                <span className="color-text-secondary">Aguardando aferição de eficácia</span>
                <strong className="font-semibold text-warning">{reviewDueActions.length}</strong>
              </div>
              <div className="pt-2">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm w-full"
                  onClick={() => onNavigate('acoes')}
                >
                  <i className="fa-solid fa-table-columns mr-1" aria-hidden="true" />
                  Abrir Kanban de Ações
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
