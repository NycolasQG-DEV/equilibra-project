"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { authenticatedFetch } from "@/lib/api-client";
import { PageReveal } from "@/components/admin/PageReveal";

interface Run {
  id: string; title: string; sector: string;
  opened_at: string; closed_at: string | null;
  invited: number; completed: number;
  scheduled_at?: string | null; paused?: boolean;
  cycle_number?: number; cycle_group?: string | null;
}
interface Template { id: string; title: string; invites_per_run: number; }
interface Sector { id: string; name: string; roles: string[]; }

const fmt = (d: string) => new Date(d.length === 10 ? d + "T12:00:00" : d).toLocaleDateString("pt-BR");
const calcPct = (done: number, total: number) => total > 0 ? Math.round((done / total) * 100) : 0;

function StatusBadge({ run }: { run: Run }) {
  if (run.scheduled_at && !run.opened_at)
    return <span className="eq-run-badge eq-run-scheduled"><span className="material-symbols-outlined" style={{fontSize:12}}>schedule</span>Agendada</span>;
  if (run.paused)
    return <span className="eq-run-badge eq-run-paused"><span className="material-symbols-outlined" style={{fontSize:12}}>pause</span>Pausada</span>;
  if (!run.closed_at)
    return <span className="eq-run-badge eq-run-active"><span className="eq-live-dot"/>Em coleta</span>;
  return <span className="eq-run-badge eq-run-closed"><span className="material-symbols-outlined" style={{fontSize:12}}>check</span>Encerrada</span>;
}

