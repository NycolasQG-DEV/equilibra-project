import React, { useEffect, useState } from 'react';
import { get, post } from '../core/api';

interface FactorMetric {
  key: string;
  label: string;
  // Backend returns `average`; support both for resilience
  average?: number;
  mean?: number;
  favorableRatio?: number;
  unfavorableRatio?: number;
  neutralRatio?: number;
  band?: 'adequado' | 'cuidado' | 'atencao' | 'unclassified';
}

interface ReportItem {
  id: string;
  surveyId: string;
  title: string;
  cycle: string;
  model: string;
  // Backend primary fields
  closedAt?: string;
  responseCount?: number;
  responsesCount?: number;
  invitedCount?: number;
  // Frontend-normalized aliases (may come from either backend naming)
  generatedAt?: string;
  totalInvited?: number;
  totalAnswered?: number;
  participationRate: number;
  factors?: FactorMetric[];
  groupBreakdown?: Array<{
    groupId: string;
    groupName: string;
    totalInvited: number;
    answeredCount: number;
    participationRate: number;
    isSuppressed: boolean;
    factors?: Record<string, number>;
  }>;
  // Backend returns `insights` array; may also carry `hypotheses`
  insights?: Array<{
    factorKey?: string;
    factorLabel?: string;
    observation?: string;
    hypothesis?: string;
    recommendedInvestigation?: string;
  }>;
  hypotheses?: Array<{
    factorKey: string;
    factorLabel: string;
    observation: string;
    hypothesis: string;
    recommendedInvestigation: string;
  }>;
}

interface ResultsViewProps {
  initialReportId?: string | null;
  onNavigateToActions?: () => void;
}

