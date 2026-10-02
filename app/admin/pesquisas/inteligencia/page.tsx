'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import QRCode from 'qrcode';
import { useAuth } from '@/hooks/useAuth';
import { authenticatedFetch } from '@/lib/api-client';
import { privacyWarnings, type Question } from '@/lib/product/shared';
import { PageReveal } from '@/components/admin/PageReveal';
import { SectorProfile, DEFAULT_SECTOR_TEMPLATES } from '@/lib/product/sectors';

type Template = {
  id: string;
  organization_id: string;
  kind: 'master' | 'custom';
  title: string;
  description: string;
  questions: Question[];
  active: boolean;
  invites_per_run: number;
};

type Run = {
  id: string;
  title: string;
  sector: string;
  closed_at: string | null;
  invited: number;
  completed: number;
  opened_at: string;
};

const Icon = ({ name }: { name: string }) => (
  <span aria-hidden="true" className="material-symbols-outlined" style={{ fontSize: '20px', lineHeight: 1 }}>
    {name}
  </span>
);

export default function SurveysPage() {
  const { user, loading } = useAuth('admin');
  const [company, setCompany] = useState<{ id: string; name: string } | null>(null);
  const [companyName, setCompanyName] = useState('');
  const [templates, setTemplates] = useState<Template[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [sectors, setSectors] = useState<SectorProfile[]>([]);
  const [ready, setReady] = useState(false);

  // Navegação de abas principais
  const [section, setSection] = useState<'campaigns' | 'sectors' | 'library'>('campaigns');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'open' | 'closed'>('all');

  // Wizard de Criação de Pesquisa
  const [step, setStep] = useState(0);
  const [editing, setEditing] = useState('');
  const [kind, setKind] = useState<'master' | 'custom'>('custom');
  const [title, setTitle] = useState('');
  const [selectedSectorId, setSelectedSectorId] = useState<string>('');
  const [objective, setObjective] = useState('');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [preview, setPreview] = useState(false);
  const [targetQuantity, setTargetQuantity] = useState(25);

  // Modal de Setor
  const [sectorModalOpen, setSectorModalOpen] = useState(false);
  const [editingSector, setEditingSector] = useState<SectorProfile | null>(null);
  const [sectorForm, setSectorForm] = useState({
    name: '',
    roles: '',
    workModel: 'presencial' as 'presencial' | 'hibrido' | 'remoto',
    routineDescription: '',
    shiftHours: 8,
    hasOvertimeExpected: false,
    breakPolicy: 'Pausas regulares.',
    plannedBaseline: { volume: 3, clarity: 4, autonomy: 3, support: 4, recognition: 4, relations: 4 },
  });

  // Modal de Disparo / Link Único
  const [launch, setLaunch] = useState<Template | null>(null);
  const [launchSector, setLaunchSector] = useState('Toda a empresa');
  const [launchQty, setLaunchQty] = useState(20);
  const [activeSingleLink, setActiveSingleLink] = useState<{ runId: string; url: string; qrUrl: string } | null>(null);

  // Carregar dados
  const load = useCallback(async () => {
    const r = await authenticatedFetch('/api/product');
    const d = await r.json();
    if (!r.ok) throw new Error(d.error || 'Erro ao carregar dados.');
    setCompany(d.organizations[0] || null);
    setTemplates(d.templates || []);
    setRuns(d.runs || []);
    setSectors(d.sectors || []);
    setReady(true);
  }, []);

  useEffect(() => {
    if (user) load().catch((e) => { setError(e.message); setReady(true); });
  }, [user, load]);

  async function act(body: Record<string, unknown>) {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const r = await authenticatedFetch('/api/product', { method: 'POST', body: JSON.stringify(body) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      return d;
    } catch (e) {
      setError((e as Error).message);
      return null;
    } finally {
      setBusy(false);
    }
  }

  // Abertura do formulário de setor
  function openSectorForm(sec?: SectorProfile) {
    if (sec) {
      setEditingSector(sec);
      setSectorForm({
        name: sec.name,
        roles: sec.roles.join(', '),
        workModel: sec.workModel,
        routineDescription: sec.routineDescription,
        shiftHours: sec.shiftHours,
        hasOvertimeExpected: sec.hasOvertimeExpected,
        breakPolicy: sec.breakPolicy,
        plannedBaseline: sec.plannedBaseline,
      });
    } else {
      setEditingSector(null);
      setSectorForm({
        name: '',
        roles: '',
        workModel: 'presencial',
        routineDescription: '',
        shiftHours: 8,
        hasOvertimeExpected: false,
        breakPolicy: 'Pausas regulares de 15min + almoço.',
        plannedBaseline: { volume: 3, clarity: 4, autonomy: 3, support: 4, recognition: 4, relations: 4 },
      });
    }
    setSectorModalOpen(true);
  }

  async function handleSaveSector(e: React.FormEvent) {
    e.preventDefault();
    if (!company) return;
    const rolesArray = sectorForm.roles.split(',').map((r) => r.trim()).filter(Boolean);
    const d = await act({
      action: 'save-sector',
      organizationId: company.id,
      id: editingSector?.id,
      name: sectorForm.name,
      roles: rolesArray.length ? rolesArray : ['Geral'],
      workModel: sectorForm.workModel,
      routineDescription: sectorForm.routineDescription,
      shiftHours: sectorForm.shiftHours,
      hasOvertimeExpected: sectorForm.hasOvertimeExpected,
      breakPolicy: sectorForm.breakPolicy,
      plannedBaseline: sectorForm.plannedBaseline,
    });
    if (d) {
      setSectorModalOpen(false);
      setMessage('Setor e rotina ocupacional salvos com sucesso!');
      await load();
    }
  }

  // Geração de Perguntas com IA usando o Setor Selecionado
  async function generateWithAi() {
    if (!title.trim() || title.length < 3) {
      setError('Dê um título à pesquisa antes de gerar as perguntas.');
      return;
    }
    const sec = sectors.find((s) => s.id === selectedSectorId);
    const sectorName = sec ? sec.name : 'Geral';
    const sectorContext = sec
      ? {
          roles: sec.roles,
          routineDescription: sec.routineDescription,
          shiftHours: sec.shiftHours,
          breakPolicy: sec.breakPolicy,
          workModel: sec.workModel,
          hasOvertimeExpected: sec.hasOvertimeExpected,
        }
      : undefined;

    const d = await act({
      action: 'draft',
      kind: 'custom',
      objective: objective || `Diagnóstico de riscos psicossociais e atritos na rotina do setor ${sectorName}`,
      sector: sectorName,
      sectorContext,
    });

    if (d?.questions) {
      setQuestions(d.questions);
      setStep(2);
      setMessage('Perguntas formuladas com sucesso pela IA com base na rotina do setor!');
    }
  }

  // Iniciar criação de pesquisa
  function startNewSurvey() {
    setEditing('');
    setTitle('');
    setObjective('');
    setQuestions([]);
    setKind('custom');
    setSelectedSectorId(sectors[0]?.id || '');
    setStep(1);
    setPreview(false);
    setError('');
  }

  async function handleSaveTemplate() {
    if (!company) return;
    const d = await act({
      action: editing ? 'update-template' : 'template',
      templateId: editing || undefined,
      organizationId: company.id,
      kind,
      title,
      description: objective,
      questions,
      invitesPerRun: targetQuantity,
    });
    if (d) {
      await load();
      setStep(0);
      setSection('campaigns');
      setMessage('Pesquisa configurada e pronta para ser disparada!');
    }
  }

  // Disparo direto com Link Único
  async function handleLaunchRun(template: Template) {
    const sec = sectors.find((s) => s.id === selectedSectorId) || sectors[0];
    const sectorName = sec ? sec.name : launchSector || 'Toda a empresa';
    const d = await act({
      action: 'run',
      templateId: template.id,
      sector: sectorName,
      quantity: launchQty,
    });
    if (d?.runId) {
      const url = `${window.location.origin}/responder/${d.runId}`;
      const qrUrl = await QRCode.toDataURL(url, { width: 280, margin: 2 });
      setActiveSingleLink({ runId: d.runId, url, qrUrl });
      setLaunch(null);
      await load();
      setMessage('Campanha iniciada! Copie o link único ou baixe o QR Code abaixo.');
    }
  }

  async function copyLink(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setMessage('Link único copiado para a área de transferência!');
    } catch {
      setError('Não foi possível copiar o link automaticamente.');
    }
  }

  async function toggleRunState(run: Run, close: boolean) {
    const d = await act({ action: close ? 'close' : 'reopen', runId: run.id });
    if (d) {
      await load();
      setMessage(close ? 'Coleta encerrada com sucesso.' : 'Coleta reaberta.');
    }
  }

  const validQuestions =
    questions.length >= 5 &&
    questions.length <= 10 &&
    questions.every((q) => q.text.trim().length >= 12 && q.text.trim().length <= 280) &&
    questions.some((q) => q.type === 'likert') &&
    questions.some((q) => q.type === 'text') &&
    !privacyWarnings(questions).length;

  const filteredRuns = runs.filter(
    (r) =>
      (r.title + ' ' + r.sector).toLowerCase().includes(search.toLowerCase()) &&
      (filter === 'all' || (filter === 'open' ? !r.closed_at : !!r.closed_at))
  );

  if (loading || !ready) {
    return (
      <main className="eq-page space-y-6">
        <div className="eq-skeleton h-16" />
        <div className="eq-skeleton tall" />
      </main>
    );
  }

  return (
    <main className="eq-page space-y-6 pb-20">
      <PageReveal selector=".eq-panel, .eq-toolbar, .eq-campaign, .eq-template" />
      <div className="eq-breadcrumb">
        ESPAÇO DA EMPRESA <span>/</span> GESTÃO DE PESQUISAS & RISCOS PSICOSSOCIAIS
      </div>

      {/* Header */}
      <header className="eq-page-heading flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">
            {step ? 'Configuração de Pesquisa' : 'Pesquisas & Mapeamento de Rotinas'}
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            {step
              ? 'Conecte a rotina prevista do setor ao formulário para apuração de riscos.'
              : 'Gerencie coletas com Link Único, cadastre rotinas e compare expectativa com realidade.'}
          </p>
        </div>

        {!step && company && (
          <div className="flex gap-3">
            <button onClick={() => openSectorForm()} className="eq-secondary flex items-center gap-2">
              <Icon name="domain_add" />
              Cadastrar Setor & Rotina
            </button>
            <button onClick={startNewSurvey} className="eq-primary flex items-center gap-2">
              <Icon name="add_circle" />
              Nova Pesquisa com IA
            </button>
          </div>
        )}

        {step > 0 && (
          <button onClick={() => { setStep(0); setError(''); }} className="eq-secondary flex items-center gap-2">
            <Icon name="arrow_back" /> Voltar ao Painel
          </button>
        )}
      </header>

      {/* Avisos */}
      {error && (
        <div role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-800 flex justify-between items-center">
          <span>{error}</span>
          <button onClick={() => setError('')} className="font-bold">✕</button>
        </div>
      )}
      {message && (
        <div role="status" className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800 flex justify-between items-center">
          <span>{message}</span>
          <button onClick={() => setMessage('')} className="font-bold">✕</button>
        </div>
      )}

      {/* Onboarding se não houver empresa */}
      {!company ? (
        <section className="eq-panel max-w-xl mx-auto text-center py-10 space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-purple-100 text-purple-900 mx-auto flex items-center justify-center">
            <Icon name="domain" />
          </div>
          <h2 className="text-xl font-bold">Identifique sua empresa</h2>
          <p className="text-xs text-slate-600">Cadastre a empresa para organizar setores, gerar links e apurar conformidade.</p>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const d = await act({ action: 'organization', name: companyName });
              if (d) await load();
            }}
            className="flex gap-3 max-w-md mx-auto"
          >
            <input
              className="eq-input"
              required
              minLength={2}
              maxLength={160}
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="Ex: Empresa Silva & Cia"
            />
            <button className="eq-primary whitespace-nowrap" disabled={busy}>Cadastrar</button>
          </form>
        </section>
      ) : step > 0 ? (
        /* WIZARD DE CRIAÇÃO COM IA */
        <section className="eq-panel space-y-6">
          <div className="flex justify-between items-center border-b pb-4">
            <span className="text-xs font-extrabold uppercase tracking-wider text-purple-800">
              Etapa {step} de 3: {step === 1 ? 'Contexto e Rotina' : step === 2 ? 'Revisão das Perguntas' : 'Finalização'}
            </span>
            <span className="text-xs text-slate-500">IA Groq ativada para alinhamento NR-1</span>
          </div>

          {step === 1 && (
            <div className="space-y-5">
              <div>
                <label className="block text-xs font-bold text-slate-700">1. Título da Pesquisa</label>
                <input
                  className="eq-input mt-1"
                  value={title}
                  maxLength={160}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ex: Diagnóstico de Rotina e Condições - Outubro"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700">2. Setor Alvo (com Rotina Cadastrada)</label>
                  <select
                    className="eq-input mt-1"
                    value={selectedSectorId}
                    onChange={(e) => setSelectedSectorId(e.target.value)}
                  >
                    <option value="">Geral / Toda a empresa</option>
                    {sectors.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.roles.join(', ')})
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-[11px] text-slate-500">
                    A IA utilizará a rotina e os cargos cadastrados deste setor para criar perguntas específicas.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700">3. Meta Esperada de Respondentes</label>
                  <input
                    type="number"
                    min={5}
                    max={5000}
                    className="eq-input mt-1"
                    value={targetQuantity}
                    onChange={(e) => setTargetQuantity(Number(e.target.value))}
                  />
                  <p className="mt-1 text-[11px] text-slate-500">
                    O Link Único aceitará respostas anônimas até atingir o limite ou encerramento manual.
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700">
                  4. Objetivo ou Ponto de Atenção Específico (Opcional)
                </label>
                <textarea
                  className="eq-input mt-1"
                  rows={3}
                  value={objective}
                  onChange={(e) => setObjective(e.target.value)}
                  placeholder="Ex: Verificar se as horas extras estão gerando sobrecarga ou se as pausas regulamentadas estão sendo respeitadas."
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <button
                  type="button"
                  disabled={busy || title.trim().length < 3}
                  onClick={generateWithAi}
                  className="eq-primary flex items-center gap-2"
                >
                  <Icon name="auto_awesome" />
                  {busy ? 'Gerando com IA...' : 'Gerar Perguntas Contextualizadas com IA'}
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="font-bold text-sm text-slate-900">Perguntas Geradas ({questions.length})</h3>
                  <p className="text-xs text-slate-500">Revise, edite ou adicione perguntas conforme necessário.</p>
                </div>
                <button onClick={() => setPreview(!preview)} className="eq-secondary text-xs">
                  {preview ? 'Modo Edição' : 'Pré-visualizar Formulário'}
                </button>
              </div>

              <div className="space-y-3">
                {questions.map((q, i) => (
                  <div key={q.id} className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                    <div className="flex items-start gap-3">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-purple-100 text-xs font-bold text-purple-900">
                        {i + 1}
                      </span>
                      <div className="flex-1 space-y-2">
                        {preview ? (
                          <div>
                            <p className="text-sm font-semibold text-slate-800">{q.text}</p>
                            <span className="text-[11px] text-slate-500 uppercase font-bold">
                              {q.type === 'likert' ? 'Escala de 1 a 5 (Nunca a Sempre)' : 'Resposta Aberta Anônima'}
                            </span>
                          </div>
                        ) : (
                          <textarea
                            className="eq-input text-xs"
                            rows={2}
                            value={q.text}
                            onChange={(e) =>
                              setQuestions((old) => old.map((x, n) => (n === i ? { ...x, text: e.target.value } : x)))
                            }
                          />
                        )}
                      </div>
                      {!preview && (
                        <button
                          onClick={() => setQuestions((old) => old.filter((_, n) => n !== i))}
                          className="text-red-500 hover:text-red-700 text-xs font-bold px-2 py-1"
                        >
                          Remover
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-between items-center pt-4 border-t">
                <button onClick={() => setStep(1)} className="eq-secondary">Voltar</button>
                <button
                  disabled={!validQuestions || busy}
                  onClick={handleSaveTemplate}
                  className="eq-primary flex items-center gap-2"
                >
                  <Icon name="check" /> Salvar Modelo e Iniciar Campanha
                </button>
              </div>
            </div>
          )}
        </section>
      ) : (
        /* VISÃO PRINCIPAL COM ABAS */
        <>
          {/* Navegação de Abas */}
          <div className="flex gap-4 border-b border-purple-100 pb-2">
            <button
              onClick={() => setSection('campaigns')}
              className={`pb-2 text-sm font-bold transition-all border-b-2 ${
                section === 'campaigns' ? 'border-[#3d1a6e] text-[#3d1a6e]' : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              📋 Campanhas em Andamento ({runs.length})
            </button>
            <button
              onClick={() => setSection('sectors')}
              className={`pb-2 text-sm font-bold transition-all border-b-2 ${
                section === 'sectors' ? 'border-[#3d1a6e] text-[#3d1a6e]' : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              🏢 Setores & Rotinas Previstas ({sectors.length})
            </button>
            <button
              onClick={() => setSection('library')}
              className={`pb-2 text-sm font-bold transition-all border-b-2 ${
                section === 'library' ? 'border-[#3d1a6e] text-[#3d1a6e]' : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              📚 Modelos Salvos ({templates.length})
            </button>
          </div>

          {/* ABA 1: CAMPANHAS EM ANDAMENTO */}
          {section === 'campaigns' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex gap-2">
                  {(['all', 'open', 'closed'] as const).map((v) => (
                    <button
                      key={v}
                      onClick={() => setFilter(v)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                        filter === v ? 'bg-purple-100 text-purple-900' : 'bg-white text-slate-600 border'
                      }`}
                    >
                      {v === 'all' ? 'Todas' : v === 'open' ? '🟢 Em Coleta' : '⚪ Encerradas'}
                    </button>
                  ))}
                </div>
                <input
                  className="eq-input max-w-xs text-xs py-1.5"
                  placeholder="Filtrar campanhas..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              <div className="grid gap-4">
                {filteredRuns.map((r) => {
                  const isClosed = !!r.closed_at;
                  const publicUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/responder/${r.id}`;
                  return (
                    <div
                      key={r.id}
                      className="eq-panel flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-5 hover:border-purple-200 transition-all"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className={`inline-block h-2.5 w-2.5 rounded-full ${isClosed ? 'bg-slate-400' : 'bg-emerald-500 animate-pulse'}`} />
                          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                            {r.sector} · {isClosed ? 'Coleta Encerrada' : 'Coleta Ativa'}
                          </span>
                        </div>
                        <h3 className="text-base font-bold text-slate-900">{r.title}</h3>
                        <p className="text-xs text-slate-500">
                          {r.completed} respostas computadas · Aberta em {new Date(r.opened_at).toLocaleDateString('pt-BR')}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {!isClosed && (
                          <button
                            onClick={() => copyLink(publicUrl)}
                            className="eq-secondary flex items-center gap-1.5 text-xs"
                            title="Copiar Link Único de Coleta"
                          >
                            <Icon name="link" /> Copiar Link Único
                          </button>
                        )}
                        <Link
                          href={`/admin/resultados?run=${r.id}`}
                          className="eq-primary flex items-center gap-1.5 text-xs"
                        >
                          <Icon name="monitoring" /> Ver Dashboard
                        </Link>
                        <button
                          onClick={() => toggleRunState(r, !isClosed)}
                          className="eq-secondary text-xs"
                        >
                          {isClosed ? 'Reabrir Coleta' : 'Encerrar'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {!filteredRuns.length && (
                <div className="eq-panel py-12 text-center text-slate-500 space-y-3">
                  <Icon name="search_off" />
                  <p className="text-sm">Nenhuma campanha encontrada com esse filtro.</p>
                </div>
              )}
            </div>
          )}

          {/* ABA 2: SETORES E ROTINAS PREVISTAS */}
          {section === 'sectors' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <p className="text-xs text-slate-600">
                  O cadastro da rotina prevista permite que a IA compare o <strong>Planejado pela Empresa</strong> com o <strong>Relato Real</strong> dos colaboradores.
                </p>
                <button onClick={() => openSectorForm()} className="eq-primary text-xs flex items-center gap-1.5">
                  <Icon name="add" /> Novo Setor
                </button>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                {sectors.map((sec) => (
                  <div key={sec.id} className="eq-panel p-5 space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="rounded-md bg-purple-50 px-2 py-0.5 text-[10px] font-extrabold uppercase text-purple-900">
                          {sec.workModel} · {sec.shiftHours}h/dia
                        </span>
                        <h3 className="mt-1 text-base font-bold text-slate-900">{sec.name}</h3>
                      </div>
                      <button onClick={() => openSectorForm(sec)} className="text-purple-800 hover:text-purple-950 text-xs font-bold">
                        Editar
                      </button>
                    </div>

                    <div>
                      <span className="text-[11px] font-bold text-slate-600">Cargos Mapeados:</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {sec.roles.map((role) => (
                          <span key={role} className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-700">
                            {role}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-xl bg-slate-50 p-3 text-xs space-y-1">
                      <p className="text-slate-700 leading-relaxed">{sec.routineDescription}</p>
                      <p className="text-[11px] text-slate-500"><strong>Pausas:</strong> {sec.breakPolicy}</p>
                    </div>

                    <button
                      onClick={() => {
                        setSelectedSectorId(sec.id);
                        startNewSurvey();
                      }}
                      className="w-full eq-secondary text-xs flex items-center justify-center gap-1.5"
                    >
                      <Icon name="auto_awesome" /> Criar Pesquisa para este Setor
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ABA 3: BIBLIOTECA DE MODELOS */}
          {section === 'library' && (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {templates.map((t) => (
                <div key={t.id} className="eq-panel flex flex-col justify-between p-5 space-y-4">
                  <div>
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-purple-900 bg-purple-50 px-2 py-0.5 rounded">
                      {t.kind === 'master' ? 'Condições Ocupacionais' : 'Tema Específico'} · {t.questions.length} Questões
                    </span>
                    <h3 className="mt-2 text-base font-bold text-slate-900">{t.title}</h3>
                    <p className="mt-1 text-xs text-slate-600 line-clamp-2">{t.description || 'Modelo estruturado de escuta.'}</p>
                  </div>

                  <button
                    onClick={() => handleLaunchRun(t)}
                    className="eq-primary w-full text-xs flex items-center justify-center gap-1.5"
                  >
                    <Icon name="rocket_launch" /> Disparar Campanha
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* MODAL DE CADASTRO/EDIÇÃO DE SETOR */}
      {sectorModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <form onSubmit={handleSaveSector} className="eq-panel max-w-xl w-full max-h-[90vh] overflow-y-auto space-y-4 p-6 bg-white shadow-2xl rounded-2xl">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="text-lg font-bold text-slate-900">
                {editingSector ? 'Editar Setor & Rotina' : 'Cadastrar Novo Setor & Rotina Prevista'}
              </h3>
              <button type="button" onClick={() => setSectorModalOpen(false)} className="text-slate-400 hover:text-slate-600 font-bold">✕</button>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700">Nome do Setor / Área</label>
              <input
                className="eq-input mt-1"
                required
                value={sectorForm.name}
                onChange={(e) => setSectorForm({ ...sectorForm, name: e.target.value })}
                placeholder="Ex: Operações & Logística"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700">Cargos do Setor (separados por vírgula)</label>
              <input
                className="eq-input mt-1"
                required
                value={sectorForm.roles}
                onChange={(e) => setSectorForm({ ...sectorForm, roles: e.target.value })}
                placeholder="Ex: Operador de Empilhadeira, Conferente, Auxiliar"
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-bold text-slate-700">Modelo de Trabalho</label>
                <select
                  className="eq-input mt-1"
                  value={sectorForm.workModel}
                  onChange={(e) => setSectorForm({ ...sectorForm, workModel: e.target.value as any })}
                >
                  <option value="presencial">Presencial</option>
                  <option value="hibrido">Híbrido</option>
                  <option value="remoto">100% Remoto</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700">Jornada Diária Prevista (horas)</label>
                <input
                  type="number"
                  step="0.5"
                  className="eq-input mt-1"
                  value={sectorForm.shiftHours}
                  onChange={(e) => setSectorForm({ ...sectorForm, shiftHours: Number(e.target.value) })}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700">Descrição da Rotina de Trabalho Prevista</label>
              <textarea
                className="eq-input mt-1"
                rows={3}
                required
                value={sectorForm.routineDescription}
                onChange={(e) => setSectorForm({ ...sectorForm, routineDescription: e.target.value })}
                placeholder="Descreva a rotina diária: metas esperadas, ritmo de trabalho, interação com liderança e ambiente."
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700">Política de Pausas e Intervalos</label>
              <input
                className="eq-input mt-1"
                value={sectorForm.breakPolicy}
                onChange={(e) => setSectorForm({ ...sectorForm, breakPolicy: e.target.value })}
                placeholder="Ex: 2 pausas de 10 min + 1 hora de almoço."
              />
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t">
              <button type="button" onClick={() => setSectorModalOpen(false)} className="eq-secondary text-xs">Cancelar</button>
              <button type="submit" disabled={busy} className="eq-primary text-xs">Salvar Setor</button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL DE SUCESSO: LINK ÚNICO & QR CODE */}
      {activeSingleLink && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="eq-panel max-w-md w-full p-6 text-center space-y-4 bg-white shadow-2xl rounded-2xl">
            <div className="flex justify-between items-center">
              <h3 className="text-base font-bold text-slate-900">Campanha Pronta para Compartilhar</h3>
              <button onClick={() => setActiveSingleLink(null)} className="text-slate-400 hover:text-slate-600 font-bold">✕</button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Distribua este <strong>Link Único</strong> ou exiba o <strong>QR Code</strong>. As respostas serão computadas automaticamente de forma anônima.
            </p>

            {activeSingleLink.qrUrl && (
              <div className="p-3 bg-slate-50 border rounded-xl inline-block mx-auto">
                <img src={activeSingleLink.qrUrl} alt="QR Code da Pesquisa" className="w-48 h-48 mx-auto" />
              </div>
            )}

            <div className="flex gap-2">
              <input
                readOnly
                value={activeSingleLink.url}
                className="eq-input text-xs select-all bg-slate-50"
              />
              <button
                onClick={() => copyLink(activeSingleLink.url)}
                className="eq-primary text-xs whitespace-nowrap"
              >
                Copiar
              </button>
            </div>

            <button
              onClick={() => setActiveSingleLink(null)}
              className="w-full eq-secondary text-xs"
            >
              Concluir
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
