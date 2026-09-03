"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { authenticatedFetch } from "@/lib/api-client";

interface AiReport {
  id: string;
  sessionId: string;
  linkId?: string;
  createdAt: string;
  profile: any;
  confidenceScore: number;
  overallRiskCategory: string;
  overallRiskScore: number;
  executiveSummary: string;
  dimensions: Record<string, any>;
  behavioralAnalysis: string;
  technicalInferences: string;
  actionPlan5w2h: any[];
  actionPlan: any;
  fullNarrativeReport: string;
  conversationLog: any[];
}

export default function RelatoriosPage() {
  const { user, loading } = useAuth("admin");
  const [reports, setReports] = useState<AiReport[]>([]);
  const [selectedReport, setSelectedReport] = useState<AiReport | null>(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"pgr_ai" | "analytics">("pgr_ai");

  useEffect(() => {
    const fetchReports = async () => {
      try {
        const res = await fetch("/api/reports");
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) setReports(data);
        }
      } catch (err) {
        console.error("Erro ao carregar relatórios:", err);
      } finally {
        setDataLoading(false);
      }
    };
    fetchReports();
  }, []);

  if (loading) return <LoadingSpinner message="Verificando acesso..." />;

  const getRiskBadge = (cat: string) => {
    const normalized = (cat || "").toLowerCase();
    if (normalized.includes("crit") || normalized.includes("critical") || normalized.includes("sever")) {
      return { label: "Crítico", color: "bg-red-100 text-red-700 border-red-200" };
    }
    if (normalized.includes("alt") || normalized.includes("high")) {
      return { label: "Alto", color: "bg-orange-100 text-orange-700 border-orange-200" };
    }
    if (normalized.includes("med") || normalized.includes("moder")) {
      return { label: "Médio", color: "bg-amber-100 text-amber-700 border-amber-200" };
    }
    return { label: "Baixo", color: "bg-emerald-100 text-emerald-700 border-emerald-200" };
  };

  return (
    <div className="flex flex-col">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-purple-100 bg-white px-8 py-4 shadow-sm">
        <div>
          <h1 className="text-lg font-bold text-[#260054]">
            Relatórios NR-1 & PGR
          </h1>
          <p className="text-xs text-[#4a4550]">
            Diagnósticos gerados pela IA
          </p>
        </div>

        <div className="flex rounded-xl bg-purple-50 p-1 border border-purple-100">
          <button
            type="button"
            onClick={() => setActiveTab("pgr_ai")}
            className={`rounded-lg px-3.5 py-1.5 text-xs font-bold transition-all ${
              activeTab === "pgr_ai"
                ? "bg-[#3d1a6e] text-white shadow-sm"
                : "text-[#4a4550] hover:text-[#260054]"
            }`}
          >
            Laudos IA ({reports.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("analytics")}
            className={`rounded-lg px-3.5 py-1.5 text-xs font-bold transition-all ${
              activeTab === "analytics"
                ? "bg-[#3d1a6e] text-white shadow-sm"
                : "text-[#4a4550] hover:text-[#260054]"
            }`}
          >
            Panorama
          </button>
        </div>
      </header>

      <main className="flex-1 space-y-6 p-8">
        {/* Metric Overview */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[
            {
              label: "Laudos Emitidos",
              value: reports.length,
              icon: "description",
              gradient: "from-[#3d1a6e] to-[#260054]",
            },
            {
              label: "Risco Baixo",
              value: reports.filter((r) => (r.overallRiskCategory || "").toLowerCase().includes("low") || (r.overallRiskCategory || "").toLowerCase().includes("baix")).length,
              icon: "sentiment_satisfied",
              gradient: "from-emerald-600 to-emerald-800",
            },
            {
              label: "Atenção / Alto Risco",
              value: reports.filter((r) => !(r.overallRiskCategory || "").toLowerCase().includes("low") && !(r.overallRiskCategory || "").toLowerCase().includes("baix")).length,
              icon: "warning",
              gradient: "from-amber-600 to-orange-700",
            },
          ].map((c) => (
            <div key={c.label} className={`rounded-2xl bg-gradient-to-br ${c.gradient} p-5 text-white shadow-sm`}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium opacity-80">{c.label}</span>
                <span className="material-symbols-outlined text-xl opacity-75">{c.icon}</span>
              </div>
              <p className="mt-2 text-3xl font-bold">{c.value}</p>
            </div>
          ))}
        </div>

        {/* Reports Table */}
        <div className="overflow-hidden rounded-2xl border border-purple-100 bg-white shadow-sm">
          <div className="border-b border-purple-100 px-6 py-5">
            <h2 className="font-bold text-[#260054]">Inventário de Laudos Técnicos Emitidos</h2>
            <p className="text-xs text-[#4a4550]">
              Cada documento subsidia o PGR conforme item 1.5.3.3 e Portaria MTE nº 1.419/2024
            </p>
          </div>

          {dataLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-purple-200 border-t-[#3d1a6e]" />
            </div>
          ) : reports.length === 0 ? (
            <div className="py-20 text-center text-[#4a4550]">
              <span className="material-symbols-outlined text-5xl opacity-20">assignment_turned_in</span>
              <p className="mt-3 text-sm">Nenhum laudo pericial gerado ainda.</p>
              <p className="text-xs text-purple-400 mt-1">
                Gere um link de pesquisa na aba de Pesquisas e envie a um colaborador para ver o relatório aqui.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-purple-50 text-xs font-bold uppercase tracking-wider text-[#4a4550]">
                  <tr>
                    <th className="px-6 py-3 text-left">Protocolo / Laudo</th>
                    <th className="px-6 py-3 text-left">Setor / Posto</th>
                    <th className="px-6 py-3 text-left">Nível de Risco</th>
                    <th className="px-6 py-3 text-left">Confiança Algorítmica</th>
                    <th className="px-6 py-3 text-left">Data de Conclusão</th>
                    <th className="px-6 py-3 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-purple-50">
                  {reports.map((r) => {
                    const badge = getRiskBadge(r.overallRiskCategory);
                    return (
                      <tr key={r.id} className="transition-colors hover:bg-purple-50/40">
                        <td className="px-6 py-4">
                          <p className="font-bold text-[#260054]">Laudo Pericial Oficial</p>
                          <span className="font-mono text-xs text-[#6b538c] bg-purple-50 px-2 py-0.5 rounded border border-purple-100">
                            {r.id}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <p className="font-semibold text-[#260054]">{r.profile?.sector || "Geral"}</p>
                          <span className="text-xs text-[#4a4550]">
                            Turno: {r.profile?.shift || "1º Turno"} • {r.profile?.workerName || "Colaborador"}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold ${badge.color}`}>
                            {badge.label}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="font-bold text-[#260054]">{r.confidenceScore || 85}%</span>
                        </td>
                        <td className="px-6 py-4 text-xs text-[#4a4550]">
                          {new Date(r.createdAt).toLocaleDateString("pt-BR", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <button
                            type="button"
                            onClick={() => setSelectedReport(r)}
                            className="rounded-xl bg-[#3d1a6e] px-4 py-2 text-xs font-bold text-white shadow transition-all hover:bg-[#2D1052]"
                          >
                            Ver Laudo Completo
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Modal: Visualizador Completo do Laudo Pericial PGR */}
      {selectedReport && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onClick={() => setSelectedReport(null)}
        >
          <div
            className="flex max-h-[90vh] w-full max-w-4xl flex-col rounded-3xl border border-purple-200 bg-white p-6 shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header do Laudo */}
            <div className="flex items-center justify-between border-b border-purple-100 pb-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-purple-600">
                  Laudo Pericial Oficial • GRO/PGR (NR-01)
                </span>
                <h3 className="font-['Epilogue'] text-xl font-bold text-[#260054]">
                  Protocolo Técnico: {selectedReport.id}
                </h3>
                <p className="text-xs text-[#4a4550]">
                  Setor: <strong>{selectedReport.profile?.sector}</strong> | Identificação: <strong>{selectedReport.profile?.workerName}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedReport(null)}
                className="rounded-full p-2 text-[#4a4550] hover:bg-purple-50 hover:text-[#260054]"
              >
                <span className="material-symbols-outlined text-2xl">close</span>
              </button>
            </div>

            {/* Conteúdo com Scroll */}
            <div className="flex-1 space-y-6 overflow-y-auto py-6 pr-2">
              
              {/* Sumário Executivo */}
              <div className="rounded-2xl border border-purple-200 bg-purple-50/50 p-5">
                <h4 className="font-bold text-[#260054] flex items-center gap-2">
                  <span className="material-symbols-outlined text-purple-700">clinical_notes</span>
                  Sumário Executivo Pericial
                </h4>
                <p className="mt-2 text-sm leading-relaxed text-[#4a4550]">
                  {selectedReport.executiveSummary}
                </p>
              </div>

              {/* Análise Comportamental & Inferências Técnicas */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-purple-100 bg-white p-5 shadow-sm">
                  <h5 className="font-bold text-[#260054] text-xs uppercase tracking-wider">
                    Análise Comportamental & Segurança Psicológica
                  </h5>
                  <p className="mt-2 text-xs leading-relaxed text-[#4a4550]">
                    {selectedReport.behavioralAnalysis}
                  </p>
                </div>
                <div className="rounded-2xl border border-purple-100 bg-white p-5 shadow-sm">
                  <h5 className="font-bold text-[#260054] text-xs uppercase tracking-wider">
                    Inferências Técnicas e Enquadramento NR-1 / Portaria 1.419
                  </h5>
                  <p className="mt-2 text-xs leading-relaxed text-[#4a4550]">
                    {selectedReport.technicalInferences}
                  </p>
                </div>
              </div>

              {/* 7 Dimensões do ISTAS21-BR & Matriz 5x5 */}
              <div>
                <h4 className="font-bold text-[#260054] text-sm uppercase tracking-wider mb-3">
                  Avaliação das Dimensões Psicossociais (ISTAS21-BR)
                </h4>
                <div className="space-y-3">
                  {Object.entries(selectedReport.dimensions || {}).map(([dimKey, dimData]: [string, any]) => (
                    <div key={dimKey} className="rounded-2xl border border-purple-100 bg-white p-4 shadow-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-purple-50 pb-2">
                        <span className="font-bold text-[#260054] text-sm">{dimData.name || dimKey}</span>
                        <div className="flex items-center gap-2">
                          <span className="rounded bg-purple-50 px-2 py-0.5 text-xs text-purple-700 font-mono">
                            Prob: {dimData.probability || 2} x Sev: {dimData.severity || 2} = Score {dimData.score || 4}
                          </span>
                          <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${getRiskBadge(dimData.category || "low").color}`}>
                            {dimData.categoryLabel || dimData.category || "Baixo"}
                          </span>
                        </div>
                      </div>
                      <div className="mt-2 text-xs text-[#4a4550] space-y-1">
                        <p><strong>Evidência Apurada:</strong> {dimData.explicit_evidence || dimData.findings || "Conforme relato do trabalhador."}</p>
                        <p><strong>Dedução Técnica:</strong> {dimData.implicit_inference || dimData.estimation_logic || "Análise de conformidade."}</p>
                        <p className="text-purple-700"><strong>Medida Recomendada:</strong> {dimData.mitigation_recommendation || "Monitoramento preventivo."}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Plano de Ação 5W2H */}
              {Array.isArray(selectedReport.actionPlan5w2h) && selectedReport.actionPlan5w2h.length > 0 && (
                <div>
                  <h4 className="font-bold text-[#260054] text-sm uppercase tracking-wider mb-3">
                    Plano de Ação 5W2H Recomendado ao PGR
                  </h4>
                  <div className="overflow-x-auto rounded-2xl border border-purple-100">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-purple-50 font-bold uppercase text-[#4a4550]">
                        <tr>
                          <th className="px-3 py-2">O Que (What)</th>
                          <th className="px-3 py-2">Por Que (Why)</th>
                          <th className="px-3 py-2">Quem (Who)</th>
                          <th className="px-3 py-2">Quando (When)</th>
                          <th className="px-3 py-2">Prioridade</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-purple-50">
                        {selectedReport.actionPlan5w2h.map((item, idx) => (
                          <tr key={idx} className="hover:bg-purple-50/30">
                            <td className="px-3 py-2 font-semibold text-[#260054]">{item.what}</td>
                            <td className="px-3 py-2 text-[#4a4550]">{item.why}</td>
                            <td className="px-3 py-2 text-[#4a4550]">{item.who}</td>
                            <td className="px-3 py-2 text-[#4a4550]">{item.when}</td>
                            <td className="px-3 py-2 font-bold text-purple-700">{item.priority || "Alta"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Laudo Pericial Narrativo Completo */}
              {selectedReport.fullNarrativeReport && (
                <div className="rounded-2xl border border-purple-200 bg-white p-5">
                  <h4 className="font-bold text-[#260054] text-xs uppercase tracking-wider mb-2">
                    Parecer Pericial Narrativo (Formatado para Auditoria Fiscal)
                  </h4>
                  <div className="whitespace-pre-wrap text-xs leading-relaxed text-[#4a4550] font-sans">
                    {selectedReport.fullNarrativeReport}
                  </div>
                </div>
              )}
            </div>

            {/* Rodapé do Modal */}
            <div className="flex items-center justify-between border-t border-purple-100 pt-4">
              <span className="text-xs text-[#4a4550]">
                Documento de SST em conformidade com a NR-01 e Portaria MTE nº 1.419/2024
              </span>
              <button
                type="button"
                onClick={() => setSelectedReport(null)}
                className="rounded-xl bg-[#3d1a6e] px-6 py-2.5 text-xs font-bold text-white hover:bg-[#2D1052]"
              >
                Fechar Laudo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