function ScheduleModal({ templates, sectors, onConfirm, onClose }: {
  templates: Template[]; sectors: Sector[];
  onConfirm: (d: { templateId: string; sector: string; quantity: number; scheduledAt: string; repeat: string; repeatCount: number }) => void;
  onClose: () => void;
}) {
  const [templateId, setTemplateId] = useState(templates[0]?.id || "");
  const [sectorId, setSectorId] = useState(sectors[0]?.id || "");
  const [quantity, setQuantity] = useState(30);
  const [scheduledAt, setScheduledAt] = useState(new Date(Date.now() + 86400000).toISOString().slice(0, 16));
  const [repeat, setRepeat] = useState("none");
  const [repeatCount, setRepeatCount] = useState(3);
  const sectorName = sectors.find(s => s.id === sectorId)?.name || "Toda a empresa";
  const tpl = templates.find(t => t.id === templateId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h3 className="text-base font-bold text-slate-900">Agendar Pesquisa</h3>
            <p className="text-xs text-slate-500 mt-0.5">Configure data, ciclo e alvo da coleta.</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Modelo de Pesquisa</label>
            <select className="eq-input" value={templateId} onChange={e => setTemplateId(e.target.value)}>
              {templates.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Setor</label>
              <select className="eq-input" value={sectorId} onChange={e => setSectorId(e.target.value)}>
                <option value="">Toda a empresa</option>
                {sectors.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Respondentes Esperados</label>
              <input type="number" min={5} max={2000} className="eq-input" value={quantity} onChange={e => setQuantity(Number(e.target.value))} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Data e Hora de Inicio</label>
            <input type="datetime-local" className="eq-input" value={scheduledAt} min={new Date().toISOString().slice(0, 16)} onChange={e => setScheduledAt(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2">Ciclo de Repeticao</label>
            <div className="grid grid-cols-4 gap-2">
              {[["none","Unica"],["weekly","Semanal"],["biweekly","Quinzenal"],["monthly","Mensal"]].map(([v, l]) => (
                <button key={v} type="button" onClick={() => setRepeat(v)}
                  className={`rounded-xl py-2 text-xs font-bold transition-all ${repeat === v ? "bg-[#3d1a6e] text-white shadow" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
                  {l}
                </button>
              ))}
            </div>
            {repeat !== "none" && (
              <div className="mt-3 flex items-center gap-3">
                <label className="text-xs text-slate-600">Repetir</label>
                <input type="number" min={2} max={52} className="eq-input" style={{width: 80}} value={repeatCount} onChange={e => setRepeatCount(Number(e.target.value))} />
                <span className="text-xs text-slate-500">{repeatCount}x no ciclo</span>
              </div>
            )}
          </div>
          <div className="rounded-xl bg-purple-50 border border-purple-100 p-3 text-xs text-purple-900 space-y-1">
            <p><strong>Resumo:</strong> Pesquisa <em>{tpl?.title || "..."}</em> para <strong>{sectorName}</strong>, {quantity} respondentes.</p>
            <p>Inicio: <strong>{new Date(scheduledAt).toLocaleString("pt-BR")}</strong>{repeat !== "none" && <> &middot; {repeatCount}x em ciclo</>}</p>
          </div>
        </div>
        <div className="flex gap-3 px-6 pb-5">
          <button onClick={onClose} className="flex-1 eq-secondary text-sm">Cancelar</button>
          <button onClick={() => onConfirm({ templateId, sector: sectorName, quantity, scheduledAt, repeat, repeatCount })}
            className="flex-1 eq-primary text-sm flex items-center justify-center gap-2">
            <span className="material-symbols-outlined text-sm">event</span>Confirmar
          </button>
        </div>
      </div>
    </div>
  );
}

function RunCard({ run, onCopy, onPause, onResume, onClose, onReopen }: {
  run: Run;
  onCopy: (r: Run) => void;
  onPause: (r: Run) => void;
  onResume: (r: Run) => void;
  onClose: (r: Run) => void;
  onReopen: (r: Run) => void;
}) {
  const isScheduled = !!(run.scheduled_at && !run.opened_at);
  const isActive = !run.closed_at && !run.paused && !isScheduled;
  const donePct = calcPct(run.completed, run.invited || Math.max(1, run.completed));
  const barColor = run.paused ? "#f59e0b" : run.closed_at ? "#8b5cf6" : isScheduled ? "#6366f1" : "#10b981";

  return (
    <article style={{ display: "flex", background: "white", border: "1px solid #e8e1ef", borderRadius: 18, overflow: "hidden", boxShadow: "0 3px 12px #3714530a" }}>
      <div style={{ width: 4, flexShrink: 0, background: barColor }} />
      <div style={{ flex: 1, padding: "18px 20px" }}>
        <div className="flex items-start gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <StatusBadge run={run} />
              {run.cycle_number && run.cycle_number > 1 && (
                <span className="eq-run-badge" style={{ background: "#ede9f5", color: "#5b3d7a" }}>Ciclo #{run.cycle_number}</span>
              )}
              <span className="text-xs text-slate-400 font-medium">{run.sector}</span>
            </div>
            <h3 className="text-sm font-bold text-slate-900 truncate">{run.title}</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {isScheduled && run.scheduled_at
                ? `Agendada para ${fmt(run.scheduled_at)}`
                : `Aberta em ${fmt(run.opened_at)}${run.closed_at ? " - Encerrada em " + fmt(run.closed_at) : ""}`}
            </p>
          </div>
        </div>
        {!isScheduled && (
          <div className="mb-3">
            <div className="flex justify-between text-xs text-slate-500 mb-1">
              <span>{run.completed} respostas{run.invited > 0 ? ` / ${run.invited} esperadas` : ""}</span>
              <span className="font-bold text-slate-700">{donePct}%</span>
            </div>
            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, donePct)}%`, background: barColor }} />
            </div>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2">
          {isActive && <>
            <button onClick={() => onCopy(run)} className="eq-run-btn"><span className="material-symbols-outlined" style={{ fontSize: 13 }}>link</span>Copiar Link</button>
            <button onClick={() => onPause(run)} className="eq-run-btn eq-run-btn-warn"><span className="material-symbols-outlined" style={{ fontSize: 13 }}>pause</span>Pausar</button>
            <button onClick={() => onClose(run)} className="eq-run-btn eq-run-btn-danger"><span className="material-symbols-outlined" style={{ fontSize: 13 }}>stop_circle</span>Encerrar</button>
            <Link href={`/admin/resultados?run=${run.id}`} className="eq-run-btn eq-run-btn-primary"><span className="material-symbols-outlined" style={{ fontSize: 13 }}>bar_chart</span>Dashboard</Link>
          </>}
          {run.paused && !run.closed_at && (
            <button onClick={() => onResume(run)} className="eq-run-btn eq-run-btn-success"><span className="material-symbols-outlined" style={{ fontSize: 13 }}>play_arrow</span>Retomar</button>
          )}
          {run.closed_at && <>
            <Link href={`/admin/resultados?run=${run.id}`} className="eq-run-btn eq-run-btn-primary"><span className="material-symbols-outlined" style={{ fontSize: 13 }}>monitoring</span>Ver Relatorio</Link>
            <button onClick={() => onReopen(run)} className="eq-run-btn"><span className="material-symbols-outlined" style={{ fontSize: 13 }}>refresh</span>Reabrir</button>
          </>}
        </div>
      </div>
    </article>
  );
}

export default function PesquisasPage() {
  const { user, loading } = useAuth("admin");
  const [runs, setRuns] = useState<Run[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "paused" | "closed" | "scheduled">("all");
  const [showSchedule, setShowSchedule] = useState(false);

  const load = useCallback(async () => {
    const r = await authenticatedFetch("/api/product");
    const d = await r.json();
    if (!r.ok) throw new Error(d.error || "Erro ao carregar dados.");
    setRuns(d.runs || []); setTemplates(d.templates || []); setSectors(d.sectors || []); setReady(true);
  }, []);

  useEffect(() => { if (user) load().catch(e => { setError(e.message); setReady(true); }); }, [user, load]);

  async function act(body: Record<string, unknown>) {
    setBusy(true); setError("");
    try {
      const r = await authenticatedFetch("/api/product", { method: "POST", body: JSON.stringify(body) });
      const d = await r.json(); if (!r.ok) throw new Error(d.error); return d;
    } catch (e) { setError((e as Error).message); return null; } finally { setBusy(false); }
  }

  async function handleSchedule(data: { templateId: string; sector: string; quantity: number; scheduledAt: string; repeat: string; repeatCount: number }) {
    setShowSchedule(false);
    const d = await act({ action: "schedule-run", ...data });
    if (d) { await load(); setNotice(data.repeat !== "none" ? `${data.repeatCount} coletas agendadas em ciclo!` : "Pesquisa agendada com sucesso!"); }
  }
  async function handleCopy(run: Run) {
    const url = `${window.location.origin}/responder/${run.id}`;
    try { await navigator.clipboard.writeText(url); setNotice("Link copiado! Distribua pelo canal interno."); }
    catch { setError("Nao foi possivel copiar. URL: " + url); }
  }
  async function handlePause(run: Run) { const d = await act({ action: "pause", runId: run.id }); if (d) { await load(); setNotice("Coleta pausada."); } }
  async function handleResume(run: Run) { const d = await act({ action: "reopen", runId: run.id }); if (d) { await load(); setNotice("Coleta retomada!"); } }
  async function handleClose(run: Run) { const d = await act({ action: "close", runId: run.id }); if (d) { await load(); setNotice("Encerrada. Veja os resultados em Relatorios."); } }
  async function handleReopen(run: Run) { const d = await act({ action: "reopen", runId: run.id }); if (d) { await load(); setNotice("Coleta reaberta."); } }

  const activeCount = runs.filter(r => !r.closed_at && !r.paused && !(r.scheduled_at && !r.opened_at)).length;
  const pausedCount = runs.filter(r => r.paused && !r.closed_at).length;
  const closedCount = runs.filter(r => !!r.closed_at).length;
  const scheduledCount = runs.filter(r => !!(r.scheduled_at && !r.opened_at)).length;
  const totalResponses = runs.reduce((a, r) => a + r.completed, 0);

  const filtered = runs.filter(r => {
    const ok = (r.title + " " + r.sector).toLowerCase().includes(search.toLowerCase());
    if (!ok) return false;
    if (filter === "active") return !r.closed_at && !r.paused && !(r.scheduled_at && !r.opened_at);
    if (filter === "paused") return !!r.paused && !r.closed_at;
    if (filter === "closed") return !!r.closed_at;
    if (filter === "scheduled") return !!(r.scheduled_at && !r.opened_at);
    return true;
  });

  if (loading || !ready) return (
    <main className="eq-page space-y-6">
      <div className="eq-skeleton h-16" />
      <div className="eq-skeleton tall" />
    </main>
  );

  return <>
    {showSchedule && templates.length > 0 && (
      <ScheduleModal templates={templates} sectors={sectors} onConfirm={handleSchedule} onClose={() => setShowSchedule(false)} />
    )}
    <main className="eq-page space-y-6 pb-20">
      <PageReveal selector=".eq-panel, .eq-kpi-card" />
      <div className="eq-breadcrumb">ESPACO DA EMPRESA <span>/</span> GESTAO DE PESQUISAS</div>
      <header className="eq-page-heading">
        <div>
          <span className="eq-eyebrow">COCKPIT DE CAMPANHAS</span>
          <h1>Pesquisas &amp; Coletas</h1>
          <p>Gerencie, pause, agende e monitore todas as coletas em tempo real.</p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => { if (!templates.length) setError("Crie um modelo primeiro em Criar Pesquisa."); else setShowSchedule(true); }}
            className="eq-secondary flex items-center gap-2">
            <span className="material-symbols-outlined text-base">event</span>Agendar Pesquisa
          </button>
          <Link href="/admin/pesquisas/inteligencia" className="eq-primary flex items-center gap-2">
            <span className="material-symbols-outlined text-base">auto_awesome</span>Nova Pesquisa com IA
          </Link>
        </div>
      </header>

      {error && (
        <div role="alert" className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span className="material-symbols-outlined text-base">error</span>
          <span className="flex-1">{error}</span>
          <button onClick={() => setError("")}><span className="material-symbols-outlined text-sm">close</span></button>
        </div>
      )}
      {notice && (
        <div role="status" className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          <span className="material-symbols-outlined text-base">check_circle</span>
          <span className="flex-1">{notice}</span>
          <button onClick={() => setNotice("")}><span className="material-symbols-outlined text-sm">close</span></button>
        </div>
      )}

      {/* KPI Strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {[
          { label: "Em Coleta", value: activeCount, color: "#10b981", icon: "radio_button_checked" },
          { label: "Pausadas", value: pausedCount, color: "#f59e0b", icon: "pause" },
          { label: "Agendadas", value: scheduledCount, color: "#6366f1", icon: "schedule" },
          { label: "Encerradas", value: closedCount, color: "#94a3b8", icon: "check" },
          { label: "Total Respostas", value: totalResponses, color: "#8b5cf6", icon: "people" },
        ].map(({ label, value, color, icon }) => (
          <div key={label} className="eq-kpi-card">
            <span className="material-symbols-outlined" style={{ fontSize: 20, color, marginBottom: 8 }}>{icon}</span>
            <strong style={{ color }}>{value}</strong>
            <p>{label}</p>
          </div>
        ))}
      </div>

      {/* Filters + Search */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-2">
          {(["all", "active", "paused", "scheduled", "closed"] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${filter === f ? "bg-[#3d1a6e] text-white shadow" : "bg-white border border-slate-200 text-slate-600 hover:border-slate-300"}`}>
              {f === "all" ? "Todas" : f === "active" ? "Em Coleta" : f === "paused" ? "Pausadas" : f === "scheduled" ? "Agendadas" : "Encerradas"}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
          <span className="material-symbols-outlined text-slate-400" style={{ fontSize: 18 }}>search</span>
          <input className="border-0 bg-transparent text-sm outline-none placeholder:text-slate-400"
            placeholder="Buscar campanha..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-slate-200 py-16 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100">
            <span className="material-symbols-outlined text-3xl text-slate-400">assignment_late</span>
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-600">{runs.length === 0 ? "Nenhuma coleta ainda." : "Nenhuma campanha com este filtro."}</p>
            <p className="mt-1 text-xs text-slate-400">{runs.length === 0 ? "Crie sua primeira pesquisa ou agende uma coleta." : "Tente outro filtro."}</p>
          </div>
          {runs.length === 0 && <Link href="/admin/pesquisas/inteligencia" className="eq-primary text-sm">Criar primeira pesquisa</Link>}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(run => (
            <RunCard key={run.id} run={run} onCopy={handleCopy} onPause={handlePause} onResume={handleResume} onClose={handleClose} onReopen={handleReopen} />
          ))}
        </div>
      )}

      {/* CTA Banner */}
      <div className="rounded-2xl border border-purple-100 bg-gradient-to-br from-purple-50 to-white p-5 flex items-center gap-4">
        <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-[#3d1a6e]">
          <span className="material-symbols-outlined text-white" style={{ fontSize: 24 }}>auto_awesome</span>
        </div>
        <div className="flex-1">
          <strong className="text-sm text-slate-900">Criar pesquisa contextualizada com IA</strong>
          <p className="text-xs text-slate-500 mt-0.5">Usa a rotina cadastrada do setor para gerar perguntas alinhadas a NR-1.</p>
        </div>
        <Link href="/admin/pesquisas/inteligencia" className="eq-primary text-sm whitespace-nowrap">Ir para IA</Link>
      </div>
    </main>

    <style>{`
      .eq-run-badge{display:inline-flex;align-items:center;gap:4px;font-size:10px;font-weight:700;padding:3px 8px;border-radius:20px}
      .eq-run-active{background:#d1fae5;color:#065f46}
      .eq-run-paused{background:#fef3c7;color:#92400e}
      .eq-run-scheduled{background:#ede9fe;color:#4338ca}
      .eq-run-closed{background:#f1f5f9;color:#475569}
      .eq-live-dot{width:6px;height:6px;background:#10b981;border-radius:50%;animation:liveBlip 1.4s infinite;display:inline-block}
      @keyframes liveBlip{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.5;transform:scale(.7)}}
      .eq-run-btn{display:inline-flex;align-items:center;gap:5px;padding:5px 12px;border-radius:10px;font-size:11px;font-weight:700;background:#f1f5f9;color:#475569;border:1px solid #e2e8f0;transition:background .15s,transform .15s;cursor:pointer;text-decoration:none}
      .eq-run-btn:hover{background:#e2e8f0;transform:translateY(-1px)}
      .eq-run-btn-warn{background:#fef9c3;color:#854d0e;border-color:#fde047}.eq-run-btn-warn:hover{background:#fef08a}
      .eq-run-btn-danger{background:#fee2e2;color:#991b1b;border-color:#fca5a5}.eq-run-btn-danger:hover{background:#fecaca}
      .eq-run-btn-success{background:#d1fae5;color:#065f46;border-color:#6ee7b7}.eq-run-btn-success:hover{background:#a7f3d0}
      .eq-run-btn-primary{background:#ede9fe;color:#4c1d95;border-color:#c4b5fd}.eq-run-btn-primary:hover{background:#ddd6fe}
      .eq-kpi-card{background:white;border:1px solid #e8e1ef;border-radius:16px;padding:18px;display:flex;flex-direction:column;align-items:flex-start;box-shadow:0 2px 8px #3714530a}
      .eq-kpi-card strong{font-size:30px;font-weight:600;font-family:'Epilogue',sans-serif;letter-spacing:-0.05em}
      .eq-kpi-card p{font-size:11px;color:#7c6a88;margin-top:2px}
    `}</style>
  </>;
}