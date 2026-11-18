import React, { useEffect, useState } from 'react';
import { get, post } from '../core/api';
import type { Group } from '../../../types';

interface SurveyCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const CATALOG_MODELS = [
  {
    id: 'seguranca_psicologica',
    name: 'Segurança Psicológica & Autonomia (Escala Edmondson)',
    description: 'Avaliação de voz ativa, confiança mútua e abertura para relatar erros sem retaliação.',
    methodologicalStatus: 'Exploratório · Triagem inicial',
    category: 'Relacional',
  },
  {
    id: 'prevencao_assedio',
    name: 'Prevenção ao Assédio & Canal Protegido (Lei 14.457/22)',
    description: 'Protocolos de integridade, escuta ética e canais confidenciais de denúncia.',
    methodologicalStatus: 'Conformidade Lei 14.457/22 & NR-1',
    category: 'Organizacional',
  },
  {
    id: 'carga_trabalho',
    name: 'Exigências Psicológicas & Carga de Trabalho (NR-1 / NR-17)',
    description: 'Percepção de ritmo acelerado, prazos exíguos, interrupções frequentes e pausas.',
    methodologicalStatus: 'Exploratório · Suporte à AEP',
    category: 'Ergonômico / Psicossocial',
  },
  {
    id: 'organizacao_condicoes',
    name: 'Organização e Condições Gerais de Trabalho',
    description: 'Suporte da liderança, clareza de papéis, recursos materiais e reconhecimento.',
    methodologicalStatus: 'Exploratório · Mapeamento Geral',
    category: 'Geral',
  },
];

