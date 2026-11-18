import React, { useState } from 'react';
import { post } from '../core/api';

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  icon: string;
}

const STEPS: OnboardingStep[] = [
  {
    id: 'company',
    title: 'Perfil da Empresa',
    description: 'Configure os dados cadastrais e o contexto setorial da organização',
    icon: 'fa-building',
  },
  {
    id: 'establishment',
    title: 'Estabelecimento & Local',
    description: 'Informe o(s) estabelecimento(s) e endereço(s) onde os trabalhadores atuam',
    icon: 'fa-map-location-dot',
  },
  {
    id: 'structure',
    title: 'Estrutura Organizacional',
    description: 'Defina os setores, processos de trabalho, funções e jornadas predominantes',
    icon: 'fa-sitemap',
  },
  {
    id: 'review',
    title: 'Revisão & Confirmação',
    description: 'Revise o contexto cadastrado antes de iniciar o primeiro ciclo de escuta',
    icon: 'fa-circle-check',
  },
];

const SECTORS = [
  'Escritório & Serviços',
  'Indústria & Produção',
  'Logística & Transporte',
  'Varejo & Atendimento',
  'Saúde & Cuidado',
  'Educação',
  'Tecnologia',
  'Construção Civil',
  'Agronegócio',
  'Outro',
];

const SHIFT_TYPES = [
  { value: 'diurno', label: 'Diurno (fixo)' },
  { value: 'noturno', label: 'Noturno (fixo)' },
  { value: 'revezamento', label: 'Revezamento (turnos rotativos)' },
  { value: 'flexivel', label: 'Flexível / Home Office' },
  { value: 'hibrido', label: 'Híbrido (presencial + remoto)' },
];

interface OnboardingData {
  // Step 1: Company
  companyName: string;
  cnpj: string;
  sector: string;
  size: 'pequena' | 'media' | 'grande' | '';
  hasExistingPGR: boolean;
  // Step 2: Establishment
  establishmentName: string;
  address: string;
  city: string;
  state: string;
  cnae: string;
  totalWorkers: string;
  // Step 3: Structure
  departments: string[];
  newDepartment: string;
  activities: string[];
  newActivity: string;
  shiftTypes: string[];
  hasNightShift: boolean;
  hasIntensiveSchedule: boolean;
}

interface OnboardingViewProps {
  onComplete: () => void;
  onSkip?: () => void;
}

