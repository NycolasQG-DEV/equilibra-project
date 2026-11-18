/**
 * RiskAssessmentView — FASE 06 (EQ-009)
 *
 * Motor de Avaliação de Riscos Psicossociais — NR-1
 *
 * Implementa a matriz técnica 5×5 (severidade × probabilidade) para gradação de riscos no âmbito do GRO/PGR (NR-1 subitem 1.5.4.4.2).
 * Mantém separação de camadas:
 *   1ª — Dado observado (pontuação do fator)
 *   2ª — Interpretação descritiva (categoria de risco)
 *   3ª — Hipótese técnica (contexto, medidas existentes)
 *   4ª — Decisão técnica/humana (aprovação explícita do avaliador)
 *
 * Status nunca é auto-atribuído como 'evaluated' — exige ação humana explícita.
 */

import React, { useEffect, useState, useCallback } from 'react';
import { get, post, put } from '../core/api';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Report {
  id: string;
  title: string;
  cycle: string;
  published: boolean;
  closedAt?: string;
  result?: Array<{ key: string; label: string; mean: number }>;
}

interface Assessment {
  id: string;
  reportId: string;
  factor: string;
  title: string;
  context: string;
  existingMeasures: string;
  decision: string;
  status: 'investigating' | 'evaluated' | 'dismissed';
  classification: 'pending' | 'low' | 'medium' | 'high';
  version: number;
  severity?: number;
  probability?: number;
  riskScore?: number;
  riskLevel?: 'aceitavel' | 'baixo' | 'medio' | 'alto' | 'critico';
  groupExposed?: string;
  hazard?: string;
  consequence?: string;
}

// ─── NR-1 Risk Matrix helpers ─────────────────────────────────────────────────

type RiskLevel = 'aceitavel' | 'baixo' | 'medio' | 'alto' | 'critico';

function calcRiskLevel(score: number): RiskLevel {
  if (score <= 2) return 'aceitavel';
  if (score <= 6) return 'baixo';
  if (score <= 12) return 'medio';
  if (score <= 20) return 'alto';
  return 'critico';
}

const RISK_LEVEL_LABELS: Record<RiskLevel, string> = {
  aceitavel: 'Aceitável',
  baixo: 'Baixo',
  medio: 'Médio',
  alto: 'Alto',
  critico: 'Crítico',
};

const RISK_LEVEL_CSS: Record<RiskLevel, string> = {
  aceitavel: 'risk-badge risk-badge--ok',
  baixo: 'risk-badge risk-badge--low',
  medio: 'risk-badge risk-badge--medium',
  alto: 'risk-badge risk-badge--high',
  critico: 'risk-badge risk-badge--critical',
};

const CLASSIFICATION_CSS: Record<string, string> = {
  pending: 'badge badge-neutral',
  low: 'badge badge-success',
  medium: 'badge badge-warning',
  high: 'badge badge-danger',
};

const CLASSIFICATION_LABELS: Record<string, string> = {
  pending: 'Aguardando classificação',
  low: 'Baixa prioridade',
  medium: 'Média prioridade',
  high: 'Alta prioridade',
};

const FACTOR_LABELS: Record<string, string> = {
  exigencias_cognitivas: 'Exigências Cognitivas',
  ritmo_trabalho: 'Ritmo de Trabalho',
  conflito_papel: 'Conflito de Papel',
  autonomia: 'Autonomia',
  suporte_colegas: 'Suporte dos Colegas',
  suporte_chefia: 'Suporte da Chefia',
  violencia_assedio: 'Violência / Assédio',
  seguranca_emprego: 'Segurança no Emprego',
  equilibrio_vida: 'Equilíbrio Vida-Trabalho',
  carga_fisica: 'Carga Física',
  ambiente_fisico: 'Ambiente Físico',
  psych_safety: 'Segurança Psicológica',
};

function factorLabel(key: string) {
  return FACTOR_LABELS[key] || key;
}

// ─── Component ────────────────────────────────────────────────────────────────

