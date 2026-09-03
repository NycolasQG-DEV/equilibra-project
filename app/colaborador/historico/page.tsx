"use client";

import { useEffect, useState } from "react";
import { Response as SurveyResponse } from "@/types/database";
import { authenticatedFetch } from "@/lib/api-client";

type Tab = "pesquisas" | "conversas";

export default function HistoricoPage() {
  const [tab, setTab] = useState<Tab>("pesquisas");
  const [responses, setResponses] = useState<SurveyResponse[]>([]);
  const [sessions, setSessions] = useState<{ session_id: string; count: number; last: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const loadHistory = async () => {
    try {
      const res = await authenticatedFetch("/api/colaborador/history");
      if (res.ok) {
        const data = await res.json();
        setResponses(data.responses || []);
        setSessions(data.sessions || []);
      }
    } catch (err) {
      console.error("Erro ao carregar histórico:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const deleteSession = async (sessionId: string) => {
    try {
      const res = await authenticatedFetch("/api/colaborador/history", {
        method: "DELETE",
        body: JSON.stringify({ sessionId }),
      });
      if (res.ok) {
        setSessions((prev) => prev.filter((s) => s.session_id !== sessionId));
        setDeleteTarget(null);
        setToast("Conversa removida do seu histórico.");
        setTimeout(() => setToast(null), 4000);
      }
    } catch {
      setToast("Erro ao remover conversa.");
      setTimeout(() => setToast(null), 4000);
    }
  };

  const riskBadge = (level: string) => {
    const map: Record<string, { color: string; label: string }> = {
      baixo: { color: "bg-green-100 text-green-700", label: "Baixo" },
      medio: { color: "bg-amber-100 text-amber-700", label: "Médio" },
      alto: { color: "bg-red-100 text-red-700", label: "Alto" },
    };
    const r = map[level] || map.baixo;
    return <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${r.color}`}>{r.label}</span>;
  };

  if (loading) {
    return (
      <main className="flex flex-1 items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-purple-200 border-t-[#3d1a6e]" />
      </main>
    );
  }

  return (
    <main className="flex-1 p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#260054]">Histórico</h1>
        <p className="text-sm text-[#4a4550]">Suas pesquisas anteriores e conversas com a IA</p>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-2">
        {([["pesquisas", "assignment", "Pesquisas"], ["conversas", "chat", "Conversas"]] as const).map(([key, icon, label]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold transition-all ${tab === key ? "bg-[#3d1a6e] text-white shadow" : "border border-purple-200 bg-white text-[#4a4550] hover:bg-purple-50"}`} type="button">
            <span className="material-symbols-outlined text-lg">{icon}</span>{label}
            <span className={`rounded-full px-2 py-0.5 text-xs ${tab === key ? "bg-white/20" : "bg-purple-100"}`}>
              {key === "pesquisas" ? responses.length : sessions.length}
            </span>
          </button>
        ))}
      </div>

      {/* Pesquisas Tab */}
      {tab === "pesquisas" && (
        responses.length === 0 ? (
          <div className="py-20 text-center text-[#4a4550]">
            <span className="material-symbols-outlined text-5xl opacity-20">assignment</span>
            <p className="mt-3 text-sm">Nenhuma pesquisa respondida ainda.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {responses.map((r) => (
              <div key={r.id} className="flex items-center justify-between rounded-2xl border border-purple-100 bg-white p-5 shadow-sm">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-100 text-[#3d1a6e]">
                    <span className="material-symbols-outlined text-2xl">assignment_turned_in</span>
                  </div>
                  <div>
                    <p className="font-semibold text-[#260054]">{r.surveys?.title || "Questionário"}</p>
                    <p className="text-xs text-[#4a4550]">{new Date(r.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-sm font-semibold text-[#260054]">Score: {r.score}</p>
                  </div>
                  {riskBadge(r.risk_level)}
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* Conversas Tab */}
      {tab === "conversas" && (
        sessions.length === 0 ? (
          <div className="py-20 text-center text-[#4a4550]">
            <span className="material-symbols-outlined text-5xl opacity-20">chat</span>
            <p className="mt-3 text-sm">Nenhuma conversa registrada.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {sessions.map((s) => (
              <div key={s.session_id} className="flex items-center justify-between rounded-2xl border border-purple-100 bg-white p-5 shadow-sm">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-100 text-[#3d1a6e]">
                    <span className="material-symbols-outlined text-2xl">psychology</span>
                  </div>
                  <div>
                    <p className="font-semibold text-[#260054]">Conversa com IA</p>
                    <p className="text-xs text-[#4a4550]">{new Date(s.last).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })} • {s.count} mensagens</p>
                  </div>
                </div>
                <button onClick={() => setDeleteTarget(s.session_id)}
                  className="rounded-lg p-2 text-red-400 hover:bg-red-50 hover:text-red-600 transition-all" type="button" title="Apagar conversa">
                  <span className="material-symbols-outlined text-lg">delete</span>
                </button>
              </div>
            ))}
          </div>
        )
      )}

      {/* Delete Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setDeleteTarget(null)}>
          <div className="w-full max-w-sm rounded-2xl border border-red-200 bg-white p-8 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-100 text-red-600 mx-auto">
              <span className="material-symbols-outlined text-3xl">delete_forever</span>
            </div>
            <h3 className="text-center text-lg font-bold text-[#260054]">Apagar Conversa</h3>
            <p className="mt-2 text-center text-sm text-[#4a4550]">As mensagens serão removidas do seu histórico.</p>
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              <div className="flex items-start gap-2">
                <span className="material-symbols-outlined text-base mt-0.5">info</span>
                <p><strong>Importante:</strong> Os dados extraídos da pesquisa (indicadores, scores) permanecerão armazenados para fins de análise organizacional, conforme LGPD.</p>
              </div>
            </div>
            <div className="mt-6 flex gap-3">
              <button onClick={() => setDeleteTarget(null)} className="flex-1 rounded-xl border border-purple-200 py-3 font-semibold text-[#4a4550] hover:bg-purple-50 transition-all" type="button">Cancelar</button>
              <button onClick={() => deleteSession(deleteTarget)} className="flex-1 rounded-xl bg-red-600 py-3 font-bold text-white hover:bg-red-700 transition-all" type="button">Apagar</button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-2xl bg-green-600 px-5 py-4 text-sm font-semibold text-white shadow-xl">
          <span className="material-symbols-outlined text-base">check_circle</span>{toast}
        </div>
      )}
    </main>
  );
}
