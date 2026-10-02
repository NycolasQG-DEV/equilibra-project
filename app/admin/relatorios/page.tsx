"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { authenticatedFetch } from "@/lib/api-client";
import { PageReveal } from "@/components/admin/PageReveal";
import { Chart, registerables } from "chart.js";

Chart.register(...registerables);

// --- Types ------------------------------------------------------------------
interface Finding {
  id: string; name: string; text: string;
  count: number; percent: number;
  action: { title: string; steps: string[]; owner: string; days: number; indicator: string; resources: string };
}
interface Run {
  id: string; title: string; sector: string;
  openedAt: string; closedAt: string | null;
  completed: number; invited: number; minimum: number;
  released: boolean; findings: Finding[];
  questions: { id: string; text: string; count: number | null; counts?: number[] | null }[];
}
interface Dashboard { company: string | null; reports: Run[]; actions: { id: string; batch_id: string; dimension_id: string; title: string; owner: string; due_date: string; status: string }[] }

const fmt = (d: string) => new Date(d.length === 10 ? d + "T12:00:00" : d).toLocaleDateString("pt-BR");

// --- Risk color helper -------------------------------------------------------
function riskColor(pct: number) {
  if (pct >= 40) return { bg: "#fee2e2", text: "#991b1b", bar: "#ef4444", label: "Critico" };
  if (pct >= 25) return { bg: "#ffedd5", text: "#9a3412", bar: "#f97316", label: "Alto" };
  if (pct >= 15) return { bg: "#fef9c3", text: "#854d0e", bar: "#eab308", label: "Moderado" };
  return { bg: "#d1fae5", text: "#065f46", bar: "#10b981", label: "Baixo" };
}

// --- Radar Chart ------------------------------------------------------------
function RadarChart({ report }: { report: Run }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const inst = useRef<Chart | null>(null);
  const labels = ["Volume e Demanda","Clareza e Org.","Autonomia","Apoio Lideranca","Reconhecimento","Relacoes"];
  const realScores = labels.map((_, i) => {
    const f = report.findings[i];
    return f ? Math.max(5, 100 - f.percent) : 75;
  });
  const planned = [40, 80, 60, 80, 80, 80];
  useEffect(() => {
    if (!ref.current) return;
    if (inst.current) inst.current.destroy();
    const ctx = ref.current.getContext("2d");
    if (!ctx) return;
    inst.current = new Chart(ctx, {
      type: "radar",
      data: {
        labels,
        datasets: [
          { label: "Expectativa da Gestao", data: planned, borderColor: "#3b82f6", backgroundColor: "rgba(59,130,246,0.12)", borderWidth: 2, pointBackgroundColor: "#2563eb", pointRadius: 4 },
          { label: "Percepcao dos Colaboradores", data: realScores, borderColor: "#8b5cf6", backgroundColor: "rgba(139,92,246,0.2)", borderWidth: 2.5, pointBackgroundColor: "#7c3aed", pointRadius: 5 },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        scales: { r: { min: 0, max: 100, ticks: { stepSize: 20, backdropColor: "transparent" }, grid: { color: "rgba(140,100,200,0.15)" }, angleLines: { color: "rgba(140,100,200,0.2)" }, pointLabels: { font: { size: 11 }, color: "#3c2a52" } } },
        plugins: { legend: { position: "bottom", labels: { boxWidth: 12, font: { size: 11 } } }, tooltip: { callbacks: { label: (i) => ` ${i.dataset.label}: ${i.formattedValue}%` } } },
      },
    });
    return () => { inst.current?.destroy(); };
  }, [report.id]);
  return <canvas ref={ref}/>;
}

// --- Bar Chart (Risk Matrix) -------------------------------------------------
function RiskBarChart({ report }: { report: Run }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const inst = useRef<Chart | null>(null);
  useEffect(() => {
    if (!ref.current) return;
    if (inst.current) inst.current.destroy();
    const ctx = ref.current.getContext("2d");
    if (!ctx) return;
    const items = [...report.findings].sort((a, b) => b.percent - a.percent);
    if (!items.length) return;
    const colors = items.map(f => riskColor(f.percent).bar);
    inst.current = new Chart(ctx, {
      type: "bar",
      data: {
        labels: items.map(f => f.name),
        datasets: [{ label: "Indice de Atrito (%)", data: items.map(f => f.percent), backgroundColor: colors, borderRadius: 6, barThickness: 20 }],
      },
      options: {
        indexAxis: "y", responsive: true, maintainAspectRatio: false,
        scales: {
          x: { min: 0, max: 100, title: { display: true, text: '% "Frequentemente" ou "Sempre"' }, grid: { color: "rgba(0,0,0,0.06)" } },
          y: { grid: { display: false }, ticks: { font: { size: 11 } } },
        },
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: (i) => { const v=Number(i.raw); return ` ${v}% - ${riskColor(v).label}`; } } },
        },
      },
    });
    return () => { inst.current?.destroy(); };
  }, [report.id]);
  return <canvas ref={ref}/>;
}

