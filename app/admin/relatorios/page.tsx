"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

interface ResponseRow { id: string; score: number; risk_level: string; created_at: string; user_id: string; survey_id?: string; }
interface UserRow { id: string; setor?: string; cargo?: string; }

export default function RelatoriosPage() {
  const { user, loading } = useAuth("admin");
  const [responses, setResponses] = useState<ResponseRow[]>([]);
  const [colabs, setColabs] = useState<UserRow[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      const [{ data: r }, { data: c }] = await Promise.all([
        supabase.from("responses").select("id, score, risk_level, created_at, user_id, survey_id").eq("admin_id", user.id).order("created_at", { ascending: false }),
        supabase.from("users").select("id, setor, cargo").eq("admin_id", user.id),
      ]);
      setResponses((r ?? []) as ResponseRow[]);
      setColabs((c ?? []) as UserRow[]);
      setDataLoading(false);
    };
    fetch();
  }, [user]);

  if (loading) return <LoadingSpinner message="Verificando acesso..." />;

  const total = responses.length;
  const baixo = responses.filter((r) => r.risk_level === "baixo").length;
  const medio = responses.filter((r) => r.risk_level === "medio").length;
  const alto = responses.filter((r) => r.risk_level === "alto").length;
  const avgScore = total > 0 ? (responses.reduce((a, r) => a + r.score, 0) / total).toFixed(1) : "0";
  const responseRate = colabs.length > 0 ? Math.round((new Set(responses.map((r) => r.user_id)).size / colabs.length) * 100) : 0;
  const altoPercent = total > 0 ? Math.round((alto / total) * 100) : 0;

  // Risk by sector
  const sectorMap: Record<string, { total: number; alto: number; scores: number[] }> = {};
  responses.forEach((r) => {
    const colab = colabs.find((c) => c.id === r.user_id);
    const setor = colab?.setor || "Não definido";
    if (!sectorMap[setor]) sectorMap[setor] = { total: 0, alto: 0, scores: [] };
    sectorMap[setor].total++;
    sectorMap[setor].scores.push(r.score);
    if (r.risk_level === "alto") sectorMap[setor].alto++;
  });
  const sectors = Object.entries(sectorMap).sort((a, b) => b[1].alto - a[1].alto);

  // NR-1 Compliance
  const isCompliant = altoPercent < 30 && responseRate >= 70;
  const alerts: { text: string; level: "critical" | "warning" | "ok" }[] = [];
  if (altoPercent >= 30) alerts.push({ text: `${altoPercent}% dos colaboradores em risco alto — intervenção necessária`, level: "critical" });
  else if (altoPercent >= 15) alerts.push({ text: `${altoPercent}% em risco alto — monitorar de perto`, level: "warning" });
  else alerts.push({ text: `Risco alto sob controle (${altoPercent}%)`, level: "ok" });
  if (responseRate < 50) alerts.push({ text: `Taxa de resposta baixa (${responseRate}%) — engajar colaboradores`, level: "critical" });
  else if (responseRate < 70) alerts.push({ text: `Taxa de resposta moderada (${responseRate}%)`, level: "warning" });
  else alerts.push({ text: `Boa taxa de resposta (${responseRate}%)`, level: "ok" });

  const alertColors = { critical: "border-red-200 bg-red-50 text-red-700", warning: "border-amber-200 bg-amber-50 text-amber-700", ok: "border-emerald-200 bg-emerald-50 text-emerald-700" };
  const alertIcons = { critical: "error", warning: "warning", ok: "check_circle" };

  const barMax = Math.max(baixo, medio, alto, 1);

  return (
    <div className="flex flex-col">
      <header className="flex items-center justify-between border-b border-purple-100 bg-white px-8 py-4 shadow-sm">
        <div>
          <h1 className="text-lg font-bold text-[#260054]">Relatórios NR-1</h1>
          <p className="text-xs text-[#4a4550]">Insights de risco psicossocial e conformidade</p>
        </div>
      </header>

      <main className="flex-1 space-y-6 p-8">
        {dataLoading ? (
          <div className="flex items-center justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-4 border-purple-200 border-t-[#3d1a6e]" /></div>
        ) : total === 0 ? (
          <div className="py-20 text-center text-[#4a4550]">
            <span className="material-symbols-outlined text-5xl opacity-20">bar_chart</span>
            <p className="mt-3 text-sm">Nenhuma resposta registrada. Crie e envie uma pesquisa para ver insights.</p>
          </div>
        ) : (
          <>
            {/* NR-1 Compliance Banner */}
            <div className={`flex items-center gap-4 rounded-2xl border-2 p-6 ${isCompliant ? "border-emerald-300 bg-emerald-50" : "border-red-300 bg-red-50"}`}>
              <div className={`flex h-14 w-14 items-center justify-center rounded-2xl ${isCompliant ? "bg-emerald-200 text-emerald-700" : "bg-red-200 text-red-700"}`}>
                <span className="material-symbols-outlined text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>{isCompliant ? "verified" : "gpp_maybe"}</span>
              </div>
              <div>
                <h2 className={`text-lg font-bold ${isCompliant ? "text-emerald-800" : "text-red-800"}`}>{isCompliant ? "Conforme NR-1" : "Atenção — Pontos de Risco Identificados"}</h2>
                <p className={`text-sm ${isCompliant ? "text-emerald-700" : "text-red-700"}`}>{isCompliant ? "Seus indicadores estão dentro dos parâmetros aceitáveis." : "Indicadores acima do limite recomendado. Ação necessária."}</p>
              </div>
            </div>

            {/* Stat Cards */}
            <div className="grid grid-cols-2 gap-5 lg:grid-cols-4">
              {[
                { icon: "groups", label: "Respostas", value: total, sub: `${responseRate}% taxa de resposta`, gradient: "from-[#3d1a6e] to-[#260054]" },
                { icon: "speed", label: "Score Médio", value: avgScore, sub: "de 24 pontos max", gradient: "from-[#6b538c] to-[#3d1a6e]" },
                { icon: "warning", label: "Risco Alto", value: alto, sub: `${altoPercent}% do total`, gradient: alto > 0 ? "from-red-600 to-red-800" : "from-[#8b5cf6] to-[#6b538c]" },
                { icon: "trending_down", label: "Risco Baixo", value: baixo, sub: `${total > 0 ? Math.round((baixo / total) * 100) : 0}% do total`, gradient: "from-emerald-600 to-emerald-800" },
              ].map((c) => (
                <div key={c.label} className={`relative overflow-hidden rounded-2xl p-6 text-white shadow-lg bg-gradient-to-br ${c.gradient}`}>
                  <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-white/10" />
                  <span className="material-symbols-outlined text-3xl opacity-90">{c.icon}</span>
                  <p className="mt-3 text-4xl font-bold tracking-tight">{c.value}</p>
                  <p className="mt-1 text-sm font-semibold opacity-80">{c.label}</p>
                  <p className="mt-1 text-xs opacity-60">{c.sub}</p>
                </div>
              ))}
            </div>

            {/* Alerts */}
            <div className="space-y-3">
              <h2 className="font-bold text-[#260054]">Alertas de Conformidade</h2>
              {alerts.map((a, i) => (
                <div key={i} className={`flex items-center gap-3 rounded-2xl border p-4 ${alertColors[a.level]}`}>
                  <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>{alertIcons[a.level]}</span>
                  <p className="text-sm font-semibold">{a.text}</p>
                </div>
              ))}
            </div>

            {/* Risk Distribution Bar Chart */}
            <div className="rounded-2xl border border-purple-100 bg-white p-6 shadow-sm">
              <h2 className="mb-6 font-bold text-[#260054]">Distribuição de Risco</h2>
              <div className="space-y-4">
                {[
                  { label: "Baixo", count: baixo, color: "bg-emerald-500", pct: total > 0 ? Math.round((baixo / total) * 100) : 0 },
                  { label: "Médio", count: medio, color: "bg-amber-500", pct: total > 0 ? Math.round((medio / total) * 100) : 0 },
                  { label: "Alto", count: alto, color: "bg-red-500", pct: total > 0 ? Math.round((alto / total) * 100) : 0 },
                ].map((b) => (
                  <div key={b.label} className="flex items-center gap-4">
                    <span className="w-16 text-sm font-semibold text-[#260054]">{b.label}</span>
                    <div className="flex-1 h-8 rounded-full bg-purple-50 overflow-hidden">
                      <div className={`h-full rounded-full ${b.color} transition-all duration-700`} style={{ width: `${(b.count / barMax) * 100}%` }} />
                    </div>
                    <span className="w-20 text-right text-sm font-bold text-[#260054]">{b.count} ({b.pct}%)</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Risk by Sector */}
            {sectors.length > 0 && (
              <div className="rounded-2xl border border-purple-100 bg-white shadow-sm">
                <div className="border-b border-purple-100 px-6 py-5">
                  <h2 className="font-bold text-[#260054]">Risco por Setor</h2>
                  <p className="text-xs text-[#4a4550]">Setores com maior concentração de risco</p>
                </div>
                <table className="w-full text-sm">
                  <thead className="bg-purple-50 text-xs font-bold uppercase tracking-wider text-[#4a4550]">
                    <tr>
                      <th className="px-6 py-3 text-left">Setor</th>
                      <th className="px-6 py-3 text-left">Respostas</th>
                      <th className="px-6 py-3 text-left">Risco Alto</th>
                      <th className="px-6 py-3 text-left">Score Médio</th>
                      <th className="px-6 py-3 text-left">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-purple-50">
                    {sectors.map(([setor, data]) => {
                      const avg = (data.scores.reduce((a, b) => a + b, 0) / data.scores.length).toFixed(1);
                      const pct = Math.round((data.alto / data.total) * 100);
                      return (
                        <tr key={setor} className="hover:bg-purple-50/40 transition-colors">
                          <td className="px-6 py-4 font-semibold text-[#260054]">{setor}</td>
                          <td className="px-6 py-4 text-[#4a4550]">{data.total}</td>
                          <td className="px-6 py-4"><span className={`font-bold ${data.alto > 0 ? "text-red-600" : "text-emerald-600"}`}>{data.alto}</span></td>
                          <td className="px-6 py-4 text-[#4a4550]">{avg}</td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${pct >= 30 ? "bg-red-100 text-red-700" : pct >= 15 ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>
                              {pct >= 30 ? "Crítico" : pct >= 15 ? "Atenção" : "Saudável"}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Recommendations */}
            <div className="rounded-2xl border border-purple-100 bg-white p-6 shadow-sm">
              <h2 className="mb-4 font-bold text-[#260054]">Recomendações</h2>
              <div className="space-y-3">
                {alto > 0 && (
                  <div className="flex items-start gap-3 rounded-xl bg-red-50 p-4">
                    <span className="material-symbols-outlined text-red-600 mt-0.5">priority_high</span>
                    <div><p className="text-sm font-semibold text-red-800">Intervenção imediata</p><p className="text-xs text-red-700">{alto} colaborador(es) em risco alto. Considere encaminhamento para apoio psicológico e revisão de carga de trabalho.</p></div>
                  </div>
                )}
                {sectors.filter(([, d]) => Math.round((d.alto / d.total) * 100) >= 30).map(([setor]) => (
                  <div key={setor} className="flex items-start gap-3 rounded-xl bg-amber-50 p-4">
                    <span className="material-symbols-outlined text-amber-600 mt-0.5">warning</span>
                    <div><p className="text-sm font-semibold text-amber-800">Setor {setor} precisa de atenção</p><p className="text-xs text-amber-700">Concentração de risco alto acima de 30%. Avaliar condições de trabalho e gestão neste setor.</p></div>
                  </div>
                ))}
                {responseRate < 70 && (
                  <div className="flex items-start gap-3 rounded-xl bg-blue-50 p-4">
                    <span className="material-symbols-outlined text-blue-600 mt-0.5">campaign</span>
                    <div><p className="text-sm font-semibold text-blue-800">Aumentar engajamento</p><p className="text-xs text-blue-700">Apenas {responseRate}% dos colaboradores responderam. Envie lembretes e reforce a confidencialidade.</p></div>
                  </div>
                )}
                <div className="flex items-start gap-3 rounded-xl bg-purple-50 p-4">
                  <span className="material-symbols-outlined text-[#3d1a6e] mt-0.5">lightbulb</span>
                  <div><p className="text-sm font-semibold text-[#260054]">Acompanhamento contínuo</p><p className="text-xs text-[#4a4550]">Agende pesquisas regulares (mensal/trimestral) para acompanhar a evolução dos indicadores NR-1.</p></div>
                </div>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
