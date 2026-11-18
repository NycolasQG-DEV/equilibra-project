/**
 * EvidenceCollectionView — FASE 05 (EQ-008)
 *
 * Registra evidências complementares às pesquisas de clima psicossocial:
 * questionário | observação | grupo focal | entrevista | documento | indicador agregado
 *
 * Proteção de quórum: tipos com participantes exigem ≥ 5 para registrar
 * o número exato; abaixo disso, o campo é suprimido automaticamente.
 *
 * Zero onclick/style inline — 100% via CSS classes.
 */

import React, { useEffect, useState, useCallback } from 'react';
import { get, post, put, del } from '../core/api';

// ─── Types ───────────────────────────────────────────────────────────────────

type EvidenceType =
  | 'questionario'
  | 'observacao'
  | 'grupo_focal'
  | 'entrevista'
  | 'documento'
  | 'indicador_agregado';

interface EvidenceRecord {
  id: string;
  type: EvidenceType;
  title: string;
  collectionDate: string;
  responsibleName?: string;
  location?: string;
  activityDescription?: string;
  participantCount?: number;
  quorumSuppressed?: boolean;
  groupId?: string;
  surveyId?: string;
  observationNotes?: string;
  sourceDocument?: string;
  createdAt: string;
}

interface Group {
  id: string;
  name: string;
}