interface FormState {
  reportId: string;
  factor: string;
  title: string;
  severity: number;
  probability: number;
  groupExposed: string;
  hazard: string;
  consequence: string;
  context: string;
  existingMeasures: string;
  decision: string;
  classification: string;
}

const EMPTY_FORM: FormState = {
  reportId: '',
  factor: '',
  title: '',
  severity: 3,
  probability: 3,
  groupExposed: '',
  hazard: '',
  consequence: '',
  context: '',
  existingMeasures: '',
  decision: '',
  classification: 'pending',
};

export const RiskAssessmentView: React.FC = () => {
  const [reports, setReports] = useState<Report[]>([]);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Assessment | null>(null);
  const [evaluating, setEvaluating] = useState(false);
  const [filterStatus, setFilterStatus] = useState<'all' | 'investigating' | 'evaluated' | 'dismissed'>('all');

  // ─── Load ───────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    try {
      setLoading(true);
      const ws = await get<{ reports?: Report[]; assessments: Assessment[] }>('/management/workspace');
      const rpts = await get<Report[]>('/reports').catch(() => []);
      setAssessments(ws.assessments || []);
      setReports(Array.isArray(rpts) ? rpts.filter((r) => r.published) : []);
    } catch {
      // Silencioso
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ─── Computed risk ──────────────────────────────────────────────────────
  const riskScore = form.severity * form.probability;
  const riskLevel = calcRiskLevel(riskScore);

  // ─── Available factors for selected report ──────────────────────────────
  const selectedReport = reports.find((r) => r.id === form.reportId);
  const availableFactors = selectedReport?.result || [];

  // ─── Form ───────────────────────────────────────────────────────────────
  const setField = (field: keyof FormState, value: string | number) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setError(null);
  };

  const handleSubmit = async () => {
    if (!form.reportId) return setError('Selecione um resultado de pesquisa.');
    if (!form.factor) return setError('Selecione o fator de risco.');
    if (!form.title.trim()) return setError('Informe um título para o achado.');

    try {
      setSaving(true);
      await post('/management/assessments', {
        reportId: form.reportId,
        factor: form.factor,
        title: form.title.trim(),
        severity: form.severity,
        probability: form.probability,
        riskScore,
        riskLevel,
        groupExposed: form.groupExposed || null,
        hazard: form.hazard || null,
        consequence: form.consequence || null,
        context: form.context || null,
        existingMeasures: form.existingMeasures || null,
        decision: form.decision || null,
        classification: form.classification,
        status: 'investigating', // Sempre começa como investigating — nunca auto-avaliado
      });
      setShowForm(false);
      setForm(EMPTY_FORM);
      await load();
    } catch (e: any) {
      setError(e?.message || 'Não foi possível registrar. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  // ─── Avaliação humana explícita ──────────────────────────────────────────
  const handleEvaluate = async (assessment: Assessment) => {
    if (!assessment.context || !assessment.decision) {
      return setError('Preencha contexto e decisão técnica antes de concluir a avaliação.');
    }
    try {
      setEvaluating(true);
      await put(`/management/assessments/${assessment.id}`, {
        ...assessment,
        status: 'evaluated',
        version: assessment.version,
      });
      setSelected(null);
      await load();
    } catch (e: any) {
      setError(e?.message || 'Erro ao concluir avaliação.');
    } finally {
      setEvaluating(false);
    }
  };

  // ─── Filter ─────────────────────────────────────────────────────────────
  const filtered = filterStatus === 'all'
    ? assessments
    : assessments.filter((a) => a.status === filterStatus);

  // ─── Matrix cell renderer ───────────────────────────────────────────────
  const MatrixCell: React.FC<{ s: number; p: number }> = ({ s, p }) => {
    const score = s * p;
    const level = calcRiskLevel(score);
    const isActive = form.severity === s && form.probability === p;
    return (
      <button
        className={`matrix-cell matrix-cell--${level} ${isActive ? 'matrix-cell--active' : ''}`}
        onClick={() => { setField('severity', s); setField('probability', p); }}
        title={`Severidade ${s} × Probabilidade ${p} = ${score} (${RISK_LEVEL_LABELS[level]})`}
        aria-label={`Severidade ${s}, Probabilidade ${p}, Risco ${RISK_LEVEL_LABELS[level]}`}
        aria-pressed={isActive}
      >
        {score}
      </button>
    );
  };

  return (
    <div className="page-container">

      {/* ── Cabeçalho ─────────────────────────────────────────────────── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Avaliação de Riscos Psicossociais</h1>
          <p className="page-subtitle">
            Classifique e priorize fatores de risco através da matriz 5×5 (severidade × probabilidade).
          </p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => { setShowForm(true); setError(null); setForm(EMPTY_FORM); }}
          aria-label="Registrar novo achado de risco"
        >
          <i className="fa-solid fa-plus mr-2" aria-hidden="true" />
          Novo Achado
        </button>
      </div>

      {/* ── Filtros de status ──────────────────────────────────────────── */}
      <div className="filter-tabs" role="tablist">
        {(['all', 'investigating', 'evaluated', 'dismissed'] as const).map((s) => (
          <button
            key={s}
            role="tab"
            aria-selected={filterStatus === s}
            className={`filter-tab ${filterStatus === s ? 'active filter-tab--active' : ''}`}
            onClick={() => setFilterStatus(s)}
          >
            {{ all: 'Todos', investigating: 'Em investigação', evaluated: 'Avaliados', dismissed: 'Dispensados' }[s]}
            <span className="filter-tab-count">
              {s === 'all' ? assessments.length : assessments.filter((a) => a.status === s).length}
            </span>
          </button>
        ))}
      </div>

      {/* ── Lista de achados ───────────────────────────────────────────── */}
      {loading ? (
        <div className="skeleton-list">
          {[1, 2, 3].map((i) => <div key={i} className="skeleton skeleton-row" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <i className="fa-solid fa-shield-halved empty-state-icon" aria-hidden="true" />
          <p className="empty-state-title">Nenhum achado registrado</p>
          <p className="empty-state-desc mb-4">
            Registre achados de risco a partir dos resultados das pesquisas de escuta ou de observações em campo.
          </p>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => { setShowForm(true); setError(null); setForm(EMPTY_FORM); }}
          >
            <i className="fa-solid fa-plus mr-1" aria-hidden="true" /> Registrar Primeiro Achado
          </button>
        </div>
      ) : (
        <div className="assessment-list">
          {filtered.map((a) => {
            const level = a.riskLevel || calcRiskLevel((a.riskScore || (a as any).severity * (a as any).probability) || 0);
            return (
              <button
                key={a.id}
                className="assessment-card"
                onClick={() => { setSelected(a); setError(null); }}
                aria-label={`Ver achado: ${a.title}`}
              >
                <div className="assessment-card-header">
                  <span className={RISK_LEVEL_CSS[level as RiskLevel] || 'risk-badge'}>
                    {RISK_LEVEL_LABELS[level as RiskLevel] || level}
                  </span>
                  <span className={CLASSIFICATION_CSS[a.classification] || 'badge badge-neutral'}>
                    {CLASSIFICATION_LABELS[a.classification] || a.classification}
                  </span>
                  <span className={`status-pill status-pill--${a.status}`}>
                    {{ investigating: 'Em investigação', evaluated: 'Avaliado', dismissed: 'Dispensado' }[a.status]}
                  </span>
                </div>
                <p className="assessment-title">{a.title}</p>
                <p className="assessment-factor">
                  <i className="fa-solid fa-tag mr-1" aria-hidden="true" />
                  {factorLabel(a.factor)}
                </p>
                {a.riskScore !== undefined && (
                  <p className="assessment-score">
                    Escore de Risco: <strong>{a.riskScore}</strong>
                    {a.severity !== undefined && a.probability !== undefined && (
                      <span className="text-muted"> (S{a.severity} × P{a.probability})</span>
                    )}
                  </p>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* ── Modal: Novo achado ─────────────────────────────────────────── */}
      {showForm && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Registrar achado de risco">
          <div className="modal-panel modal-panel--xl">
            <div className="modal-header">
              <h2 className="modal-title">Novo Achado de Risco Psicossocial</h2>
              <button className="modal-close" onClick={() => setShowForm(false)} aria-label="Fechar">
                <i className="fa-solid fa-xmark" aria-hidden="true" />
              </button>
            </div>

            <div className="modal-body form-grid">

              {/* Resultado de pesquisa */}
              <div className="form-group form-group--full">
                <label className="form-label" htmlFor="as-report">Resultado de Pesquisa (Publicado) <span className="required">*</span></label>
                {reports.length === 0 ? (
                  <p className="form-hint text-warning">
                    <i className="fa-solid fa-triangle-exclamation mr-1" aria-hidden="true" />
                    Nenhum resultado publicado. Publique um ciclo de pesquisa antes de registrar achados.
                  </p>
                ) : (
                  <select
                    id="as-report"
                    className="form-select"
                    value={form.reportId}
                    onChange={(e) => { setField('reportId', e.target.value); setField('factor', ''); }}
                  >
                    <option value="">— Selecione o resultado —</option>
                    {reports.map((r) => (
                      <option key={r.id} value={r.id}>{r.title} — {r.cycle}</option>
                    ))}
                  </select>
                )}
              </div>

              {/* Fator */}
              <div className="form-group">
                <label className="form-label" htmlFor="as-factor">Fator de Risco <span className="required">*</span></label>
                <select
                  id="as-factor"
                  className="form-select"
                  value={form.factor}
                  onChange={(e) => setField('factor', e.target.value)}
                  disabled={!form.reportId}
                >
                  <option value="">— Selecione o fator —</option>
                  {availableFactors.map((f) => (
                    <option key={f.key} value={f.key}>
                      {factorLabel(f.key)} (média: {f.mean?.toFixed(2)})
                    </option>
                  ))}
                </select>
              </div>

              {/* Grupo exposto */}
              <div className="form-group">
                <label className="form-label" htmlFor="as-group">Grupo Exposto</label>
                <input
                  id="as-group"
                  className="form-input"
                  type="text"
                  placeholder="Ex.: Setor Financeiro, turno tarde"
                  value={form.groupExposed}
                  onChange={(e) => setField('groupExposed', e.target.value)}
                />
              </div>

              {/* Título */}
              <div className="form-group form-group--full">
                <label className="form-label" htmlFor="as-title">Título do Achado <span className="required">*</span></label>
                <input
                  id="as-title"
                  className="form-input"
                  type="text"
                  placeholder="Ex.: Sobrecarga cognitiva — setor de atendimento ao cliente"
                  value={form.title}
                  onChange={(e) => setField('title', e.target.value)}
                  maxLength={160}
                />
              </div>

              {/* Perigo e Consequência */}
              <div className="form-group">
                <label className="form-label" htmlFor="as-hazard">Perigo / Fonte de Risco</label>
                <input
                  id="as-hazard"
                  className="form-input"
                  type="text"
                  placeholder="Ex.: Demandas emocionais excessivas, conflito com clientes"
                  value={form.hazard}
                  onChange={(e) => setField('hazard', e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="as-consequence">Consequência Potencial</label>
                <input
                  id="as-consequence"
                  className="form-input"
                  type="text"
                  placeholder="Ex.: Esgotamento, absenteísmo, afastamentos"
                  value={form.consequence}
                  onChange={(e) => setField('consequence', e.target.value)}
                />
              </div>

              {/* Matriz 5x5 ─────────────────────────────────────────── */}
              <div className="form-group form-group--full">
                <p className="form-label">Matriz de Risco 5×5 — Severidade × Probabilidade</p>
                <p className="form-hint mb-2">
                  Clique na célula que representa a combinação de severidade (linhas) e probabilidade (colunas).
                  Pontuação atual: <strong>{riskScore}</strong> —
                  <span className={RISK_LEVEL_CSS[riskLevel]}>{RISK_LEVEL_LABELS[riskLevel]}</span>
                </p>

                <div className="risk-matrix" role="grid" aria-label="Matriz de risco 5x5 severidade por probabilidade">
                  <div className="matrix-axis-label matrix-axis-col">Probabilidade →</div>
                  <div className="matrix-grid">
                    <div className="matrix-header-row">
                      <div className="matrix-corner" />
                      {[1, 2, 3, 4, 5].map((p) => (
                        <div key={p} className="matrix-header">P{p}</div>
                      ))}
                    </div>
                    {[5, 4, 3, 2, 1].map((s) => (
                      <div key={s} className="matrix-row" role="row">
                        <div className="matrix-row-label">S{s}</div>
                        {[1, 2, 3, 4, 5].map((p) => (
                          <MatrixCell key={p} s={s} p={p} />
                        ))}
                      </div>
                    ))}
                  </div>
                  <div className="matrix-axis-label matrix-axis-row">↑ Severidade</div>
                </div>
              </div>

              {/* Classificação */}
              <div className="form-group">
                <label className="form-label" htmlFor="as-classification">Prioridade Técnica</label>
                <select
                  id="as-classification"
                  className="form-select"
                  value={form.classification}
                  onChange={(e) => setField('classification', e.target.value)}
                >
                  <option value="pending">Aguardando classificação</option>
                  <option value="low">Baixa</option>
                  <option value="medium">Média</option>
                  <option value="high">Alta</option>
                </select>
              </div>

              {/* Contexto (2ª camada) */}
              <div className="form-group form-group--full">
                <label className="form-label" htmlFor="as-context">
                  Contexto Organizacional
                  <span className="form-hint"> (2ª camada — interpretação descritiva)</span>
                </label>
                <textarea
                  id="as-context"
                  className="form-textarea"
                  rows={3}
                  placeholder="Descreva o contexto, histórico e dados observados que sustentam este achado…"
                  value={form.context}
                  onChange={(e) => setField('context', e.target.value)}
                />
              </div>

              {/* Medidas existentes (3ª camada) */}
              <div className="form-group form-group--full">
                <label className="form-label" htmlFor="as-measures">
                  Medidas Existentes
                  <span className="form-hint"> (3ª camada — hipótese técnica)</span>
                </label>
                <textarea
                  id="as-measures"
                  className="form-textarea"
                  rows={2}
                  placeholder="Quais medidas de controle já existem? São eficazes?"
                  value={form.existingMeasures}
                  onChange={(e) => setField('existingMeasures', e.target.value)}
                />
              </div>

              {/* Aviso camadas */}
              <div className="form-group form-group--full">
                <div className="notice-box notice-box--warn">
                  <i className="fa-solid fa-triangle-exclamation notice-icon" aria-hidden="true" />
                  <span>
                    <strong>Este registro inicia como "Em investigação".</strong> A conclusão da
                    avaliação (4ª camada — decisão técnica) exige validação explícita do avaliador
                    habilitado. O sistema nunca auto-avalia um achado de risco.
                  </span>
                </div>
              </div>

              {error && <div className="form-group form-group--full"><p className="form-error">{error}</p></div>}
            </div>

            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowForm(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleSubmit} disabled={saving || reports.length === 0}>
                {saving
                  ? <><i className="fa-solid fa-spinner fa-spin mr-2" aria-hidden="true" />Registrando…</>
                  : <><i className="fa-solid fa-floppy-disk mr-2" aria-hidden="true" />Registrar Achado</>
                }
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Detalhe / Avaliação do achado ──────────────────────── */}
      {selected && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Detalhe do achado de risco">
          <div className="modal-panel">
            <div className="modal-header">
              <div>
                <div className="mb-1 flex gap-2 flex-wrap">
                  {selected.riskLevel && (
                    <span className={RISK_LEVEL_CSS[selected.riskLevel as RiskLevel] || 'risk-badge'}>
                      {RISK_LEVEL_LABELS[selected.riskLevel as RiskLevel] || selected.riskLevel}
                    </span>
                  )}
                  <span className={`status-pill status-pill--${selected.status}`}>
                    {{ investigating: 'Em investigação', evaluated: 'Avaliado', dismissed: 'Dispensado' }[selected.status]}
                  </span>
                </div>
                <h2 className="modal-title">{selected.title}</h2>
                <p className="text-sm color-text-muted">{factorLabel(selected.factor)}</p>
              </div>
              <button className="modal-close" onClick={() => { setSelected(null); setError(null); }} aria-label="Fechar">
                <i className="fa-solid fa-xmark" aria-hidden="true" />
              </button>
            </div>

            <div className="modal-body detail-grid">
              {selected.riskScore !== undefined && (
                <div className="detail-row">
                  <span className="detail-label">Escore de Risco</span>
                  <span>
                    <strong>{selected.riskScore}</strong>
                    {selected.severity !== undefined && (
                      <span className="text-muted"> (S{selected.severity} × P{selected.probability})</span>
                    )}
                  </span>
                </div>
              )}
              {selected.groupExposed && (
                <div className="detail-row">
                  <span className="detail-label">Grupo exposto</span>
                  <span>{selected.groupExposed}</span>
                </div>
              )}
              {selected.hazard && (
                <div className="detail-row">
                  <span className="detail-label">Perigo / Fonte</span>
                  <span>{selected.hazard}</span>
                </div>
              )}
              {selected.consequence && (
                <div className="detail-row">
                  <span className="detail-label">Consequência</span>
                  <span>{selected.consequence}</span>
                </div>
              )}
              {selected.context && (
                <div className="detail-row detail-row--full">
                  <span className="detail-label">Contexto (2ª camada)</span>
                  <p className="detail-text">{selected.context}</p>
                </div>
              )}
              {selected.existingMeasures && (
                <div className="detail-row detail-row--full">
                  <span className="detail-label">Medidas existentes (3ª camada)</span>
                  <p className="detail-text">{selected.existingMeasures}</p>
                </div>
              )}

              {/* Decisão técnica — 4ª camada */}
              {selected.status === 'investigating' && (
                <div className="detail-row detail-row--full">
                  <span className="detail-label">Decisão Técnica (4ª camada)</span>
                  <textarea
                    className="form-textarea"
                    rows={3}
                    placeholder="Registre a decisão técnica do avaliador habilitado antes de concluir…"
                    value={selected.decision || ''}
                    onChange={(e) => setSelected({ ...selected, decision: e.target.value })}
                  />
                </div>
              )}
              {selected.status === 'evaluated' && selected.decision && (
                <div className="detail-row detail-row--full">
                  <span className="detail-label">Decisão Técnica (4ª camada)</span>
                  <p className="detail-text">{selected.decision}</p>
                </div>
              )}

              {/* Aviso de não-diagnóstico */}
              <div className="detail-row detail-row--full">
                <div className="notice-box notice-box--warn">
                  <i className="fa-solid fa-triangle-exclamation notice-icon" aria-hidden="true" />
                  <span>
                    Esta avaliação é um <strong>instrumento de apoio ao PGR</strong>, não substitui
                    laudo pericial, diagnóstico clínico nem certifica conformidade legal com a NR-1.
                  </span>
                </div>
              </div>

              {error && <div className="detail-row detail-row--full"><p className="form-error">{error}</p></div>}
            </div>

            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => { setSelected(null); setError(null); }}>Fechar</button>
              {selected.status === 'investigating' && (
                <button
                  className="btn btn-primary"
                  onClick={() => handleEvaluate(selected)}
                  disabled={evaluating}
                  aria-label="Concluir avaliação — ação humana obrigatória"
                >
                  {evaluating
                    ? <><i className="fa-solid fa-spinner fa-spin mr-2" aria-hidden="true" />Validando…</>
                    : <><i className="fa-solid fa-circle-check mr-2" aria-hidden="true" />Concluir Avaliação</>
                  }
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
