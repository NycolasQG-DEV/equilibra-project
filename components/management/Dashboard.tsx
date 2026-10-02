"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { authenticatedFetch } from "@/lib/api-client";
import {
  Snapshot,
  comparison,
  csvCell,
  priorities,
} from "@/lib/management/analytics";
import { DIMENSIONS } from "@/lib/ai/protocol";
import { Evolution, Heatmap, PeriodComparison } from "./ReportCharts";
import { PageReveal } from "@/components/admin/PageReveal";
import "./management.css";
type Action = {
  id: string;
  batch_id: string;
  dimension_id: string;
  title: string;
  owner: string;
  due_date: string;
  status: string;
  evidence: string;
  plan: (typeof DIMENSIONS)[number]["action"];
};
type Data = {
  batches: Snapshot[];
  actions: Action[];
  legacyLinks: number;
  generatedAt: string;
};
type Finding = {
  id: string;
  name: string;
  evidence: string;
  reference: string;
  action: (typeof DIMENSIONS)[number]["action"];
};
type Insight = {
  batchId?: string;
  source: string;
  summary: string;
  findings: Finding[];
  limitations: string;
};
const date = (s: string) => new Date(s).toLocaleDateString("pt-BR");
const number = (n: number) =>
  n.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
async function api(url: string, options?: RequestInit) {
  const r = await authenticatedFetch(url, options),
    d = await r.json();
  if (!r.ok) throw new Error(d.error || "Não foi possível carregar os dados.");
  return d;
}
function Icon({ name }: { name: string }) {
  return (
    <span aria-hidden="true" className="material-symbols-outlined">
      {name}
    </span>
  );
}
function localReport(batch: Snapshot): Insight {
  const items = priorities(batch);
  return {
    source: "rules",
    summary: !batch.released
      ? "Esta rodada ainda não permite a divulgação dos resultados."
      : !batch.dimensions.some((d) => d.percent !== null)
        ? "Os resultados dos temas estão protegidos por tamanho de grupo ou contagens pequenas."
        : items.length
          ? "As condições abaixo foram as mais frequentes entre os temas divulgáveis. Verifique como aparecem na atividade real e discuta as propostas com a equipe."
          : "Não houve respostas frequentes nos temas divulgáveis. Isso não comprova ausência de riscos na organização.",
    findings: items.map((d) => ({
      id: d.id,
      name: d.name,
      evidence:
        d.unfavorable +
        " de " +
        d.valid +
        " respostas válidas (" +
        number(d.percent!) +
        "%) indicaram Frequentemente ou Sempre.",
      reference: d.reference,
      action: d.action,
    })),
    limitations:
      "As propostas apoiam decisões de gestão. A avaliação técnica e a aprovação das medidas cabem aos responsáveis da organização.",
  };
}
function PlanSection({
  data,
  reportMode,
  batch,
  setEdit,
  setEvidence,
  setStatus,
}: {
  data: Data;
  reportMode: boolean;
  batch?: Snapshot;
  setEdit: (a: Action) => void;
  setEvidence: (e: string) => void;
  setStatus: (s: string) => void;
}) {
  const actionsForBatch = data.actions.filter(
    (a) => !reportMode || a.batch_id === batch?.id,
  );

  return (
    <section className="eq-panel">
      <div className="eq-panel-heading">
        <div>
          <p className="eq-eyebrow">EXECUÇÃO E ACOMPANHAMENTO</p>
          <h2>Plano de melhoria contínua</h2>
        </div>
        <div className="eq-inline">
          <span className="eq-badge">
            {reportMode ? "Medidas desta rodada" : "Todas as campanhas"}
          </span>
          <span className="eq-badge" style={{ background: "#f3eef9", color: "#6b3ba7" }}>
            {actionsForBatch.length} {actionsForBatch.length === 1 ? "ação" : "ações"}
          </span>
        </div>
      </div>
      <div className="eq-plan-grid">
        {[
          ["planned", "Planejadas"],
          ["progress", "Em andamento"],
          ["done", "Executadas"],
        ].map(([key, label]) => {
          const actions = data.actions.filter(
            (a) =>
              a.status === key &&
              (!reportMode || a.batch_id === batch?.id),
          );
          return (
            <section className="eq-plan-column" key={key}>
              <h3>
                {label}
                <span>{actions.length}</span>
              </h3>
              {actions.length ? (
                actions.map((a) => (
                  <article className="eq-task" key={a.id}>
                    <h4>{a.title}</h4>
                    <p>{a.owner}</p>
                    <div className="eq-task-footer">
                      <span
                        className={
                          a.status !== "done" &&
                          a.due_date <
                            new Date().toISOString().slice(0, 10)
                            ? "overdue"
                            : ""
                        }
                      >
                        {date(a.due_date + "T12:00:00")}
                        {a.status !== "done" &&
                        a.due_date < new Date().toISOString().slice(0, 10)
                          ? " · Vencida"
                          : ""}
                      </span>
                      <span>
                        {a.status === "done"
                          ? "Eficácia a verificar"
                          : "Prazo de execução"}
                      </span>
                    </div>
                    <details className="eq-chart-details">
                      <summary>Verificação e evidências</summary>
                      <p>{a.plan.indicator}</p>
                      <p>
                        {a.evidence || "Ainda sem evidência registrada."}
                      </p>
                    </details>
                    <button
                      onClick={() => {
                        setEdit(a);
                        setEvidence(a.evidence || "");
                        setStatus(a.status);
                      }}
                    >
                      Atualizar andamento →
                    </button>
                  </article>
                ))
              ) : (
                <p className="eq-plan-empty">
                  {key === "planned"
                    ? "Adote uma proposta do relatório para iniciar."
                    : key === "progress"
                      ? "Nenhuma medida em execução."
                      : "Execuções concluídas aparecerão aqui."}
                </p>
              )}
            </section>
          );
        })}
      </div>
      <p className="eq-footnote">
        A conclusão exige evidência de execução. A eficácia deve ser
        verificada com a equipe, os registros operacionais e novas
        rodadas.
      </p>
    </section>
  );
}