export const SurveyCreateModal: React.FC<SurveyCreateModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [title, setTitle] = useState('');
  const [cycle, setCycle] = useState(`Ciclo ${new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}`);
  const [model, setModel] = useState(CATALOG_MODELS[0].name);
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [channel, setChannel] = useState<'web' | 'whatsapp'>('web');
  const [durationDays, setDurationDays] = useState(30);
  const [groups, setGroups] = useState<Group[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      get<Group[]>('/groups')
        .then((data) => {
          if (Array.isArray(data)) {
            setGroups(data);
            if (data.length > 0 && selectedGroups.length === 0) {
              setSelectedGroups([data[0].id]);
            }
          }
        })
        .catch(() => {});
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Informe o título da pesquisa.');
      return;
    }
    if (selectedGroups.length === 0) {
      setError('Selecione pelo menos um setor ou grupo.');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      const startsAt = new Date().toISOString();
      const endsAt = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString();

      await post('/surveys', {
        title: title.trim(),
        cycle,
        model,
        groupIds: selectedGroups,
        collectionChannel: channel,
        startsAt,
        endsAt,
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Erro ao criar o ciclo de pesquisa.');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleGroup = (groupId: string) => {
    setSelectedGroups((prev) =>
      prev.includes(groupId) ? prev.filter((id) => id !== groupId) : [...prev, groupId]
    );
  };

  return (
    <div className="dialog-overlay" role="dialog" aria-modal="true">
      <div className="dialog-box max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="dialog-header flex items-center justify-between pb-3 border-b border-border">
          <div className="flex items-center gap-2">
            <i className="fa-solid fa-clipboard-list text-primary" aria-hidden="true" />
            <h2 className="dialog-title text-lg font-bold m-0">Abrir Novo Ciclo de Escuta & Avaliação</h2>
          </div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
            <i className="fa-solid fa-xmark" aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="dialog-body space-y-4 pt-4">
          {error && (
            <div className="alert alert-danger text-xs p-3 rounded-lg flex items-center gap-2">
              <i className="fa-solid fa-triangle-exclamation" aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}

          {/* Título e Ciclo */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label text-xs font-semibold block mb-1">Título da Pesquisa *</label>
              <input
                type="text"
                className="input w-full"
                placeholder="Ex: Escuta Psicossocial - Ciclo 1"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="label text-xs font-semibold block mb-1">Ciclo de Referência *</label>
              <input
                type="text"
                className="input w-full"
                placeholder="Ex: Ciclo Novembro/2026"
                value={cycle}
                onChange={(e) => setCycle(e.target.value)}
                required
              />
            </div>
          </div>

          {/* Seleção do Modelo Científico do Catálogo */}
          <div>
            <label className="label text-xs font-semibold block mb-2">Instrumento do Catálogo *</label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {CATALOG_MODELS.map((item) => (
                <div
                  key={item.id}
                  className={`card p-3 cursor-pointer border transition-all ${
                    model === item.name
                      ? 'border-primary bg-primary-subtle/10 ring-2 ring-primary/20'
                      : 'border-border hover:border-primary-light'
                  }`}
                  onClick={() => {
                    setModel(item.name);
                    if (!title) setTitle(item.name);
                  }}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="badge badge-neutral text-[10px]">{item.category}</span>
                    <span className="badge badge-primary text-[10px]">{item.methodologicalStatus}</span>
                  </div>
                  <h4 className="font-semibold text-xs mb-1 text-primary">{item.name}</h4>
                  <p className="text-[11px] color-text-secondary leading-snug">{item.description}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Setores e Grupos Alvo */}
          <div>
            <label className="label text-xs font-semibold block mb-1">Setores / Grupos Participantes *</label>
            <p className="text-[11px] color-text-muted mb-2">
              Selecione quais áreas responderão. Quórum de privacidade: apenas setores com 5 ou mais respostas exibem médias no relatório.
            </p>
            <div className="flex flex-wrap gap-2">
              {groups.map((group) => {
                const isSelected = selectedGroups.includes(group.id);
                return (
                  <button
                    type="button"
                    key={group.id}
                    className={`btn btn-xs ${isSelected ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => toggleGroup(group.id)}
                  >
                    <i
                      className={`fa-solid ${isSelected ? 'fa-check' : 'fa-plus'} mr-1 text-[10px]`}
                      aria-hidden="true"
                    />
                    {group.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Canal de Coleta e Duração */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label text-xs font-semibold block mb-1">Canal de Coleta</label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className={`btn btn-sm flex-1 ${channel === 'web' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setChannel('web')}
                >
                  <i className="fa-solid fa-globe mr-1" aria-hidden="true" /> Link Web Seguro
                </button>
                <button
                  type="button"
                  className={`btn btn-sm flex-1 ${channel === 'whatsapp' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setChannel('whatsapp')}
                >
                  <i className="fa-brands fa-whatsapp mr-1" aria-hidden="true" /> WhatsApp
                </button>
              </div>
            </div>

            <div>
              <label className="label text-xs font-semibold block mb-1">Duração do Período de Coleta</label>
              <select
                className="input w-full text-xs"
                value={durationDays}
                onChange={(e) => setDurationDays(Number(e.target.value))}
              >
                <option value={15}>15 dias de campo</option>
                <option value={30}>30 dias de campo (recomendado)</option>
                <option value={45}>45 dias de campo</option>
              </select>
            </div>
          </div>

          {/* Aviso Metodológico NR-1 / NR-17 */}
          <div className="p-3 bg-surface-subtle border border-border rounded-lg text-[11px] color-text-secondary">
            <strong className="font-semibold text-primary block mb-1">
              <i className="fa-solid fa-scale-balanced mr-1" aria-hidden="true" /> Governança Metodológica (NR-1 / NR-17)
            </strong>
            A pesquisa atua como triagem exploratória para identificação precoce de perigos. O resultado consolida percepções para direcionar a Análise Ergonômica Preliminar (AEP) e não substitui avaliações aprofundadas nem emite diagnóstico individual.
          </div>

          <div className="dialog-footer pt-3 border-t border-border flex justify-end gap-2">
            <button type="button" className="btn btn-secondary btn-sm" onClick={onClose} disabled={submitting}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary btn-sm" disabled={submitting}>
              {submitting ? (
                <>
                  <i className="fa-solid fa-spinner fa-spin mr-1" aria-hidden="true" /> Criando...
                </>
              ) : (
                <>
                  <i className="fa-solid fa-paper-plane mr-1" aria-hidden="true" /> Iniciar Coleta
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
