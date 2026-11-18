import React, { useEffect, useState } from 'react';
import { get, post, put } from '../core/api';
import type { Action5W2H } from '../../../types';

interface ActionsViewProps {
  onOpenCreate?: () => void;
}

export const ActionsView: React.FC<ActionsViewProps> = () => {
  const [actions, setActions] = useState<Action5W2H[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Modal de criação
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [what, setWhat] = useState('');
  const [why, setWhy] = useState('');
  const [where, setWhere] = useState('Geral / Toda a Empresa');
  const [who, setWho] = useState('');
  const [dueDate, setDueDate] = useState(
    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [how, setHow] = useState('');
  const [controlHierarchy, setControlHierarchy] = useState<
    'eliminacao' | 'substituicao' | 'engenharia_coletiva' | 'administrativa' | 'individual'
  >('administrativa');
  const [efficacyCriteria, setEfficacyCriteria] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Modal de Evidência
  const [evidenceAction, setEvidenceAction] = useState<Action5W2H | null>(null);
  const [evidenceDesc, setEvidenceDesc] = useState('');

  // Modal de Aferição de Eficácia
  const [efficacyAction, setEfficacyAction] = useState<Action5W2H | null>(null);
  const [efficacyResult, setEfficacyResult] = useState<'effective' | 'ineffective'>('effective');
  const [efficacyNotes, setEfficacyNotes] = useState('');

  const loadActions = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await get<{ actions?: Action5W2H[] }>('/management/workspace');
      if (res?.actions && Array.isArray(res.actions)) {
        setActions(res.actions);
      }
    } catch (err: any) {
      setError(err?.message || 'Erro ao carregar planos de ação.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadActions();
  }, []);

  const handleCreateAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !what.trim() || !who.trim()) {
      setError('Preencha os campos obrigatórios (Título, O quê, Quem).');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      await post('/management/actions', {
        title: title.trim(),
        what: what.trim(),
        why: why.trim() || 'Prevenção de riscos psicossociais e conformidade NR-1',
        where: where.trim(),
        who: who.trim(),
        when: dueDate,
        dueDate,
        how: how.trim(),
        controlHierarchy,
        efficacyCriteria:
          efficacyCriteria.trim() || 'Acompanhamento no ciclo subsequente de escuta ativa',
        status: 'planned',
      });

      setSuccessMsg('Plano de ação cadastrado com sucesso!');
      setTimeout(() => setSuccessMsg(null), 4000);
      setIsModalOpen(false);
      resetForm();
      await loadActions();
    } catch (err: any) {
      setError(err?.message || 'Erro ao criar plano de ação.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateStatus = async (action: Action5W2H, newStatus: Action5W2H['status']) => {
    try {
      setError(null);
      await put(`/management/actions/${action.id}`, {
        ...action,
        status: newStatus,
        version: action.version,
      });
      await loadActions();
    } catch (err: any) {
      setError(err?.message || 'Erro ao atualizar status da ação.');
    }
  };

  const handleAddEvidence = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!evidenceAction || !evidenceDesc.trim()) return;

    try {
      setSubmitting(true);
      setError(null);
      await post(`/management/actions/${evidenceAction.id}/evidence`, {
        description: evidenceDesc.trim(),
        version: evidenceAction.version,
      });

      setSuccessMsg('Evidência anexada com sucesso!');
      setTimeout(() => setSuccessMsg(null), 4000);
      setEvidenceAction(null);
      setEvidenceDesc('');
      await loadActions();
    } catch (err: any) {
      setError(err?.message || 'Erro ao anexar evidência.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRecordEfficacy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!efficacyAction) return;

    try {
      setSubmitting(true);
      setError(null);
      await post(`/management/actions/${efficacyAction.id}/measurement`, {
        status: efficacyResult,
        notes: efficacyNotes.trim(),
        version: efficacyAction.version,
      });

      setSuccessMsg(`Aferição registrada: ação marcada como ${efficacyResult === 'effective' ? 'Eficaz' : 'Ineficaz'}!`);
      setTimeout(() => setSuccessMsg(null), 4000);
      setEfficacyAction(null);
      setEfficacyNotes('');
      await loadActions();
    } catch (err: any) {
      setError(err?.message || 'Erro ao registrar aferição de eficácia.');
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setTitle('');
    setWhat('');
    setWhy('');
    setWho('');
    setHow('');
    setEfficacyCriteria('');
  };

  const columns = [
    { id: 'planned', label: '1. Planejadas', icon: 'fa-regular fa-clock', color: 'badge-neutral' },
    { id: 'in_progress', label: '2. Em Execução', icon: 'fa-solid fa-person-digging', color: 'badge-primary' },
    { id: 'implemented', label: '3. Implantadas (Aferir)', icon: 'fa-solid fa-clipboard-check', color: 'badge-warning' },
    { id: 'effective', label: '4. Concluídas & Eficazes', icon: 'fa-solid fa-circle-check', color: 'badge-success' },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Planos de Ação</h1>
          <p className="page-subtitle">
            Acompanhamento de medidas preventivas, responsáveis, prazos e eficácia.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={() => {
            resetForm();
            setIsModalOpen(true);
          }}
        >
          <i className="fa-solid fa-plus mr-1" aria-hidden="true" /> Nova Ação
        </button>
      </div>

      {error && (
        <div className="alert alert-danger text-xs p-3 rounded-lg flex items-center gap-2">
          <i className="fa-solid fa-triangle-exclamation" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="alert alert-success text-xs p-3 rounded-lg flex items-center gap-2">
          <i className="fa-solid fa-circle-check" aria-hidden="true" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Kanban Board */}
      {loading ? (
        <div className="kanban-grid">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="skeleton h-96 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="kanban-grid">
          {columns.map((col) => {
            const colActions = actions.filter((a) => {
              if (col.id === 'effective') return a.status === 'effective';
              return a.status === col.id;
            });

            return (
              <div key={col.id} className="kanban-column">
                <div className="flex items-center justify-between mb-3 pb-2 border-b border-border">
                  <div className="flex items-center gap-2 font-semibold text-xs color-text-primary">
                    <i className={col.icon} aria-hidden="true" />
                    <span>{col.label}</span>
                  </div>
                  <span className={`badge ${col.color} text-[10px]`}>{colActions.length}</span>
                </div>

                <div className="space-y-3 flex-1 overflow-y-auto">
                  {colActions.length === 0 ? (
                    <div className="kanban-empty">
                      Nenhuma medida nesta etapa
                    </div>
                  ) : (
                    colActions.map((action) => (
                      <div
                        key={action.id}
                        className="card p-3 bg-surface border border-border shadow-xs hover:border-border-strong transition-all space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <span className="badge badge-neutral text-[9px] uppercase tracking-wider">
                            {action.controlHierarchy || 'administrativa'}
                          </span>
                          {action.dueDate && (
                            <span className="text-[10px] color-text-muted">
                              <i className="fa-regular fa-calendar mr-1" aria-hidden="true" />
                              {new Date(action.dueDate).toLocaleDateString('pt-BR')}
                            </span>
                          )}
                        </div>

                        <h4 className="font-semibold text-xs color-text-primary leading-tight m-0">{action.title}</h4>
                        <p className="text-[11px] color-text-secondary m-0 line-clamp-2">{action.what}</p>

                        <div className="text-[10px] color-text-muted pt-1 border-t border-border flex items-center justify-between">
                          <span>
                            <i className="fa-solid fa-user-tie mr-1" aria-hidden="true" />
                            {action.who}
                          </span>
                          {action.evidences && action.evidences.length > 0 && (
                            <span className="badge badge-neutral text-[9px]">
                              <i className="fa-solid fa-paperclip mr-1" aria-hidden="true" />
                              {action.evidences.length}
                            </span>
                          )}
                        </div>

                        {/* Ações contextuais de transição de fase */}
                        <div className="pt-2 flex flex-wrap items-center gap-1">
                          {col.id === 'planned' && (
                            <button
                              type="button"
                              className="btn btn-primary btn-xs w-full"
                              onClick={() => handleUpdateStatus(action, 'in_progress')}
                            >
                              Iniciar Execução →
                            </button>
                          )}
                          {col.id === 'in_progress' && (
                            <>
                              <button
                                type="button"
                                className="btn btn-secondary btn-xs flex-1"
                                onClick={() => setEvidenceAction(action)}
                              >
                                + Evidência
                              </button>
                              <button
                                type="button"
                                className="btn btn-warning btn-xs flex-1"
                                onClick={() => handleUpdateStatus(action, 'implemented')}
                              >
                                Concluir Implantação
                              </button>
                            </>
                          )}
                          {col.id === 'implemented' && (
                            <button
                              type="button"
                              className="btn btn-success btn-xs w-full"
                              onClick={() => setEfficacyAction(action)}
                            >
                              <i className="fa-solid fa-check-double mr-1" aria-hidden="true" /> Aferir Eficácia
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal 5W2H de Criação de Ação */}
      {isModalOpen && (
        <div className="dialog-overlay" role="dialog" aria-modal="true">
          <div className="dialog-box max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="dialog-header flex items-center justify-between pb-3 border-b border-border">
              <h2 className="dialog-title text-base font-bold m-0 text-primary">
                Cadastrar Medida Preventiva (Plano de Ação 5W2H)
              </h2>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setIsModalOpen(false)}>
                <i className="fa-solid fa-xmark" aria-hidden="true" />
              </button>
            </div>

            <form onSubmit={handleCreateAction} className="dialog-body space-y-4 pt-4">
              <div>
                <label className="label text-xs font-semibold block mb-1">Título da Ação *</label>
                <input
                  type="text"
                  className="input w-full text-xs"
                  placeholder="Ex: Treinamento em Gestão Humanizada e Prevenção ao Estresse"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="label text-xs font-semibold block mb-1">O quê? (What) - Descrição detalhada *</label>
                  <textarea
                    className="input w-full text-xs"
                    rows={2}
                    placeholder="Qual medida concreta será implementada..."
                    value={what}
                    onChange={(e) => setWhat(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="label text-xs font-semibold block mb-1">Por quê? (Why) - Justificativa técnica</label>
                  <textarea
                    className="input w-full text-xs"
                    rows={2}
                    placeholder="Motivação e vínculo com o fator de risco identificado..."
                    value={why}
                    onChange={(e) => setWhy(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="label text-xs font-semibold block mb-1">Quem? (Who) - Responsável *</label>
                  <input
                    type="text"
                    className="input w-full text-xs"
                    placeholder="Ex: Ana Clara (RH) / Carlos (SST)"
                    value={who}
                    onChange={(e) => setWho(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="label text-xs font-semibold block mb-1">Onde? (Where) - Local / Setor</label>
                  <input
                    type="text"
                    className="input w-full text-xs"
                    placeholder="Ex: Operações / Logística"
                    value={where}
                    onChange={(e) => setWhere(e.target.value)}
                  />
                </div>
                <div>
                  <label className="label text-xs font-semibold block mb-1">Quando? (When) - Prazo final</label>
                  <input
                    type="date"
                    className="input w-full text-xs"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="label text-xs font-semibold block mb-1">Hierarquia de Controle (NR-1.5.5)</label>
                  <select
                    className="input w-full text-xs"
                    value={controlHierarchy}
                    onChange={(e: any) => setControlHierarchy(e.target.value)}
                  >
                    <option value="eliminacao">1. Eliminação do fator</option>
                    <option value="substituicao">2. Substituição do processo</option>
                    <option value="engenharia_coletiva">3. Proteção coletiva / ambiente</option>
                    <option value="administrativa">4. Medida administrativa / organizacional</option>
                    <option value="individual">5. Medida de suporte individual</option>
                  </select>
                </div>
                <div>
                  <label className="label text-xs font-semibold block mb-1">Critério de Aferição da Eficácia</label>
                  <input
                    type="text"
                    className="input w-full text-xs"
                    placeholder="Ex: Redução de 20% nas queixas no ciclo seguinte"
                    value={efficacyCriteria}
                    onChange={(e) => setEfficacyCriteria(e.target.value)}
                  />
                </div>
              </div>

              <div className="dialog-footer pt-3 border-t border-border flex justify-end gap-2">
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setIsModalOpen(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary btn-sm" disabled={submitting}>
                  {submitting ? 'Salvando...' : 'Salvar Plano de Ação'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Anexar Evidência */}
      {evidenceAction && (
        <div className="dialog-overlay" role="dialog" aria-modal="true">
          <div className="dialog-box max-w-md">
            <div className="dialog-header pb-2 border-b border-border">
              <h3 className="dialog-title text-sm font-bold text-primary m-0">Registrar Evidência de Cumprimento</h3>
              <p className="text-[11px] color-text-muted mt-1">{evidenceAction.title}</p>
            </div>
            <form onSubmit={handleAddEvidence} className="dialog-body space-y-3 pt-3">
              <div>
                <label className="label text-xs font-semibold block mb-1">Descrição da Evidência *</label>
                <textarea
                  className="input w-full text-xs"
                  rows={3}
                  placeholder="Ex: Ata de reunião realizada em 15/11, lista de presença com 24 colaboradores participantes e cronograma de pausas implementado."
                  value={evidenceDesc}
                  onChange={(e) => setEvidenceDesc(e.target.value)}
                  required
                />
              </div>
              <div className="dialog-footer flex justify-end gap-2 pt-2 border-t border-border">
                <button type="button" className="btn btn-secondary btn-xs" onClick={() => setEvidenceAction(null)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary btn-xs" disabled={submitting}>
                  {submitting ? 'Salvando...' : 'Salvar Evidência'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Aferição de Eficácia */}
      {efficacyAction && (
        <div className="dialog-overlay" role="dialog" aria-modal="true">
          <div className="dialog-box max-w-md">
            <div className="dialog-header pb-2 border-b border-border">
              <h3 className="dialog-title text-sm font-bold text-primary m-0">Aferição de Eficácia (NR-1.5.5)</h3>
              <p className="text-[11px] color-text-muted mt-1">{efficacyAction.title}</p>
            </div>
            <form onSubmit={handleRecordEfficacy} className="dialog-body space-y-3 pt-3">
              <div>
                <label className="label text-xs font-semibold block mb-1">Resultado da Aferição *</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className={`btn btn-xs flex-1 ${efficacyResult === 'effective' ? 'btn-success' : 'btn-secondary'}`}
                    onClick={() => setEfficacyResult('effective')}
                  >
                    <i className="fa-solid fa-circle-check mr-1" aria-hidden="true" /> Eficaz
                  </button>
                  <button
                    type="button"
                    className={`btn btn-xs flex-1 ${efficacyResult === 'ineffective' ? 'btn-danger' : 'btn-secondary'}`}
                    onClick={() => setEfficacyResult('ineffective')}
                  >
                    <i className="fa-solid fa-circle-xmark mr-1" aria-hidden="true" /> Ineficaz / Ajustar
                  </button>
                </div>
              </div>
              <div>
                <label className="label text-xs font-semibold block mb-1">Parecer Técnico / Notas</label>
                <textarea
                  className="input w-full text-xs"
                  rows={3}
                  placeholder="Ex: Aferido no Ciclo 2 com aumento de 22% no fator de segurança psicológica e sem novos relatos de sobrecarga."
                  value={efficacyNotes}
                  onChange={(e) => setEfficacyNotes(e.target.value)}
                />
              </div>
              <div className="dialog-footer flex justify-end gap-2 pt-2 border-t border-border">
                <button type="button" className="btn btn-secondary btn-xs" onClick={() => setEfficacyAction(null)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary btn-xs" disabled={submitting}>
                  {submitting ? 'Gravando...' : 'Confirmar Aferição'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