export default function Dashboard({
  reportMode = false,
}: {
  reportMode?: boolean;
}) {
  const { user, loading } = useAuth("admin"),
    [data, setData] = useState<Data | null>(null),
    [error, setError] = useState(""),
    [selected, setSelected] = useState(""),
    [insight, setInsight] = useState<Insight | null>(null),
    [busy, setBusy] = useState(false),
    [plan, setPlan] = useState<Finding | null>(null),
    [owner, setOwner] = useState(""),
    [due, setDue] = useState(""),
    [edit, setEdit] = useState<Action | null>(null),
    [evidence, setEvidence] = useState(""),
    [status, setStatus] = useState("planned"),
    [close, setClose] = useState(false);
  async function refresh() {
    try {
      const d = await api("/api/admin/stats");
      setData(d);
      setSelected(
        (s) =>
          s ||
          new URLSearchParams(window.location.search).get("campanha") ||
          d.batches.filter((b: Snapshot) => (b.completed || 0) > 0 && b.closedAt).at(-1)?.id ||
          d.batches.filter((b: Snapshot) => (b.completed || 0) > 0).at(-1)?.id ||
          d.batches.filter((b: Snapshot) => b.closedAt).at(-1)?.id ||
          d.batches.at(-1)?.id ||
          "",
      );
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    if (user) void refresh();
  }, [user?.id]);
  useEffect(() => {
    setInsight(null);
    setClose(false);
  }, [selected]);
  const totalCompleted = data?.batches?.reduce((acc, b) => acc + (b.completed || 0), 0) ?? 0,
    hasBatches = Boolean(data?.batches && data.batches.length > 0),
    hasDataToAnalyze = hasBatches && totalCompleted > 0;
  const batch = data?.batches.find((b) => b.id === selected),
    series =
      data?.batches.filter(
        (b) =>
          b.sector === batch?.sector &&
          b.protocolVersion === batch?.protocolVersion,
      ) || [],
    previous = series
      .filter(
        (b) =>
          b.closedAt && new Date(b.closedAt) < new Date(batch?.closedAt || 0),
      )
      .sort((a, b) => a.closedAt!.localeCompare(b.closedAt!))
      .at(-1);
  const findings = batch ? priorities(batch) : [],
    report =
      insight?.batchId === batch?.id && insight
        ? insight
        : batch
          ? localReport(batch)
          : null,
    deltas = batch ? comparison(batch, previous) : [],
    open = data?.actions.filter((a) => a.status !== "done") || [],
    overdue = open.filter(
      (a) => a.due_date < new Date().toISOString().slice(0, 10),
    ),
    improved = deltas.filter((d) => d.delta !== null && d.delta < 0),
    worse = deltas.filter((d) => d.delta !== null && d.delta > 0);
  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function adopt(f: Finding) {
    setPlan(f);
    setOwner(f.action.owner);
    setDue(
      new Date(Date.now() + f.action.days * 86400000)
        .toISOString()
        .slice(0, 10),
    );
  }
  function download() {
    if (!batch) return;
    const rows = [
      [
        "Campanha",
        "Setor",
        "Encerramento",
        "Tema",
        "Frequentes",
        "Base válida",
        "Percentual",
        "Referência",
      ],
      ...batch.dimensions.map((d) => [
        batch.title,
        batch.sector,
        batch.closedAt || "",
        d.name,
        d.unfavorable ?? "Protegido",
        d.valid ?? "Protegido",
        d.percent ?? "Protegido",
        d.reference,
      ]),
    ];
    const blob = new Blob(
        ["\uFEFF" + rows.map((r) => r.map(csvCell).join(";")).join("\r\n")],
        { type: "text/csv;charset=utf-8" },
      ),
      url = URL.createObjectURL(blob),
      a = document.createElement("a");
    a.href = url;
    a.download = "equilibra-" + batch.id + ".csv";
    a.click();
    URL.revokeObjectURL(url);
  }
  const reportHref =
    "/admin/relatorios" +
    (batch ? "?campanha=" + encodeURIComponent(batch.id) : "");
  if (loading)
    return (
      <main className="eq-workspace">
        <p className="eq-subtitle">Carregando sua conta…</p>
      </main>
    );
  const isEmptyState = data && (!hasDataToAnalyze || !batch || batch.completed === 0);

  return (
    <main className={`eq-workspace ${isEmptyState ? "eq-empty-screen" : ""}`}>
      <PageReveal selector=".eq-panel, .eq-topbar, .eq-tabs, .eq-stat, .eq-grid, .eq-card, .eq-chart" />
      <header className="eq-topbar" style={isEmptyState ? { marginBottom: 12 } : undefined}>
        <div>
          <p className="eq-eyebrow">EQUILIBRA / INTELIGÊNCIA DE GESTÃO</p>
          <h1 style={isEmptyState ? { fontSize: 24 } : undefined}>
            {reportMode ? "Relatório da rodada" : "Panorama da organização"}
          </h1>
          <p className="eq-subtitle" style={isEmptyState ? { marginTop: 4, fontSize: 12 } : undefined}>
            {reportMode
              ? "Evidências, mudanças e medidas propostas em um documento para decidir e acompanhar."
              : "Entenda o que precisa de atenção. Acompanhe o que está sendo feito."}
          </p>
        </div>
        <div className="eq-topbar-actions">
          {reportMode ? (
            <>
              <button
                onClick={download}
                disabled={!batch}
                className="eq-button secondary"
              >
                <Icon name="download" />
                Dados CSV
              </button>
              <button
                onClick={() => window.print()}
                disabled={!batch}
                className="eq-button"
              >
                <Icon name="print" />
                Imprimir / PDF
              </button>
            </>
          ) : (
            <Link href="/admin/pesquisas" className="eq-button">
              <Icon name="add" />
              Nova campanha
            </Link>
          )}
        </div>
      </header>
      <nav aria-label="Visões de gestão" className="eq-tabs" style={isEmptyState ? { marginBottom: 14 } : undefined}>
        <Link className={!reportMode ? "active" : ""} href="/admin">
          Visão geral
        </Link>
        <Link className={reportMode ? "active" : ""} href={reportHref}>
          Relatório e recomendações
        </Link>
      </nav>
      {error && (
        <div role="alert" className="eq-alert">
          {error} <button onClick={refresh}>Tentar novamente</button>
        </div>
      )}
      {!data && !error && (
        <section className="eq-panel">
          <div className="eq-chart-empty">
            <p>Carregando os indicadores da sua conta…</p>
          </div>
        </section>
      )}
      {data && (
        <>
          {!hasDataToAnalyze ? (
            <div className="flex flex-1 flex-col items-center justify-center my-auto w-full min-h-0">
              <div className="w-full max-w-3xl rounded-2xl border border-slate-200/80 bg-white p-6 sm:p-8 text-center shadow-sm">
                <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-700 shadow-inner border border-slate-200/60">
                  <Icon name="query_stats" />
                </div>
                <h2 className="text-lg sm:text-xl font-bold tracking-tight text-slate-800">
                  {!hasBatches
                    ? "Nenhuma pesquisa cadastrada"
                    : "Nenhum dado para analisar ainda"}
                </h2>
                <p className="mx-auto mt-2 max-w-md text-xs text-slate-500 leading-relaxed">
                  {!hasBatches
                    ? "Para visualizar os indicadores e relatórios analíticos, crie sua primeira campanha de pesquisa e compartilhe os links com os colaboradores."
                    : "Você já possui campanhas criadas, mas nenhuma resposta foi preenchida ainda. Assim que os colaboradores responderem à pesquisa, os gráficos de evolução, matrizes e diagnósticos serão exibidos automaticamente aqui."}
                </p>
                <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
                  <Link
                    href="/admin/pesquisas"
                    className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-slate-800"
                  >
                    <Icon name={!hasBatches ? "add" : "link"} />
                    {!hasBatches ? "Criar primeira pesquisa" : "Ver pesquisas e links"}
                  </Link>
                </div>

                <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3 text-left border-t border-slate-100 pt-5">
                  <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5 transition hover:bg-slate-50">
                    <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-white text-[11px] font-bold text-slate-700 shadow-sm border border-slate-200/60">
                      1
                    </div>
                    <p className="mt-2 text-xs font-semibold text-slate-900">Crie a pesquisa</p>
                    <p className="mt-0.5 text-[11px] text-slate-500 leading-relaxed">Defina o nome da campanha e sua cor de identificação.</p>
                  </div>
                  <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5 transition hover:bg-slate-50">
                    <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-white text-[11px] font-bold text-slate-700 shadow-sm border border-slate-200/60">
                      2
                    </div>
                    <p className="mt-2 text-xs font-semibold text-slate-900">Envie os links</p>
                    <p className="mt-0.5 text-[11px] text-slate-500 leading-relaxed">Gere e compartilhe links anônimos com os colaboradores.</p>
                  </div>
                  <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5 transition hover:bg-slate-50">
                    <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-white text-[11px] font-bold text-slate-700 shadow-sm border border-slate-200/60">
                      3
                    </div>
                    <p className="mt-2 text-xs font-semibold text-slate-900">Analise os dados</p>
                    <p className="mt-0.5 text-[11px] text-slate-500 leading-relaxed">Acompanhe métricas, fatores de atenção e relatórios IA.</p>
                  </div>
                </div>
              </div>
            </div>
          ) : !batch || batch.completed === 0 ? (
            <div className="flex flex-1 flex-col justify-between py-1 space-y-4 w-full min-h-0">
              <div className="eq-campaign-bar">
                <div className="eq-campaign-info">
                  <span className="eq-campaign-icon">
                    <Icon name="folder_open" />
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <label htmlFor="campaign">CAMPANHA EM ANÁLISE</label>
                    <select
                      id="campaign"
                      aria-label="Campanha"
                      value={selected}
                      onChange={(e) => setSelected(e.target.value)}
                    >
                      {data.batches.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.title} · {b.sector} ({b.completed} respostas)
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                {batch && (
                  <div className="eq-inline">
                    <span
                      className={
                        "eq-badge " + (batch.closedAt ? "green" : "orange")
                      }
                    >
                      {batch.closedAt
                        ? "Coleta encerrada"
                        : "Coleta em andamento"}
                    </span>
                    <span className="eq-campaign-meta">
                      {batch.closedAt
                        ? date(batch.closedAt)
                        : "Iniciada em " + date(batch.createdAt)}
                    </span>
                  </div>
                )}
              </div>

              <div className="my-auto flex flex-col items-center justify-center rounded-2xl border border-slate-200/80 bg-white p-12 text-center shadow-sm max-w-3xl mx-auto w-full">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 border border-amber-100">
                  <Icon name="hourglass_empty" />
                </div>
                <h3 className="text-xl font-bold text-slate-800">
                  Esta campanha ainda não possui respostas concluídas
                </h3>
                <p className="mt-2 max-w-md text-sm text-slate-600 leading-relaxed">
                  {batch?.title
                    ? `A campanha "${batch.title}" possui ${batch.invited || 0} links gerados e 0 respostas finalizadas.`
                    : "Nenhuma resposta foi registrada para esta campanha."}{" "}
                  Envie os links aos colaboradores ou selecione outra campanha no menu acima.
                </p>
                <div className="mt-6 flex gap-3">
                  <Link
                    href="/admin/pesquisas"
                    className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
                  >
                    <Icon name="link" />
                    Ver links desta campanha
                  </Link>
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="eq-campaign-bar">
                <div className="eq-campaign-info">
                  <span className="eq-campaign-icon">
                    <Icon name="folder_open" />
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <label htmlFor="campaign">CAMPANHA EM ANÁLISE</label>
                    <select
                      id="campaign"
                      aria-label="Campanha"
                      value={selected}
                      onChange={(e) => setSelected(e.target.value)}
                    >
                      {data.batches.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.title} · {b.sector}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="eq-inline">
                  <span
                    className={
                      "eq-badge " + (batch.closedAt ? "green" : "orange")
                    }
                  >
                    {batch.closedAt
                      ? "Coleta encerrada"
                      : "Coleta em andamento"}
                  </span>
                  <span className="eq-campaign-meta">
                    {batch.closedAt
                      ? date(batch.closedAt)
                      : "Iniciada em " + date(batch.createdAt)}
                  </span>
                  {!batch.closedAt && (
                    <button
                      className="eq-button quiet"
                      onClick={() => setClose(true)}
                    >
                      Encerrar rodada
                    </button>
                  )}
                </div>
              </div>
              {!reportMode && (
                <>
                  <div className="eq-kpis">
                    {[
                      {
                        label: "Participação na rodada",
                        value: batch.invited
                          ? number((batch.completed / batch.invited) * 100) +
                            "%"
                          : "—",
                        sub:
                          batch.completed +
                          " de " +
                          batch.invited +
                          " convites concluídos",
                        icon: "group",
                      },
                      {
                        label: "Temas divulgáveis",
                        value:
                          batch.dimensions.filter((d) => d.percent !== null)
                            .length + "/7",
                        sub: "Bases válidas e proteção de pequenos grupos",
                        icon: "analytics",
                      },
                      {
                        label: "Redução de frequência",
                        value: previous ? String(improved.length) : "—",
                        sub: previous
                          ? "Temas com queda em relação à rodada anterior"
                          : "Aguardando uma rodada comparável",
                        icon: "trending_down",
                      },
                      {
                        label: "Ações em aberto",
                        value: String(open.length),
                        sub: overdue.length
                          ? overdue.length + " com prazo vencido"
                          : "Nenhum prazo vencido",
                        icon: "checklist",
                      },
                    ].map((k) => (
                      <article className="eq-kpi" key={k.label}>
                        <div className="eq-kpi-top">
                          <span>{k.label}</span>
                          <Icon name={k.icon} />
                        </div>
                        <p className="eq-kpi-number">{k.value}</p>
                        <small>{k.sub}</small>
                      </article>
                    ))}
                  </div>
                  <section className="eq-overview-band">
                    <div>
                      <p className="eq-eyebrow">
                        {batch.released
                          ? "LEITURA DA RODADA"
                          : "ACOMPANHAMENTO DA COLETA"}
                      </p>
                      <h2>
                        {!batch.closedAt
                          ? "A escuta está em andamento"
                          : !batch.released
                            ? "A amostra ainda precisa de proteção"
                            : findings[0]
                              ? findings[0].name + " merece atenção"
                              : "Examine a qualidade da coleta"}
                      </h2>
                      <p>
                        {!batch.closedAt
                          ? "Os indicadores ficam protegidos durante a coleta. Encerre a rodada quando concluir a distribuição e o período de resposta."
                          : !batch.released
                            ? "Resultados individuais não são exibidos. Para as próximas rodadas, planeje grupos com ao menos 10 participantes, sem recortes que permitam reconhecer pessoas."
                            : findings[0]
                              ? number(findings[0].percent!) +
                                "% das respostas válidas indicaram uma condição desfavorável frequente neste tema. O relatório reúne a evidência e uma proposta concreta de melhoria."
                              : report?.summary}
                      </p>
                    </div>
                    <Link href={reportHref} className="eq-button">
                      Examinar relatório <Icon name="arrow_forward" />
                    </Link>
                  </section>
                  <div className="eq-grid">
                    <Evolution batches={series} />
                    <section className="eq-panel">
                      <div className="eq-panel-heading">
                        <div>
                          <p className="eq-eyebrow">ONDE INVESTIGAR PRIMEIRO</p>
                          <h2>Condições mais frequentes</h2>
                        </div>
                        <span className="eq-badge">Rodada atual</span>
                      </div>
                      {findings.length ? (
                        <div className="eq-priority-list">
                          {findings.slice(0, 5).map((d, i) => (
                            <div key={d.id} className="eq-priority-row">
                              <span className="eq-rank">
                                {String(i + 1).padStart(2, "0")}
                              </span>
                              <div>
                                <strong>{d.name}</strong>
                                <small>
                                  {d.unfavorable} de {d.valid} respostas válidas
                                </small>
                                <div className="eq-bar-track">
                                  <span style={{ width: d.percent + "%" }} />
                                </div>
                              </div>
                              <b>{number(d.percent!)}%</b>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="eq-chart-empty">
                          <Icon name="shield" />
                          <h3>
                            {batch.released
                              ? "Nenhuma frequência divulgável acima de zero"
                              : "Resultados protegidos"}
                          </h3>
                          <p>
                            Não é possível concluir ausência de riscos a partir
                            de dados ausentes ou protegidos.
                          </p>
                        </div>
                      )}
                      <p className="eq-footnote">
                        Ordem por frequência de “Frequentemente” ou “Sempre”. A
                        prioridade técnica depende também da avaliação da
                        atividade e da gravidade das possíveis consequências.
                      </p>
                    </section>
                  </div>
                  <PlanSection
                    data={data}
                    reportMode={false}
                    batch={batch}
                    setEdit={setEdit}
                    setEvidence={setEvidence}
                    setStatus={setStatus}
                  />
                  <div className="eq-grid">
                    <Heatmap batches={series} />
                    <PeriodComparison batch={batch} previous={previous} />
                  </div>
                </>
              )}
              {reportMode && (
                <>
                  <section className="eq-panel">
                    <div className="eq-report-intro">
                      <div>
                        <p className="eq-eyebrow">
                          RELATÓRIO DE PERCEPÇÃO DAS CONDIÇÕES DE TRABALHO
                        </p>
                        <h2>{batch.title}</h2>
                        <p>{report?.summary}</p>
                      </div>
                      <div className="eq-report-seal">
                        <Icon name="description" />
                      </div>
                    </div>
                    <div className="eq-report-stats">
                      <div>
                        <small>GRUPO</small>
                        <strong>{batch.sector}</strong>
                      </div>
                      <div>
                        <small>PARTICIPAÇÃO</small>
                        <strong>
                          {batch.completed} / {batch.invited} convites
                        </strong>
                      </div>
                      <div>
                        <small>PERÍODO DA COLETA</small>
                        <strong>
                          {date(batch.createdAt)} —{" "}
                          {batch.closedAt
                            ? date(batch.closedAt)
                            : "em andamento"}
                        </strong>
                      </div>
                      <div>
                        <small>COMPARAÇÃO</small>
                        <strong>
                          {previous?.title || "Ainda indisponível"}
                        </strong>
                      </div>
                    </div>
                    {previous && (
                      <p className="eq-subtitle">
                        {improved.length} temas apresentaram redução de
                        frequência; {worse.length} apresentaram aumento. São
                        comparações descritivas entre grupos que podem ter
                        composições diferentes.
                      </p>
                    )}
                    <div className="eq-report-notes">
                      <div>
                        <h3>Como interpretar</h3>
                        <p>
                          O percentual representa respostas “Frequentemente” ou
                          “Sempre” às condições desfavoráveis nas últimas duas
                          semanas. A base exclui recusas e “Não se aplica”.
                          Frequência não equivale à classificação técnica de
                          risco ocupacional.
                        </p>
                      </div>
                      <div>
                        <h3>Qualidade e lacunas</h3>
                        <p>
                          {
                            batch.dimensions.filter((d) => d.percent !== null)
                              .length
                          }{" "}
                          de 7 temas têm base divulgável. Os demais estão
                          protegidos por tamanho de grupo, pequenas contagens ou
                          coleta aberta. Ausência de divulgação não indica
                          condição favorável.
                        </p>
                      </div>
                    </div>
                  </section>
                  <section className="eq-panel">
                    <div className="eq-panel-heading">
                      <div>
                        <p className="eq-eyebrow">DA EVIDÊNCIA À DECISÃO</p>
                        <h2>Propostas de intervenção</h2>
                      </div>
                      <button
                        disabled={busy || !findings.length}
                        className="eq-button secondary"
                        onClick={() =>
                          run(async () =>
                            setInsight(
                              await api("/api/admin/insights", {
                                method: "POST",
                                body: JSON.stringify({ batchId: batch.id }),
                              }),
                            ),
                          )
                        }
                      >
                        <Icon name="auto_awesome" />
                        {busy ? "Preparando…" : "Priorizar com IA"}
                      </button>
                    </div>
                    <p className="eq-subtitle" style={{ marginBottom: 20 }}>
                      {report?.source === "ai_assisted"
                        ? "A IA auxiliou a ordem das três propostas prioritárias; evidências e medidas permanecem vinculadas aos dados."
                        : "Propostas prontas para revisão, vinculadas às condições observadas. A IA pode auxiliar a priorização, sem modificar os números."}
                    </p>
                    {report?.findings.length ? (
                      <div className="eq-findings">
                        {report.findings.map((f, i) => (
                          <article className="eq-finding" key={f.id}>
                            <p className="eq-eyebrow">
                              {String(i + 1).padStart(2, "0")} / {f.name}
                            </p>
                            <h3>{f.action.title}</h3>
                            <p className="evidence">{f.evidence}</p>
                            <ol>
                              {f.action.steps.map((s) => (
                                <li key={s}>{s}</li>
                              ))}
                            </ol>
                            <dl>
                              <dt>Responsável sugerido</dt>
                              <dd>{f.action.owner}</dd>
                              <dt>Prazo proposto</dt>
                              <dd>
                                {f.action.days} dias, sujeito à avaliação da
                                organização
                              </dd>
                              <dt>Recursos necessários</dt>
                              <dd>{f.action.resources}</dd>
                              <dt>Evidência de execução</dt>
                              <dd>{f.action.evidence}</dd>
                              <dt>Como verificar o resultado</dt>
                              <dd>{f.action.indicator}</dd>
                            </dl>
                            <button
                              className="eq-button quiet"
                              onClick={() => adopt(f)}
                            >
                              <Icon name="add_task" />
                              Adotar no plano
                            </button>
                            <details className="eq-chart-details">
                              <summary>Rastreabilidade do achado</summary>
                              <p
                                className="eq-footnote"
                                style={{ overflowWrap: "anywhere" }}
                              >
                                {f.reference}
                              </p>
                            </details>
                          </article>
                        ))}
                      </div>
                    ) : (
                      <div className="eq-chart-empty">
                        <h3>Sem base para recomendações nesta rodada</h3>
                        <p>{report?.summary}</p>
                      </div>
                    )}
                    <div className="eq-report-notes">
                      <div>
                        <h3>Validação antes de agir</h3>
                        <ul>
                          <li>
                            Confirmar as condições na atividade real com
                            participação da equipe.
                          </li>
                          <li>
                            Relacionar os achados ao inventário e aos critérios
                            documentados de avaliação.
                          </li>
                          <li>
                            Revisar recursos, responsáveis e prazos antes de
                            aprovar as medidas.
                          </li>
                        </ul>
                      </div>
                      <div>
                        <h3>Reavaliação</h3>
                        <p>
                          Verifique a implementação e ouça a equipe. Repita a
                          coleta com o mesmo instrumento e grupo organizacional.
                          Uma redução de frequência é um sinal a investigar, não
                          uma prova isolada de eficácia.
                        </p>
                      </div>
                    </div>
                  </section>
                  <PlanSection
                    data={data}
                    reportMode={true}
                    batch={batch}
                    setEdit={setEdit}
                    setEvidence={setEvidence}
                    setStatus={setStatus}
                  />
                  <div className="eq-grid">
                    <PeriodComparison batch={batch} previous={previous} />
                    <Evolution batches={series} />
                  </div>
                  <Heatmap batches={series} />
                  <section className="eq-panel">
                    <div className="eq-panel-heading">
                      <div>
                        <p className="eq-eyebrow">BASE DO RELATÓRIO</p>
                        <h2>Dados e denominadores</h2>
                      </div>
                      <button
                        className="eq-button secondary"
                        onClick={download}
                      >
                        <Icon name="download" />
                        Exportar dados
                      </button>
                    </div>
                    <div className="eq-table-scroll">
                      <table className="eq-table">
                        <thead>
                          <tr>
                            <th>Tema</th>
                            <th>Respostas frequentes</th>
                            <th>Base válida</th>
                            <th>Percentual</th>
                            <th>Variação</th>
                          </tr>
                        </thead>
                        <tbody>
                          {batch.dimensions.map((d) => {
                            const delta = deltas.find(
                              (x) => x.id === d.id,
                            )?.delta;
                            return (
                              <tr key={d.id}>
                                <td>{d.name}</td>
                                <td>{d.unfavorable ?? "Protegido"}</td>
                                <td>{d.valid ?? "—"}</td>
                                <td>
                                  {d.percent === null
                                    ? "—"
                                    : number(d.percent) + "%"}
                                </td>
                                <td>
                                  {delta == null
                                    ? "—"
                                    : (delta > 0 ? "+" : "") +
                                      number(delta) +
                                      " p.p."}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    <p className="eq-footnote">
                      Instrumento {batch.protocolVersion}. Pelo menos 10
                      respostas válidas por tema; subcontagens de 1 ou 2 são
                      protegidas. Não há estimativa de severidade ou
                      probabilidade ocupacional neste relatório.
                    </p>
                  </section>
                </>
              )}
            </>
          )}
          {data.legacyLinks > 0 && (
            <details className="eq-notice">
              <summary>
                {data.legacyLinks} convites do instrumento anterior preservados
              </summary>
              <p style={{ marginTop: 10 }}>
                Não são misturados a esta série temporal. Crie campanhas novas
                para utilizar o protocolo atual.
              </p>
            </details>
          )}
          <footer className="eq-footer">
            <span>
              Equilibra · Instrumento próprio de percepção. Apoia o GRO/PGR; não
              substitui avaliação técnica ou certifica conformidade com a NR-1.
            </span>
            <span>
              Consulta: {new Date(data.generatedAt).toLocaleString("pt-BR")}
            </span>
          </footer>
        </>
      )}
      {(plan || edit || close) && (
        <div className="eq-modal-backdrop">
          <section
            role="dialog"
            aria-modal="true"
            aria-label={
              close
                ? "Encerrar campanha"
                : plan
                  ? "Adotar medida"
                  : "Atualizar medida"
            }
            className="eq-modal"
          >
            <h2>
              {close
                ? "Encerrar esta rodada?"
                : plan?.action.title || edit?.title}
            </h2>
            {close ? (
              <>
                <p>
                  Os convites pendentes serão desativados. A rodada não poderá
                  ser reaberta. Os resultados serão divulgados somente quando
                  houver grupo suficiente.
                </p>
                <button
                  disabled={busy}
                  className="eq-button"
                  onClick={() =>
                    run(async () => {
                      await api("/api/admin/batches/" + batch!.id + "/close", {
                        method: "POST",
                      });
                      setClose(false);
                      await refresh();
                    })
                  }
                >
                  Confirmar encerramento
                </button>
              </>
            ) : plan ? (
              <>
                <label>
                  Responsável
                  <input
                    value={owner}
                    maxLength={150}
                    onChange={(e) => setOwner(e.target.value)}
                  />
                </label>
                <label>
                  Prazo proposto
                  <input
                    type="date"
                    value={due}
                    onChange={(e) => setDue(e.target.value)}
                  />
                </label>
                <p>Recursos: {plan.action.resources}</p>
                <button
                  disabled={busy}
                  className="eq-button"
                  onClick={() =>
                    run(async () => {
                      await api("/api/admin/actions", {
                        method: "POST",
                        body: JSON.stringify({
                          batchId: selected,
                          dimensionId: plan.id,
                          owner,
                          dueDate: due,
                        }),
                      });
                      setPlan(null);
                      await refresh();
                    })
                  }
                >
                  Aprovar medida
                </button>
              </>
            ) : (
              <>
                <label>
                  Andamento
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                  >
                    <option value="planned">Planejada</option>
                    <option value="progress">Em andamento</option>
                    <option value="done">Execução concluída</option>
                  </select>
                </label>
                <label>
                  Evidência ou observação
                  <textarea
                    rows={4}
                    value={evidence}
                    maxLength={2000}
                    onChange={(e) => setEvidence(e.target.value)}
                  />
                </label>
                <p>
                  Para concluir, registre o que foi implementado e como a
                  execução pode ser verificada.
                </p>
                <button
                  disabled={busy}
                  className="eq-button"
                  onClick={() =>
                    run(async () => {
                      await api("/api/admin/actions", {
                        method: "PATCH",
                        body: JSON.stringify({
                          id: edit?.id,
                          status,
                          evidence,
                        }),
                      });
                      setEdit(null);
                      await refresh();
                    })
                  }
                >
                  Salvar andamento
                </button>
              </>
            )}
            <button
              className="eq-button secondary"
              style={{ marginLeft: 10 }}
              onClick={() => {
                setPlan(null);
                setEdit(null);
                setClose(false);
              }}
            >
              Cancelar
            </button>
            {error && (
              <p role="alert" className="eq-alert" style={{ marginTop: 15 }}>
                {error}
              </p>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