export const OnboardingView: React.FC<OnboardingViewProps> = ({ onComplete, onSkip }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [data, setData] = useState<OnboardingData>({
    companyName: '',
    cnpj: '',
    sector: '',
    size: '',
    hasExistingPGR: false,
    establishmentName: '',
    address: '',
    city: '',
    state: '',
    cnae: '',
    totalWorkers: '',
    departments: [],
    newDepartment: '',
    activities: [],
    newActivity: '',
    shiftTypes: [],
    hasNightShift: false,
    hasIntensiveSchedule: false,
  });

  const update = (key: keyof OnboardingData, value: any) => {
    setData((prev) => ({ ...prev, [key]: value }));
  };

  const addDepartment = () => {
    const name = data.newDepartment.trim();
    if (!name || data.departments.includes(name)) return;
    update('departments', [...data.departments, name]);
    update('newDepartment', '');
  };

  const removeDepartment = (name: string) => {
    update('departments', data.departments.filter((d) => d !== name));
  };

  const addActivity = () => {
    const name = data.newActivity.trim();
    if (!name || data.activities.includes(name)) return;
    update('activities', [...data.activities, name]);
    update('newActivity', '');
  };

  const removeActivity = (name: string) => {
    update('activities', data.activities.filter((a) => a !== name));
  };

  const toggleShift = (value: string) => {
    update(
      'shiftTypes',
      data.shiftTypes.includes(value)
        ? data.shiftTypes.filter((s) => s !== value)
        : [...data.shiftTypes, value]
    );
  };

  const handleNext = () => {
    setError(null);
    if (currentStep === 0 && !data.companyName.trim()) {
      setError('Informe o nome da empresa para continuar.');
      return;
    }
    if (currentStep === 1 && !data.establishmentName.trim()) {
      setError('Informe ao menos o nome do estabelecimento.');
      return;
    }
    setCurrentStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  const handleBack = () => {
    setError(null);
    setCurrentStep((s) => Math.max(s - 1, 0));
  };

  const handleFinish = async () => {
    try {
      setSaving(true);
      setError(null);

      // Salva grupos/setores via API real
      const deptNames = data.departments.length > 0
        ? data.departments
        : ['Geral'];

      for (const dept of deptNames) {
        try {
          await post('/groups', { name: dept });
        } catch {
          // Ignora se já existir
        }
      }

      // Salva contexto no meta da conta
      await post('/meta/account', {
        onboardingContext: {
          sector: data.sector,
          size: data.size,
          establishmentName: data.establishmentName,
          city: data.city,
          state: data.state,
          cnae: data.cnae,
          totalWorkers: data.totalWorkers ? parseInt(data.totalWorkers) : undefined,
          activities: data.activities,
          shiftTypes: data.shiftTypes,
          hasNightShift: data.hasNightShift,
          hasIntensiveSchedule: data.hasIntensiveSchedule,
          hasExistingPGR: data.hasExistingPGR,
          completedAt: new Date().toISOString(),
        },
      });

      onComplete();
    } catch (err: any) {
      setError(err?.message || 'Erro ao salvar configuração. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  const stepContent: Record<string, React.ReactNode> = {
    company: (
      <div className="space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="label text-xs font-semibold block mb-1">Nome da Empresa / Organização *</label>
            <input
              type="text"
              className="input w-full"
              placeholder="Razão social ou nome fantasia"
              value={data.companyName}
              onChange={(e) => update('companyName', e.target.value)}
              autoFocus
            />
          </div>

          <div>
            <label className="label text-xs font-semibold block mb-1">CNPJ</label>
            <input
              type="text"
              className="input w-full"
              placeholder="00.000.000/0001-00"
              value={data.cnpj}
              onChange={(e) => update('cnpj', e.target.value)}
            />
          </div>

          <div>
            <label className="label text-xs font-semibold block mb-1">Porte da Empresa</label>
            <select
              className="input w-full"
              value={data.size}
              onChange={(e) => update('size', e.target.value)}
            >
              <option value="">Selecione o porte</option>
              <option value="pequena">Microempresa / Pequena (até 99 colaboradores)</option>
              <option value="media">Média (100 a 499 colaboradores)</option>
              <option value="grande">Grande (500 ou mais colaboradores)</option>
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="label text-xs font-semibold block mb-2">Setor de Atuação</label>
            <div className="flex flex-wrap gap-2">
              {SECTORS.map((s) => (
                <button
                  type="button"
                  key={s}
                  className={`btn btn-xs ${data.sector === s ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => update('sector', s)}
                >
                  {data.sector === s && <i className="fa-solid fa-check mr-1 text-[10px]" aria-hidden="true" />}
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div className="md:col-span-2">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                className="w-4 h-4"
                checked={data.hasExistingPGR}
                onChange={(e) => update('hasExistingPGR', e.target.checked)}
              />
              <span className="text-xs font-medium">A organização já possui PGR estruturado</span>
            </label>
          </div>
        </div>
      </div>
    ),

    establishment: (
      <div className="space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="label text-xs font-semibold block mb-1">Nome do Estabelecimento Principal *</label>
            <input
              type="text"
              className="input w-full"
              placeholder="Ex: Matriz São Paulo / Filial Campinas"
              value={data.establishmentName}
              onChange={(e) => update('establishmentName', e.target.value)}
            />
          </div>

          <div className="md:col-span-2">
            <label className="label text-xs font-semibold block mb-1">Endereço</label>
            <input
              type="text"
              className="input w-full"
              placeholder="Rua, número, bairro"
              value={data.address}
              onChange={(e) => update('address', e.target.value)}
            />
          </div>

          <div>
            <label className="label text-xs font-semibold block mb-1">Cidade</label>
            <input
              type="text"
              className="input w-full"
              placeholder="Ex: São Paulo"
              value={data.city}
              onChange={(e) => update('city', e.target.value)}
            />
          </div>

          <div>
            <label className="label text-xs font-semibold block mb-1">Estado (UF)</label>
            <input
              type="text"
              className="input w-full"
              placeholder="Ex: SP"
              maxLength={2}
              value={data.state}
              onChange={(e) => update('state', e.target.value.toUpperCase())}
            />
          </div>

          <div>
            <label className="label text-xs font-semibold block mb-1">CNAE Principal</label>
            <input
              type="text"
              className="input w-full"
              placeholder="Ex: 7020-4/00"
              value={data.cnae}
              onChange={(e) => update('cnae', e.target.value)}
            />
            <p className="text-[11px] color-text-muted mt-1">Ramo de atividade econômica principal</p>
          </div>

          <div>
            <label className="label text-xs font-semibold block mb-1">Total de Trabalhadores no Local</label>
            <input
              type="number"
              className="input w-full"
              placeholder="Ex: 150"
              min={1}
              value={data.totalWorkers}
              onChange={(e) => update('totalWorkers', e.target.value)}
            />
          </div>
        </div>
      </div>
    ),

    structure: (
      <div className="space-y-5">
        {/* Setores / Departamentos */}
        <div>
          <label className="label text-xs font-semibold block mb-1">Setores / Departamentos da Empresa</label>
          <p className="text-[11px] color-text-muted mb-2">
            Departamentos para segmentação dos resultados. Setores com menos de 5 respostas são consolidados para preservar o anonimato.
          </p>
          <div className="flex gap-2 mb-3">
            <input
              type="text"
              className="input flex-1 text-xs"
              placeholder="Ex: Financeiro, Produção, Comercial..."
              value={data.newDepartment}
              onChange={(e) => update('newDepartment', e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addDepartment())}
            />
            <button type="button" className="btn btn-primary btn-sm" onClick={addDepartment}>
              <i className="fa-solid fa-plus" aria-hidden="true" /> Adicionar
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {data.departments.map((dept) => (
              <span key={dept} className="badge badge-primary text-xs flex items-center gap-1 pl-2 pr-1 py-1">
                {dept}
                <button
                  type="button"
                  className="ml-1 hover:text-white opacity-70 hover:opacity-100"
                  onClick={() => removeDepartment(dept)}
                >
                  <i className="fa-solid fa-xmark text-[9px]" aria-hidden="true" />
                </button>
              </span>
            ))}
            {data.departments.length === 0 && (
              <span className="text-[11px] color-text-muted">Nenhum setor adicionado — será criado um grupo "Geral" por padrão</span>
            )}
          </div>
        </div>

        {/* Processos / Atividades */}
        <div>
          <label className="label text-xs font-semibold block mb-1">Principais Processos & Atividades de Trabalho</label>
          <div className="flex gap-2 mb-3">
            <input
              type="text"
              className="input flex-1 text-xs"
              placeholder="Ex: Atendimento ao cliente, Operação de máquinas, Análise de dados..."
              value={data.newActivity}
              onChange={(e) => update('newActivity', e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addActivity())}
            />
            <button type="button" className="btn btn-primary btn-sm" onClick={addActivity}>
              <i className="fa-solid fa-plus" aria-hidden="true" /> Adicionar
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {data.activities.map((act) => (
              <span key={act} className="badge badge-neutral text-xs flex items-center gap-1 pl-2 pr-1 py-1">
                {act}
                <button
                  type="button"
                  className="ml-1 opacity-60 hover:opacity-100"
                  onClick={() => removeActivity(act)}
                >
                  <i className="fa-solid fa-xmark text-[9px]" aria-hidden="true" />
                </button>
              </span>
            ))}
          </div>
        </div>

        {/* Jornadas e Turnos */}
        <div>
          <label className="label text-xs font-semibold block mb-2">Tipos de Jornada & Turno Predominantes</label>
          <div className="flex flex-wrap gap-2">
            {SHIFT_TYPES.map((shift) => (
              <button
                type="button"
                key={shift.value}
                className={`btn btn-xs ${data.shiftTypes.includes(shift.value) ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => toggleShift(shift.value)}
              >
                {data.shiftTypes.includes(shift.value) && <i className="fa-solid fa-check mr-1 text-[10px]" aria-hidden="true" />}
                {shift.label}
              </button>
            ))}
          </div>
        </div>

        {/* Características da Rotina */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="flex items-start gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              className="w-4 h-4 mt-0.5"
              checked={data.hasNightShift}
              onChange={(e) => update('hasNightShift', e.target.checked)}
            />
            <span className="text-xs">
              <strong className="block">Trabalho noturno habitual</strong>
              <span className="color-text-muted">Turnos noturnos requerem atenção a pausas e fadiga</span>
            </span>
          </label>
          <label className="flex items-start gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              className="w-4 h-4 mt-0.5"
              checked={data.hasIntensiveSchedule}
              onChange={(e) => update('hasIntensiveSchedule', e.target.checked)}
            />
            <span className="text-xs">
              <strong className="block">Jornadas extensas ou sobreaviso</strong>
              <span className="color-text-muted">Horários sob demanda, viagens frequentes ou sobrecarga</span>
            </span>
          </label>
        </div>
      </div>
    ),

    review: (
      <div className="space-y-5">
        <div className="p-3 bg-success-subtle border border-success rounded-lg text-xs">
          <div className="font-bold text-success mb-1">
            <i className="fa-solid fa-circle-check mr-1" aria-hidden="true" /> Contexto organizacional configurado!
          </div>
          Revise os dados antes de confirmar. Você poderá atualizar este contexto sem alterar ciclos de escuta já encerrados.
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="card p-4 bg-surface border border-border space-y-2">
            <h4 className="text-xs font-bold text-primary flex items-center gap-1">
              <i className="fa-solid fa-building" aria-hidden="true" /> Empresa
            </h4>
            <div className="text-xs space-y-1 color-text-secondary">
              <p><strong>Nome:</strong> {data.companyName || '—'}</p>
              <p><strong>CNPJ:</strong> {data.cnpj || '—'}</p>
              <p><strong>Setor:</strong> {data.sector || '—'}</p>
              <p><strong>Porte:</strong> {data.size || '—'}</p>
              <p><strong>PGR existente:</strong> {data.hasExistingPGR ? 'Sim' : 'Não informado'}</p>
            </div>
          </div>

          <div className="card p-4 bg-surface border border-border space-y-2">
            <h4 className="text-xs font-bold text-primary flex items-center gap-1">
              <i className="fa-solid fa-map-location-dot" aria-hidden="true" /> Estabelecimento
            </h4>
            <div className="text-xs space-y-1 color-text-secondary">
              <p><strong>Nome:</strong> {data.establishmentName || '—'}</p>
              <p><strong>Local:</strong> {[data.city, data.state].filter(Boolean).join(' - ') || '—'}</p>
              <p><strong>CNAE:</strong> {data.cnae || '—'}</p>
              <p><strong>Trabalhadores:</strong> {data.totalWorkers || '—'}</p>
            </div>
          </div>

          <div className="card p-4 bg-surface border border-border space-y-2">
            <h4 className="text-xs font-bold text-primary flex items-center gap-1">
              <i className="fa-solid fa-layer-group" aria-hidden="true" /> Setores ({data.departments.length || 1})
            </h4>
            <div className="flex flex-wrap gap-1">
              {data.departments.length > 0
                ? data.departments.map((d) => (
                    <span key={d} className="badge badge-primary text-[10px]">{d}</span>
                  ))
                : <span className="badge badge-neutral text-[10px]">Geral (padrão)</span>}
            </div>
          </div>

          <div className="card p-4 bg-surface border border-border space-y-2">
            <h4 className="text-xs font-bold text-primary flex items-center gap-1">
              <i className="fa-solid fa-gear" aria-hidden="true" /> Jornadas & Riscos
            </h4>
            <div className="text-xs color-text-secondary space-y-1">
              <div className="flex flex-wrap gap-1">
                {data.shiftTypes.length > 0
                  ? data.shiftTypes.map((s) => (
                      <span key={s} className="badge badge-neutral text-[10px]">{s}</span>
                    ))
                  : <span className="color-text-muted">Não informado</span>}
              </div>
              {data.hasNightShift && <p className="text-warning font-medium">⚠ Trabalho noturno habitual</p>}
              {data.hasIntensiveSchedule && <p className="text-warning font-medium">⚠ Jornadas extensas / prontidão</p>}
            </div>
          </div>
        </div>
      </div>
    ),
  };

  return (
    <div className="min-h-screen bg-surface-subtle flex items-start justify-center px-4 py-8">
      <div className="w-full max-w-3xl space-y-6">
        {/* Header */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary text-white text-2xl mb-3 shadow-lg">
            <i className="fa-solid fa-scale-balanced" aria-hidden="true" />
          </div>
          <h1 className="text-2xl font-extrabold text-primary">Configuração Inicial</h1>
          <p className="text-sm color-text-secondary text-center max-w-md mx-auto">
            Cadastre as informações da organização para personalizar as escutas e diagnósticos.
          </p>
        </div>

        {/* Progress de Etapas */}
        <div className="flex items-center gap-0">
          {STEPS.map((step, idx) => (
            <React.Fragment key={step.id}>
              <div className="flex flex-col items-center flex-1">
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all ${
                    idx < currentStep
                      ? 'bg-success border-success text-white'
                      : idx === currentStep
                      ? 'bg-primary border-primary text-white'
                      : 'bg-surface border-border color-text-muted'
                  }`}
                >
                  {idx < currentStep ? (
                    <i className="fa-solid fa-check text-xs" aria-hidden="true" />
                  ) : (
                    idx + 1
                  )}
                </div>
                <span
                  className={`text-[10px] mt-1 text-center max-w-[80px] leading-tight ${
                    idx === currentStep ? 'font-bold text-primary' : 'color-text-muted'
                  }`}
                >
                  {step.title}
                </span>
              </div>
              {idx < STEPS.length - 1 && (
                <div
                  className={`flex-1 h-0.5 mb-5 transition-colors ${
                    idx < currentStep ? 'bg-success' : 'bg-border'
                  }`}
                />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Card da Etapa */}
        <div className="card p-6 bg-surface border border-border shadow-sm">
          <div className="flex items-center gap-3 mb-5 pb-3 border-b border-border">
            <div className="w-10 h-10 rounded-xl bg-primary-subtle flex items-center justify-center text-primary">
              <i className={`fa-solid ${STEPS[currentStep].icon} text-lg`} aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-base font-bold text-primary m-0">{STEPS[currentStep].title}</h2>
              <p className="text-xs color-text-muted m-0">{STEPS[currentStep].description}</p>
            </div>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-danger-subtle border border-danger rounded-lg text-xs flex items-center gap-2 text-danger">
              <i className="fa-solid fa-triangle-exclamation" aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}

          {stepContent[STEPS[currentStep].id]}
        </div>

        {/* Navegação */}
        <div className="flex items-center justify-between gap-4">
          <div>
            {onSkip && currentStep === 0 && (
              <button type="button" className="btn btn-ghost btn-sm text-xs color-text-muted" onClick={onSkip}>
                Configurar depois
              </button>
            )}
            {currentStep > 0 && (
              <button type="button" className="btn btn-secondary btn-sm" onClick={handleBack}>
                <i className="fa-solid fa-arrow-left mr-1" aria-hidden="true" /> Voltar
              </button>
            )}
          </div>

          <div>
            {currentStep < STEPS.length - 1 ? (
              <button type="button" className="btn btn-primary btn-sm" onClick={handleNext}>
                Avançar <i className="fa-solid fa-arrow-right ml-1" aria-hidden="true" />
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-primary btn-sm font-bold"
                onClick={handleFinish}
                disabled={saving}
              >
                {saving ? (
                  <>
                    <i className="fa-solid fa-spinner fa-spin mr-1" aria-hidden="true" /> Salvando...
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-circle-check mr-1" aria-hidden="true" /> Confirmar & Iniciar Plataforma
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