export const ResultsView: React.FC<ResultsViewProps> = ({
  initialReportId,
  onNavigateToActions,
}) => {
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [selectedReport, setSelectedReport] = useState<ReportItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  useEffect(() => {
    async function loadReports() {
      try {
        setLoading(true);
        setError(null);
        const data = await get<ReportItem[]>('/reports');
        if (Array.isArray(data)) {
          setReports(data);
          if (data.length > 0) {
            const initial = initialReportId ? data.find((r) => r.id === initialReportId || r.surveyId === initialReportId) : data[0];
            setSelectedReport(initial || data[0]);
          }
        }
      } catch (err: any) {
        setError(err?.message || 'Erro ao carregar relatórios diagnósticos.');
      } finally {
        setLoading(false);
      }
    }

    loadReports();
  }, [initialReportId]);

  const handleAdoptProposal = async (hypo: any) => {
    try {
      setError(null);
      await post('/management/actions', {
        title: `Investigação & Medida: ${hypo.factorLabel}`,
        what: hypo.recommendedInvestigation,
        why: `Hipótese levantada na escuta diagnóstica: ${hypo.observation}`,
        where: 'Setores envolvidos',
        who: 'Comitê SST / RH',
        when: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        how: 'Conduzir inspeção ergonômica preliminar e alinhar ajustes organizacionais',
        status: 'planned',
        controlHierarchy: 'administrativa',
        efficacyCriteria: 'Evolução favorável do fator no ciclo seguinte e redução de relatos de sobrecarga',
      });

      setActionSuccess(`Proposta vinculada com sucesso ao Plano de Ação!`);
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err: any) {
      setError(err?.message || 'Erro ao adotar proposta no plano de ação.');
    }
  };

  const handleExport = (format: 'pdf' | 'xlsx') => {
    if (!selectedReport) return;
    const url = `/api/reports/${selectedReport.id}/export?format=${format}`;
    window.open(url, '_blank');
  };

  if (loading) {
    return (
      <div className="p-8 max-w-7xl mx-auto space-y-4">
        <div className="skeleton h-8 w-64" />
        <div className="skeleton h-48 rounded-xl" />
        <div className="skeleton h-64 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-border">
        <div>
          <h1 className="text-2xl font-bold text-primary">Diagnóstico & Relatórios de Escuta</h1>
          <p className="text-xs color-text-secondary">
            Resultados consolidados das escutas e indicadores psicossociais por setor.
          </p>
        </div>

        {selectedReport && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => handleExport('xlsx')}
            >
              <i className="fa-regular fa-file-excel mr-1 text-success" aria-hidden="true" /> Planilha Excel
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => handleExport('pdf')}
            >
              <i className="fa-regular fa-file-pdf mr-1" aria-hidden="true" /> Dossiê PDF
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="alert alert-danger text-xs p-3 rounded-lg flex items-center gap-2">
          <i className="fa-solid fa-triangle-exclamation" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      {actionSuccess && (
        <div className="alert alert-success text-xs p-3 rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-2">
            <i className="fa-solid fa-circle-check" aria-hidden="true" />
            <span>{actionSuccess}</span>
          </div>
          {onNavigateToActions && (
            <button type="button" className="btn btn-ghost btn-xs text-primary font-semibold" onClick={onNavigateToActions}>
              Ver no Kanban de Ações →
            </button>
          )}
        </div>
      )}

      {reports.length === 0 ? (
        <div className="card p-12 text-center bg-surface">
          <i className="fa-solid fa-chart-pie text-4xl color-text-muted mb-3" aria-hidden="true" />
          <h3 className="font-semibold text-base mb-1">Nenhum ciclo de escuta encerrado ainda</h3>
          <p className="text-xs color-text-secondary max-w-md mx-auto mb-4">
            Os relatórios diagnósticos são gerados automaticamente após o encerramento do período de coleta ou quando o quórum amostral for atingido.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Seletor Lateral de Ciclos */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider color-text-muted">Ciclos Consolidados</h3>
            <div className="space-y-2">
              {reports.map((report) => (
                <div
                  key={report.id}
                  className={`card p-3 cursor-pointer border transition-all ${
                    selectedReport?.id === report.id
                      ? 'border-primary bg-primary-subtle/10 ring-2 ring-primary/20'
                      : 'border-border hover:border-primary-light'
                  }`}
                  onClick={() => setSelectedReport(report)}
                >
                  <div className="font-semibold text-xs text-primary mb-1">{report.title}</div>
                  <div className="text-[11px] color-text-muted">{report.cycle}</div>
                  <div className="mt-2 flex items-center justify-between text-[11px]">
                    <span className="badge badge-neutral text-[10px]">
                      {report.responseCount ?? report.responsesCount ?? report.totalAnswered ?? '—'} respostas
                    </span>
                    <span className="font-semibold">{((report.participationRate || 0) * 100).toFixed(0)}% adesão</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Área de Detalhes do Diagnóstico */}
          {selectedReport && (
            <div className="lg:col-span-3 space-y-6">
              {/* Painel de Metadados e Sigilo Amostral */}
              <div className="card p-5 bg-surface border border-border">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4 pb-3 border-b border-border">
                  <div>
                    <span className="badge badge-primary text-xs mb-1">{selectedReport.cycle}</span>
                    <h2 className="text-lg font-bold text-primary">{selectedReport.title}</h2>
                    <p className="text-xs color-text-muted">
                      Modelo: {selectedReport.model} · Consolidado em: {new Date(selectedReport.closedAt || selectedReport.generatedAt || Date.now()).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                  <div className="flex items-center gap-4 text-center">
                    <div>
                      <span className="text-xs color-text-muted block">Participantes</span>
                      <strong className="text-xl font-bold">{selectedReport.responseCount ?? selectedReport.responsesCount ?? selectedReport.totalAnswered ?? '—'}</strong>
                      <span className="text-[10px] color-text-muted block">de {selectedReport.invitedCount ?? selectedReport.totalInvited ?? '—'} convidados</span>
                    </div>
                    <div className="border-l border-border pl-4">
                      <span className="text-xs color-text-muted block">Taxa de Adesão</span>
                      <strong className="text-xl font-bold text-primary">
                        {((selectedReport.participationRate || 0) * 100).toFixed(0)}%
                      </strong>
                      <span className="text-[10px] color-text-muted block">amostra global</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Fatores Avaliados & Escores Médios */}
              <div className="card p-5 bg-surface border border-border">
                <h3 className="text-sm font-bold text-primary mb-3 flex items-center gap-2">
                  <i className="fa-solid fa-chart-column" aria-hidden="true" />
                  Escores por Fator Psicossocial
                </h3>
                <p className="text-xs color-text-secondary mb-4">
                  Escala de 1,00 a 5,00. Escores abaixo de 2,80 indicam oportunidade de atenção; escores iguais ou acima de 3,60 indicam fatores protetivos no grupo avaliado.
                </p>

                {selectedReport.factors && selectedReport.factors.length > 0 ? (
                  <div className="space-y-3">
                    {selectedReport.factors.map((factor) => {
                      const mean = factor.average ?? factor.mean ?? 0;
                      const percentage = Math.min(100, Math.max(0, ((mean - 1) / 4) * 100));
                      const isAttention = mean < 2.8;
                      const isFavorable = mean >= 3.6;

                      return (
                        <div key={factor.key} className="p-3 bg-surface-subtle rounded-lg space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold text-primary">{factor.label}</span>
                            <div className="flex items-center gap-2">
                              <span className={`badge ${isAttention ? 'badge-danger' : isFavorable ? 'badge-success' : 'badge-neutral'} text-[10px]`}>
                                {isAttention ? 'Ponto de Atenção' : isFavorable ? 'Fator Protetivo' : 'Faixa Moderada'}
                              </span>
                              <strong className="text-sm font-bold">{mean.toFixed(2)}</strong>
                            </div>
                          </div>
                          <div className="h-2 w-full bg-border rounded-full overflow-hidden">
                            <div
                              className={`h-full ${isAttention ? 'bg-danger' : isFavorable ? 'bg-success' : 'bg-primary'}`}
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs color-text-secondary">Nenhum fator individual compilado neste relatório.</p>
                )}
              </div>

              {/* Camada 3 & 4: Hipóteses para Investigação Técnica & Propostas */}
              <div className="card p-5 bg-surface border border-border">
                <h3 className="text-sm font-bold text-primary mb-2 flex items-center gap-2">
                  <i className="fa-solid fa-lightbulb" aria-hidden="true" />
                  Camada 3 & 4: Hipóteses para Investigação & Propostas Preventivas
                </h3>
                <p className="text-xs color-text-secondary mb-4">
                  Hipóteses estruturadas para direcionar a Análise Ergonômica Preliminar (AEP) in loco. O responsável técnico deve validar a pertinência antes de cadastrar a medida definitiva no PGR.
                </p>

                {(() => {
                  // Unifica hypotheses (campo antigo) e insights (campo atual do backend)
                  const items = (
                    selectedReport.hypotheses && selectedReport.hypotheses.length > 0
                      ? selectedReport.hypotheses
                      : selectedReport.insights && selectedReport.insights.length > 0
                      ? selectedReport.insights
                      : []
                  );
                  if (items.length === 0) {
                    return (
                      <div className="text-center py-6">
                        <i className="fa-regular fa-clock text-2xl color-text-muted mb-2" aria-hidden="true" />
                        <p className="text-xs color-text-secondary">
                          Evidência insuficiente para compor hipóteses neste ciclo. As hipóteses investigativas são geradas automaticamente após o encerramento do período de coleta com quórum amostral atingido.
                        </p>
                      </div>
                    );
                  }
                  return (
                    <div className="space-y-4">
                      {items.map((hypo: any, idx: number) => (
                        <div key={hypo.factorKey || idx} className="p-4 border border-border rounded-lg bg-surface-subtle space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-xs text-primary">{hypo.factorLabel}</span>
                            <span className="badge badge-primary text-[10px]">Hipótese Investigativa</span>
                          </div>
                          {hypo.observation && (
                            <p className="text-xs color-text-secondary m-0">
                              <strong>Dado observado:</strong> {hypo.observation}
                            </p>
                          )}
                          {hypo.hypothesis && (
                            <p className="text-xs color-text-secondary m-0">
                              <strong>Hipótese técnica:</strong> {hypo.hypothesis}
                            </p>
                          )}
                          {hypo.recommendedInvestigation && (
                            <div className="p-2 bg-surface rounded border border-border text-xs">
                              <strong className="text-primary block mb-1">Medida preventiva sugerida para validação:</strong>
                              <span>{hypo.recommendedInvestigation}</span>
                            </div>
                          )}
                          <div className="pt-2 flex justify-end">
                            <button
                              type="button"
                              className="btn btn-primary btn-xs"
                              onClick={() => handleAdoptProposal(hypo)}
                            >
                              <i className="fa-solid fa-plus mr-1" aria-hidden="true" /> Adotar no Plano de Ação (5W2H)
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