// --- Trend Line Chart --------------------------------------------------------
function TrendChart({ reports, currentId }: { reports: Run[]; currentId: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const inst = useRef<Chart | null>(null);
  const currentReport = reports.find(r => r.id === currentId);
  if (!currentReport) return null;
  const sector = currentReport.sector;
  const sameRuns = reports.filter(r => r.sector === sector && r.closedAt !== undefined).sort((a, b) => new Date(a.openedAt).getTime() - new Date(b.openedAt).getTime()).slice(-6);
  const labels = sameRuns.map(r => new Date(r.openedAt).toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }));
  const participationData = sameRuns.map(r => r.invited > 0 ? Math.round(r.completed / r.invited * 100) : 100);
  const riskScores = sameRuns.map(r => r.findings.length ? Math.round(r.findings.reduce((a, f) => a + f.percent, 0) / r.findings.length) : 0);
  useEffect(() => {
    if (!ref.current || sameRuns.length < 2) return;
    if (inst.current) inst.current.destroy();
    const ctx = ref.current.getContext("2d");
    if (!ctx) return;
    inst.current = new Chart(ctx, {
      type: "line",
      data: {
        labels,
        datasets: [
          { label: "Participacao (%)", data: participationData, borderColor: "#10b981", backgroundColor: "rgba(16,185,129,0.08)", tension: 0.4, fill: true, pointRadius: 5, pointBackgroundColor: "#10b981" },
          { label: "Indice Medio de Risco (%)", data: riskScores, borderColor: "#ef4444", backgroundColor: "rgba(239,68,68,0.08)", tension: 0.4, fill: true, pointRadius: 5, pointBackgroundColor: "#ef4444" },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        scales: {
          y: { min: 0, max: 100, title: { display: true, text: "%" }, grid: { color: "rgba(0,0,0,0.06)" } },
          x: { grid: { display: false } },
        },
        plugins: { legend: { position: "bottom", labels: { boxWidth: 12, font: { size: 11 } } } },
      },
    });
    return () => { inst.current?.destroy(); };
  }, [currentId]);
  if (sameRuns.length < 2) return <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-2"><span className="material-symbols-outlined text-4xl">show_chart</span><p className="text-sm">Dados insuficientes. Sao necessarios pelo menos 2 ciclos neste setor.</p></div>;
  return <canvas ref={ref}/>;
}