interface Survey {
  id: string;
  title: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<EvidenceType, string> = {
  questionario: 'Questionário Complementar',
  observacao: 'Observação de Campo',
  grupo_focal: 'Grupo Focal / Workshop',
  entrevista: 'Entrevista Individual',
  documento: 'Documento / Registro',
  indicador_agregado: 'Indicador Agregado',
};

const TYPE_ICONS: Record<EvidenceType, string> = {
  questionario: 'fa-clipboard-list',
  observacao: 'fa-eye',
  grupo_focal: 'fa-people-group',
  entrevista: 'fa-comments',
  documento: 'fa-file-lines',
  indicador_agregado: 'fa-chart-bar',
};

const QUORUM_TYPES: EvidenceType[] = ['questionario', 'grupo_focal', 'entrevista'];
const QUORUM_MIN = 5;

function typeHasParticipants(t: EvidenceType) {
  return QUORUM_TYPES.includes(t);
}

function formatDate(iso: string) {
  if (!iso) return '—';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

// ─── Form state ───────────────────────────────────────────────────────────────

interface FormState {
  type: EvidenceType;
  title: string;
  collectionDate: string;
  responsibleName: string;
  location: string;
  activityDescription: string;
  participantCount: string;
  groupId: string;
  surveyId: string;
  observationNotes: string;
  sourceDocument: string;
}

const EMPTY_FORM: FormState = {
  type: 'observacao',
  title: '',
  collectionDate: new Date().toISOString().slice(0, 10),
  responsibleName: '',
  location: '',
  activityDescription: '',
  participantCount: '',
  groupId: '',
  surveyId: '',
  observationNotes: '',
  sourceDocument: '',
};

// ─── Component ────────────────────────────────────────────────────────────────

export const EvidenceCollectionView: React.FC = () => {
  const [records, setRecords] = useState<EvidenceRecord[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<EvidenceType | 'todos'>('todos');
  const [detail, setDetail] = useState<EvidenceRecord | null>(null);

  // ─── Load ───────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [ev, gr, sv] = await Promise.all([
        get<EvidenceRecord[]>('/evidence'),
        get<Group[]>('/groups'),
        get<Survey[]>('/surveys'),
      ]);
      setRecords(Array.isArray(ev) ? ev : []);
      setGroups(Array.isArray(gr) ? gr : []);
      setSurveys(Array.isArray(sv) ? sv : []);
    } catch {
      // Silencioso
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ─── Form handlers ──────────────────────────────────────────────────────
  const setField = (field: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setError(null);
  };

  const handleSubmit = async () => {
    if (!form.title.trim()) return setError('Informe um título descritivo.');
    if (!form.collectionDate) return setError('Informe a data de coleta.');

    const count = Number(form.participantCount) || 0;
    if (typeHasParticipants(form.type) && count > 0 && count < QUORUM_MIN) {
      return setError(
        `Para garantir o sigilo individual, registros com menos de ${QUORUM_MIN} participantes não exibem a contagem. ` +
        `Você pode continuar sem informar o número ou aguardar mais participantes.`,
      );
    }

    try {
      setSaving(true);
      await post('/evidence', {
        ...form,
        participantCount: count || undefined,
      });
      setShowForm(false);
      setForm(EMPTY_FORM);
      await load();
    } catch (e: any) {
      setError(e?.message || 'Não foi possível salvar. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await del(`/evidence/${id}`);
      setDetail(null);
      await load();
    } catch {
      // Silencioso
    }
  };

  // ─── Filtered list ──────────────────────────────────────────────────────
  const filtered = filterType === 'todos'
    ? records
    : records.filter((r) => r.type === filterType);

  // ─── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="page-container">

      {/* ── Cabeçalho ─────────────────────────────────────────────────── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Coleta de Evidências</h1>
          <p className="page-subtitle">
            Registre observações de campo, grupos focais, entrevistas e documentos
            que complementam os dados das pesquisas de escuta ativa.
          </p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => { setShowForm(true); setError(null); setForm(EMPTY_FORM); }}
          aria-label="Registrar nova evidência"
        >
          <i className="fa-solid fa-plus mr-2" aria-hidden="true" />
          Nova Evidência
        </button>
      </div>

      {/* ── Aviso metodológico ─────────────────────────────────────────── */}
      <div className="notice-box notice-box--info">
        <i className="fa-solid fa-circle-info notice-icon" aria-hidden="true" />
        <span>
          As evidências registradas aqui são <strong>dados observados</strong> e servem de
          insumo para hipóteses técnicas. Interpretações e recomendações devem ser
          elaboradas por profissional habilitado e validadas antes de integrar o PGR.
        </span>
      </div>

      {/* ── Filtros por tipo ───────────────────────────────────────────── */}
      <div className="filter-tabs" role="tablist" aria-label="Filtrar por tipo de evidência">
        {(['todos', ...Object.keys(TYPE_LABELS)] as Array<EvidenceType | 'todos'>).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={filterType === t}
            className={`filter-tab ${filterType === t ? 'active filter-tab--active' : ''}`}
            onClick={() => setFilterType(t)}
          >
            {t === 'todos' ? 'Todas' : TYPE_LABELS[t as EvidenceType]}
            {t !== 'todos' && (
              <span className="filter-tab-count">
                {records.filter((r) => r.type === t).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Lista de evidências ────────────────────────────────────────── */}
      {loading ? (
        <div className="skeleton-list">
          {[1, 2, 3].map((i) => <div key={i} className="skeleton skeleton-row" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <i className="fa-solid fa-folder-open empty-state-icon" aria-hidden="true" />
          <p className="empty-state-title">Nenhuma evidência registrada</p>
          <p className="empty-state-desc mb-4">
            Registre observações de campo, grupos focais, entrevistas ou documentos para alimentar as hipóteses técnicas.
          </p>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => { setShowForm(true); setError(null); setForm(EMPTY_FORM); }}
          >
            <i className="fa-solid fa-plus mr-1" aria-hidden="true" /> Registrar Primeira Evidência
          </button>
        </div>
      ) : (
        <div className="evidence-grid">
          {filtered.map((rec) => (
            <button
              key={rec.id}
              className="evidence-card"
              onClick={() => setDetail(rec)}
              aria-label={`Ver detalhes: ${rec.title}`}
            >
              <div className="evidence-card-header">
                <span className="evidence-type-badge">
                  <i className={`fa-solid ${TYPE_ICONS[rec.type]} mr-1`} aria-hidden="true" />
                  {TYPE_LABELS[rec.type]}
                </span>
                <span className="evidence-date">{formatDate(rec.collectionDate)}</span>
              </div>
              <p className="evidence-title">{rec.title}</p>
              {rec.responsibleName && (
                <p className="evidence-meta">
                  <i className="fa-solid fa-user-tie mr-1" aria-hidden="true" />
                  {rec.responsibleName}
                </p>
              )}
              {rec.location && (
                <p className="evidence-meta">
                  <i className="fa-solid fa-location-dot mr-1" aria-hidden="true" />
                  {rec.location}
                </p>
              )}
              {typeHasParticipants(rec.type) && (
                <p className="evidence-meta">
                  <i className="fa-solid fa-users mr-1" aria-hidden="true" />
                  {rec.quorumSuppressed
                    ? <span className="text-warning">Contagem suprimida (sigilo)</span>
                    : rec.participantCount
                      ? `${rec.participantCount} participantes`
                      : 'Nº não informado'}
                </p>
              )}
            </button>
          ))}
        </div>
      )}

      {/* ── Modal: Formulário de nova evidência ───────────────────────── */}
      {showForm && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Registrar evidência">
          <div className="modal-panel modal-panel--lg">
            <div className="modal-header">
              <h2 className="modal-title">Registrar Evidência</h2>
              <button
                className="modal-close"
                onClick={() => setShowForm(false)}
                aria-label="Fechar formulário"
              >
                <i className="fa-solid fa-xmark" aria-hidden="true" />
              </button>
            </div>

            <div className="modal-body form-grid">

              {/* Tipo */}
              <div className="form-group form-group--full">
                <label className="form-label" htmlFor="ev-type">Tipo de Evidência</label>
                <div className="type-selector" role="group" aria-label="Tipo de evidência">
                  {(Object.keys(TYPE_LABELS) as EvidenceType[]).map((t) => (
                    <button
                      key={t}
                      type="button"
                      className={`type-option ${form.type === t ? 'type-option--selected' : ''}`}
                      onClick={() => setField('type', t)}
                    >
                      <i className={`fa-solid ${TYPE_ICONS[t]} type-option-icon`} aria-hidden="true" />
                      <span>{TYPE_LABELS[t]}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Título */}
              <div className="form-group form-group--full">
                <label className="form-label" htmlFor="ev-title">Título / Descrição Breve <span className="required">*</span></label>
                <input
                  id="ev-title"
                  className="form-input"
                  type="text"
                  placeholder="Ex.: Observação de campo — setor Financeiro, turno tarde"
                  value={form.title}
                  onChange={(e) => setField('title', e.target.value)}
                  maxLength={200}
                />
              </div>

              {/* Data + Local */}
              <div className="form-group">
                <label className="form-label" htmlFor="ev-date">Data de Coleta <span className="required">*</span></label>
                <input
                  id="ev-date"
                  className="form-input"
                  type="date"
                  value={form.collectionDate}
                  onChange={(e) => setField('collectionDate', e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="ev-location">Local / Ambiente</label>
                <input
                  id="ev-location"
                  className="form-input"
                  type="text"
                  placeholder="Ex.: Sala de reuniões B, andar 3"
                  value={form.location}
                  onChange={(e) => setField('location', e.target.value)}
                />
              </div>

              {/* Responsável */}
              <div className="form-group">
                <label className="form-label" htmlFor="ev-responsible">Responsável pela Coleta</label>
                <input
                  id="ev-responsible"
                  className="form-input"
                  type="text"
                  placeholder="Nome do técnico ou facilitador"
                  value={form.responsibleName}
                  onChange={(e) => setField('responsibleName', e.target.value)}
                />
              </div>

              {/* Nº de participantes (apenas tipos com quórum) */}
              {typeHasParticipants(form.type) && (
                <div className="form-group">
                  <label className="form-label" htmlFor="ev-count">
                    Nº de Participantes
                    <span className="form-hint"> (mín. {QUORUM_MIN} para exibir contagem)</span>
                  </label>
                  <input
                    id="ev-count"
                    className="form-input"
                    type="number"
                    min={1}
                    placeholder="Ex.: 8"
                    value={form.participantCount}
                    onChange={(e) => setField('participantCount', e.target.value)}
                  />
                </div>
              )}

              {/* Setor */}
              <div className="form-group">
                <label className="form-label" htmlFor="ev-group">Setor / Grupo</label>
                <select
                  id="ev-group"
                  className="form-select"
                  value={form.groupId}
                  onChange={(e) => setField('groupId', e.target.value)}
                >
                  <option value="">— Selecione (opcional) —</option>
                  {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </div>

              {/* Pesquisa vinculada */}
              <div className="form-group">
                <label className="form-label" htmlFor="ev-survey">Pesquisa Vinculada</label>
                <select
                  id="ev-survey"
                  className="form-select"
                  value={form.surveyId}
                  onChange={(e) => setField('surveyId', e.target.value)}
                >
                  <option value="">— Nenhuma (opcional) —</option>
                  {surveys.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
                </select>
              </div>

              {/* Descrição da atividade */}
              <div className="form-group form-group--full">
                <label className="form-label" htmlFor="ev-activity">Descrição da Atividade / Contexto</label>
                <textarea
                  id="ev-activity"
                  className="form-textarea"
                  rows={3}
                  placeholder="Descreva brevemente o que foi observado, discutido ou coletado…"
                  value={form.activityDescription}
                  onChange={(e) => setField('activityDescription', e.target.value)}
                />
              </div>

              {/* Notas / fonte de documento */}
              {form.type === 'documento' ? (
                <div className="form-group form-group--full">
                  <label className="form-label" htmlFor="ev-source">Nome / Referência do Documento</label>
                  <input
                    id="ev-source"
                    className="form-input"
                    type="text"
                    placeholder="Ex.: Relatório de absenteísmo Q3/2026"
                    value={form.sourceDocument}
                    onChange={(e) => setField('sourceDocument', e.target.value)}
                  />
                </div>
              ) : (
                <div className="form-group form-group--full">
                  <label className="form-label" htmlFor="ev-notes">Notas de Observação</label>
                  <textarea
                    id="ev-notes"
                    className="form-textarea"
                    rows={3}
                    placeholder="Anotações complementares, pontos de atenção, padrões observados…"
                    value={form.observationNotes}
                    onChange={(e) => setField('observationNotes', e.target.value)}
                  />
                </div>
              )}

              {/* Aviso de camadas */}
              <div className="form-group form-group--full">
                <div className="notice-box notice-box--warn">
                  <i className="fa-solid fa-triangle-exclamation notice-icon" aria-hidden="true" />
                  <span>
                    <strong>Dado observado — 1ª camada.</strong> Este registro não substitui interpretação
                    técnica nem compõe automaticamente o diagnóstico ou o PGR. A análise e os
                    encaminhamentos devem ser feitos por profissional habilitado.
                  </span>
                </div>
              </div>

              {/* Erro */}
              {error && (
                <div className="form-group form-group--full">
                  <p className="form-error">{error}</p>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowForm(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleSubmit} disabled={saving}>
                {saving
                  ? <><i className="fa-solid fa-spinner fa-spin mr-2" aria-hidden="true" />Salvando…</>
                  : <><i className="fa-solid fa-floppy-disk mr-2" aria-hidden="true" />Salvar Evidência</>
                }
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Detalhe de evidência ────────────────────────────────── */}
      {detail && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Detalhes da evidência">
          <div className="modal-panel">
            <div className="modal-header">
              <div>
                <span className="evidence-type-badge mb-1">
                  <i className={`fa-solid ${TYPE_ICONS[detail.type]} mr-1`} aria-hidden="true" />
                  {TYPE_LABELS[detail.type]}
                </span>
                <h2 className="modal-title">{detail.title}</h2>
              </div>
              <button className="modal-close" onClick={() => setDetail(null)} aria-label="Fechar">
                <i className="fa-solid fa-xmark" aria-hidden="true" />
              </button>
            </div>

            <div className="modal-body detail-grid">
              <div className="detail-row">
                <span className="detail-label">Data de coleta</span>
                <span>{formatDate(detail.collectionDate)}</span>
              </div>
              {detail.responsibleName && (
                <div className="detail-row">
                  <span className="detail-label">Responsável</span>
                  <span>{detail.responsibleName}</span>
                </div>
              )}
              {detail.location && (
                <div className="detail-row">
                  <span className="detail-label">Local</span>
                  <span>{detail.location}</span>
                </div>
              )}
              {typeHasParticipants(detail.type) && (
                <div className="detail-row">
                  <span className="detail-label">Participantes</span>
                  <span>
                    {detail.quorumSuppressed
                      ? '— (suprimido para garantir sigilo individual)'
                      : detail.participantCount ?? 'Não informado'}
                  </span>
                </div>
              )}
              {detail.activityDescription && (
                <div className="detail-row detail-row--full">
                  <span className="detail-label">Contexto</span>
                  <p className="detail-text">{detail.activityDescription}</p>
                </div>
              )}
              {detail.observationNotes && (
                <div className="detail-row detail-row--full">
                  <span className="detail-label">Notas</span>
                  <p className="detail-text">{detail.observationNotes}</p>
                </div>
              )}
              {detail.sourceDocument && (
                <div className="detail-row detail-row--full">
                  <span className="detail-label">Documento fonte</span>
                  <span>{detail.sourceDocument}</span>
                </div>
              )}

              <div className="detail-row detail-row--full">
                <div className="notice-box notice-box--info">
                  <i className="fa-solid fa-layer-group notice-icon" aria-hidden="true" />
                  <span>
                    <strong>Dado observado (1ª camada).</strong> Interpretações e hipóteses sobre este
                    registro devem ser elaboradas separadamente por profissional habilitado.
                  </span>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button
                className="btn btn-danger-ghost"
                onClick={() => handleDelete(detail.id)}
                aria-label="Excluir evidência"
              >
                <i className="fa-solid fa-trash-can mr-2" aria-hidden="true" />
                Excluir
              </button>
              <button className="btn btn-primary" onClick={() => setDetail(null)}>Fechar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