// --- Main Page ---------------------------------------------------------------
export default function RelatoriosPage() {
  const { user, loading } = useAuth("admin");
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState("");
  const [tab, setTab] = useState<"gap" | "risk" | "trend" | "questions">("gap");

  const load = useCallback(async () => {
    const r = await authenticatedFetch("/api/product/dashboard");
    const d = await r.json();
    if (!r.ok) throw new Error(d.error || "Erro ao carregar dados.");
    setData(d);
    setSelected(s => s || d.reports[0]?.id || "");
  }, []);

  useEffect(() => { if (user) load().catch(e => setError(e.message)); }, [user, load]);

  const report = data?.reports.find(r => r.id === selected);
  const actions = data?.actions.filter(a => a.batch_id === selected) || [];

  if (loading) return <main className="eq-page"><div className="eq-skeleton h-16"/><div className="eq-skeleton tall mt-4"/></main>;

  return (
    <main className="eq-page space-y-6 pb-20">
      <PageReveal selector=".eq-panel"/>
      <div className="eq-breadcrumb">ESPACO DA EMPRESA <span>/</span> RELATORIOS &amp; ANALISE</div>

      <header className="eq-page-heading">
        <div><span className="eq-eyebrow">DIAGNOSTICO PSICOSSOCIAL</span><h1>Relatorios &amp; Analise</h1><p>Dashboards baseados em dados reais para o RH entender o problema e agir com precisao.</p></div>
        <Link href="/admin/acoes" className="eq-primary flex items-center gap-2"><span className="material-symbols-outlined text-base">task_alt</span>Ir para Plano de Acao</Link>
      </header>

      {error && <div role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-800">{error}</div>}
      {!data ? <p className="text-slate-500">Carregando indicadores...</p> : !data.reports.length ? (
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-slate-200 py-16 text-center">
          <span className="material-symbols-outlined text-4xl text-slate-300">bar_chart</span>
          <p className="text-sm font-semibold text-slate-600">Nenhum relatorio disponivel ainda.</p>
          <p className="text-xs text-slate-400">Os dados aparecerao apos a primeira coleta encerrada.</p>
          <Link href="/admin/pesquisas/inteligencia" className="eq-primary text-sm">Criar primeira pesquisa</Link>
        </div>
      ) : (
        <>
          {/* Run selector */}
          <div className="eq-panel flex flex-wrap items-center gap-4">
            <div className="flex-1 min-w-0">
              <label className="text-xs font-bold text-slate-600 block mb-1">Rodada em Analise</label>
              <select className="eq-input" value={selected} onChange={e => setSelected(e.target.value)}>
                {data.reports.map(r => (
                  <option key={r.id} value={r.id}>{r.title} - {r.sector} - {fmt(r.openedAt)}</option>
                ))}
              </select>
            </div>
            {report && (
              <div className="flex flex-wrap gap-3 text-xs">
                <span className={`eq-run-badge ${report.closedAt ? "eq-run-closed" : "eq-run-active"}`}>{report.closedAt ? "Encerrada" : "Em coleta"}</span>
                <span className="text-slate-500">{report.completed} respostas</span>
                {report.invited > 0 && <span className="text-slate-400">/ {report.invited} esperadas</span>}
              </div>
            )}
          </div>

          {report && (
            <>
              {/* Summary KPIs */}
              {report.released && report.findings.length > 0 && (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {[
                    { label: "Fatores Criticos", value: report.findings.filter(f => f.percent >= 40).length, color: "#ef4444" },
                    { label: "Fatores de Risco Alto", value: report.findings.filter(f => f.percent >= 25 && f.percent < 40).length, color: "#f97316" },
                    { label: "Acoes Registradas", value: actions.length, color: "#8b5cf6" },
                    { label: "Taxa de Participacao", value: report.invited > 0 ? `${Math.round(report.completed / report.invited * 100)}%` : "-", color: "#10b981" },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="eq-kpi-card">
                      <strong style={{ color }}>{value}</strong><p>{label}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Participation bar */}
              <div className="eq-panel space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-bold text-slate-800">Participacao na Rodada</h2>
                  <span className={`text-xs font-bold px-2 py-1 rounded-full ${report.closedAt ? "bg-slate-100 text-slate-500" : "bg-emerald-100 text-emerald-700"}`}>
                    {report.closedAt ? "Encerrada" : "Em coleta"}
                  </span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold text-slate-900" style={{ fontFamily: "Epilogue, sans-serif" }}>{report.completed}</span>
                  <span className="text-sm text-slate-500">respostas / {report.invited || "-"} meta</span>
                </div>
                <div className="h-3 rounded-full bg-slate-100 overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${Math.min(100, report.invited > 0 ? report.completed/report.invited*100 : 100)}%`, background: "linear-gradient(90deg,#8b5cf6,#6d28d9)" }}/>
                </div>
                <p className="text-xs text-slate-400">100% anonimas e protegidas por anonimato de grupo.</p>
              </div>

              {/* Not yet released */}
              {!report.released && (
                <div className="eq-panel text-center py-8 space-y-2">
                  <span className="material-symbols-outlined text-4xl text-amber-400">lock</span>
                  <h2 className="font-semibold text-slate-800">{!report.closedAt ? "Coleta em andamento" : "Protecao de Grupo Ativo"}</h2>
                  <p className="text-sm text-slate-500 max-w-md mx-auto">
                    {!report.closedAt ? "Os dados consolidados serao liberados apos o encerramento da rodada." : `Sao necessarias pelo menos ${report.minimum} participacoes para liberar o laudo. Atual: ${report.completed}.`}
                  </p>
                </div>
              )}

              {/* Dashboard tabs */}
              {report.released && report.findings.length > 0 && (
                <>
                  <nav className="flex flex-wrap gap-2 p-1.5 bg-purple-50 border border-purple-100 rounded-2xl w-fit max-w-full overflow-x-auto">
                    {([["gap","Gap Analise"],["risk","Riscos NR-1"],["trend","Evolucao"],["questions","Perguntas"]] as [string,string][]).map(([v,l])=>(
                      <button key={v} onClick={()=>setTab(v as any)} className={`rounded-xl px-4 py-2 text-xs font-bold whitespace-nowrap transition-all ${tab===v?"bg-white shadow text-[#3d1a6e]":"text-slate-500 hover:text-slate-800"}`}>{l}</button>
                    ))}
                  </nav>

                  {/* GAP ANALYSIS */}
                  {tab === "gap" && (
                    <div className="grid gap-5 lg:grid-cols-3">
                      <div className="lg:col-span-2 eq-panel">
                        <h3 className="text-sm font-bold text-slate-900 mb-1">Confronto: Rotina Planejada vs Percepcao Real</h3>
                        <p className="text-xs text-slate-500 mb-4">Azul = expectativa da gestao | Roxo = relato dos colaboradores</p>
                        <div style={{ height: 320 }}><RadarChart report={report}/></div>
                      </div>
                      <div className="eq-panel flex flex-col justify-between" style={{ background: "linear-gradient(135deg,#260054,#492176)", color: "white", border: "none" }}>
                        <div>
                          <span className="inline-block rounded-md px-2 py-1 text-[10px] font-extrabold uppercase" style={{ background: "rgba(255,255,255,0.15)" }}>Diagnostico</span>
                          <h4 className="mt-3 text-base font-bold">Principais Pontos de Atrito</h4>
                          <div className="mt-3 space-y-2">
                            {[...report.findings].sort((a,b)=>b.percent-a.percent).slice(0,3).map(f=>(
                              <div key={f.id} className="rounded-lg p-2 text-xs" style={{ background: "rgba(255,255,255,0.1)" }}>
                                <div className="flex justify-between mb-1"><span className="font-semibold">{f.name}</span><span className="font-bold text-amber-300">{f.percent}%</span></div>
                                <div className="h-1 rounded-full" style={{ background: "rgba(255,255,255,0.2)" }}><div className="h-full rounded-full" style={{ width: `${f.percent}%`, background: "#fbbf24" }}/></div>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="mt-4 pt-4 border-t" style={{ borderColor: "rgba(255,255,255,0.2)" }}>
                          <span className="text-xs" style={{ color: "rgba(255,255,255,0.7)" }}>Acao imediata recomendada:</span>
                          <p className="text-xs font-semibold mt-1">{report.findings.sort((a,b)=>b.percent-a.percent)[0]?.action.title || "Revise os achados."}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* RISK MATRIX */}
                  {tab === "risk" && (
                    <div className="grid gap-5 lg:grid-cols-3">
                      <div className="lg:col-span-2 eq-panel">
                        <h3 className="text-sm font-bold text-slate-900 mb-1">Inventario de Riscos Psicossociais (PGR/NR-1)</h3>
                        <p className="text-xs text-slate-500 mb-4">Classificacao por severidade. Frequencia de respostas "Frequentemente" ou "Sempre".</p>
                        <div style={{ height: Math.max(240, report.findings.length * 44) }}><RiskBarChart report={report}/></div>
                      </div>
                      <div className="eq-panel space-y-3">
                        <h4 className="text-sm font-bold text-slate-800">Legenda de Severidade NR-1</h4>
                        {[{color:"#ef4444",label:"Critico (>= 40%)",desc:"Intervencao prioritaria no PGR."},{color:"#f97316",label:"Alto (25-39%)",desc:"Plano de controle em 30 dias."},{color:"#eab308",label:"Moderado (15-24%)",desc:"Monitoramento CIPA/SST."},{color:"#10b981",label:"Baixo (< 15%)",desc:"Manutencao de boas praticas."}].map(({color,label,desc})=>(
                          <div key={label} className="flex items-start gap-3 rounded-xl p-3 text-xs" style={{ background: color+"15" }}>
                            <span className="h-3 w-3 flex-shrink-0 rounded-full mt-0.5" style={{ background: color }}/>
                            <div><strong style={{ color }}>{label}</strong><p className="text-slate-600 mt-0.5">{desc}</p></div>
                          </div>
                        ))}
                        <div className="rounded-xl p-3 text-xs bg-slate-50 border border-slate-100 mt-2">
                          <strong className="text-slate-700">Detalhamento por fator:</strong>
                          <div className="mt-2 space-y-2">
                            {[...report.findings].sort((a,b)=>b.percent-a.percent).map(f=>{const rc=riskColor(f.percent);return(
                              <div key={f.id} className="flex items-center justify-between gap-2">
                                <span className="truncate text-slate-600">{f.name}</span>
                                <span className="font-bold rounded px-1.5 py-0.5" style={{background:rc.bg,color:rc.text}}>{f.percent}% - {rc.label}</span>
                              </div>
                            );})}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* TREND */}
                  {tab === "trend" && (
                    <div className="eq-panel">
                      <h3 className="text-sm font-bold text-slate-900 mb-1">Evolucao Longitudinal Entre Ciclos</h3>
                      <p className="text-xs text-slate-500 mb-4">Acompanhe o impacto das acoes ao longo dos ciclos de pesquisa no mesmo setor.</p>
                      <div style={{ height: 320 }}>
                        <TrendChart reports={data.reports} currentId={selected}/>
                      </div>
                      <div className="mt-4 rounded-xl bg-amber-50 border border-amber-100 p-3 text-xs text-amber-900">
                        <strong>Interpretacao:</strong> Queda no Indice de Risco ao longo dos ciclos indica que as medidas estao surtindo efeito. Aumento persistente requer revisao do Plano de Acao.
                      </div>
                    </div>
                  )}

                  {/* QUESTIONS */}
                  {tab === "questions" && (
                    <div className="eq-panel space-y-4">
                      <h3 className="text-sm font-bold text-slate-900">Respostas Agregadas por Pergunta</h3>
                      <p className="text-xs text-slate-500">Dados de todas as respostas validas. Grupos pequenos permanecem protegidos.</p>
                      {report.questions.map((q, i) => (
                        <div key={q.id} className="rounded-xl border border-slate-100 bg-slate-50 p-4 space-y-2">
                          <h4 className="text-xs font-bold text-slate-800">{i+1}. {q.text}</h4>
                          {q.count === null ? (
                            <p className="text-xs text-slate-400 italic">Resultado protegido - grupo pequeno.</p>
                          ) : q.counts ? (
                            <div className="space-y-1.5">
                              {["Nunca","Raramente","As vezes","Frequentemente","Sempre"].map((lbl, j) => {
                                const n = q.counts![j] || 0;
                                const p = q.count! > 0 ? Math.round(n / q.count! * 100) : 0;
                                const isHigh = j >= 3;
                                return (
                                  <div key={j} className="flex items-center gap-2 text-xs">
                                    <span className="w-28 flex-shrink-0 text-slate-500">{lbl}</span>
                                    <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                                      <div className="h-full rounded-full" style={{ width: `${p}%`, background: isHigh && p > 20 ? "#ef4444" : "#8b5cf6" }}/>
                                    </div>
                                    <span className="w-12 text-right font-medium text-slate-600">{n} ({p}%)</span>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <p className="text-xs text-slate-500">{q.count} respostas textuais classificadas.</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Findings list */}
                  <div className="eq-panel space-y-4">
                    <h3 className="text-sm font-bold text-slate-800">Fatores Identificados &amp; Acoes Sugeridas</h3>
                    {[...report.findings].sort((a,b)=>b.percent-a.percent).map(f => {
                      const rc = riskColor(f.percent);
                      return (
                        <div key={f.id} className="rounded-xl border p-4 space-y-2" style={{ borderColor: rc.bar+"33", background: rc.bg+"33" }}>
                          <div className="flex items-center justify-between gap-3">
                            <h4 className="text-sm font-bold text-slate-900">{f.name}</h4>
                            <span className="rounded-full px-2 py-0.5 text-[11px] font-bold" style={{ background: rc.bg, color: rc.text }}>{f.percent}% - {rc.label}</span>
                          </div>
                          <p className="text-xs text-slate-600">{f.text}</p>
                          <div className="h-1.5 rounded-full bg-slate-200 overflow-hidden"><div className="h-full rounded-full" style={{ width: `${f.percent}%`, background: rc.bar }}/></div>
                          <div className="mt-2 rounded-lg bg-white p-3 text-xs border border-slate-100 space-y-1">
                            <strong className="text-slate-700">Acao sugerida:</strong>
                            <p className="text-slate-600">{f.action.title}</p>
                            <p className="text-slate-400">Prazo estimado: {f.action.days} dias - Evidencia: {f.action.indicator}</p>
                          </div>
                          <Link href={`/admin/acoes?run=${report.id}&finding=${f.id}`} className="inline-flex items-center gap-1 text-xs font-bold text-purple-700 hover:text-purple-900">
                            Registrar medida <span className="material-symbols-outlined" style={{fontSize:14}}>arrow_forward</span>
                          </Link>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </>
          )}
        </>
      )}
      <style>{`
        .eq-run-badge{display:inline-flex;align-items:center;gap:4px;font-size:10px;font-weight:700;padding:3px 8px;border-radius:20px}
        .eq-run-active{background:#d1fae5;color:#065f46}
        .eq-run-closed{background:#f1f5f9;color:#475569}
        .eq-kpi-card{background:white;border:1px solid #e8e1ef;border-radius:16px;padding:18px;display:flex;flex-direction:column;align-items:flex-start;box-shadow:0 2px 8px #3714530a}
        .eq-kpi-card strong{font-size:30px;font-weight:600;font-family:'Epilogue',sans-serif;letter-spacing:-0.05em}
        .eq-kpi-card p{font-size:11px;color:#7c6a88;margin-top:2px}
      `}</style>
    </main>
  );
}
