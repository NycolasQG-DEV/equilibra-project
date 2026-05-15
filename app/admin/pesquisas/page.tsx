"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { authenticatedFetch } from "@/lib/api-client";
import { useAuth } from "@/hooks/useAuth";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { SurveyQuestion } from "@/types/database";

const inputClass =
  "w-full rounded-xl border border-purple-200 px-4 py-3 text-sm outline-none focus:border-[#6b538c] focus:ring-2 focus:ring-[#dabdfe] transition-all";
const labelClass = "text-xs font-bold uppercase tracking-wider text-[#4a4550]";

interface SurveyRow {
  id: string; title: string; description: string; questions: SurveyQuestion[];
  is_active: boolean; scheduled_at: string; ends_at: string | null;
  created_at: string; total_assigned: number; total_completed: number;
}

const DEFAULT_QUESTIONS: SurveyQuestion[] = [
  { id: 1, text: "Com que frequência você se sente sobrecarregado(a) no trabalho?", icon: "psychology",
    options: [{ label: "Nunca", value: 0 },{ label: "Raramente", value: 1 },{ label: "Às vezes", value: 2 },{ label: "Frequentemente", value: 3 },{ label: "Sempre", value: 4 }] },
  { id: 2, text: "Você sente que tem autonomia suficiente para realizar suas tarefas?", icon: "workspace_premium",
    options: [{ label: "Totalmente", value: 0 },{ label: "Na maioria das vezes", value: 1 },{ label: "Parcialmente", value: 2 },{ label: "Raramente", value: 3 },{ label: "Nunca", value: 4 }] },
  { id: 3, text: "Como você avalia o suporte emocional que recebe de colegas e gestores?", icon: "group",
    options: [{ label: "Excelente", value: 0 },{ label: "Bom", value: 1 },{ label: "Regular", value: 2 },{ label: "Insuficiente", value: 3 },{ label: "Inexistente", value: 4 }] },
  { id: 4, text: "Nos últimos 30 dias, dificuldade para dormir por preocupações com o trabalho?", icon: "bedtime",
    options: [{ label: "Nenhuma vez", value: 0 },{ label: "1-2 vezes", value: 1 },{ label: "1x/semana", value: 2 },{ label: "Várias vezes/semana", value: 3 },{ label: "Quase toda noite", value: 4 }] },
  { id: 5, text: "Você sente que seu trabalho é reconhecido e valorizado?", icon: "emoji_events",
    options: [{ label: "Sempre", value: 0 },{ label: "Na maioria", value: 1 },{ label: "Às vezes", value: 2 },{ label: "Raramente", value: 3 },{ label: "Nunca", value: 4 }] },
  { id: 6, text: "Como está seu nível geral de satisfação com o ambiente de trabalho?", icon: "sentiment_satisfied",
    options: [{ label: "Muito satisfeito", value: 0 },{ label: "Satisfeito", value: 1 },{ label: "Neutro", value: 2 },{ label: "Insatisfeito", value: 3 },{ label: "Muito insatisfeito", value: 4 }] },
];

function CreateSurveyModal({ adminId, onClose, onCreated }: {
  adminId: string; onClose: () => void; onCreated: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleCreate = async () => {
    setError("");
    if (!title.trim()) { setError("Informe o título."); return; }
    setLoading(true);
    try {
      const res = await authenticatedFetch("/api/admin/surveys", {
        method: "POST",
        body: JSON.stringify({ adminId, title: title.trim(), description: description.trim(), questions: DEFAULT_QUESTIONS, endsAt: endsAt || null }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Erro."); return; }
      onCreated(); onClose();
    } catch { setError("Erro de conexão."); } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-purple-200 bg-white p-8 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-[#260054]">Nova Pesquisa</h3>
            <p className="text-xs text-[#4a4550]">Será enviada a todos os colaboradores</p>
          </div>
          <button onClick={onClose} className="text-[#4a4550] hover:text-[#260054]" type="button">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <div className="space-y-4">
          <div className="space-y-1">
            <label className={labelClass}>Título *</label>
            <input className={inputClass} placeholder="Ex: Avaliação de Bem-estar Q2 2026" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className={labelClass}>Descrição</label>
            <textarea className={`${inputClass} resize-none`} rows={2} placeholder="Objetivo da pesquisa…" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className={labelClass}>Encerra em (opcional)</label>
            <input className={inputClass} type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
          </div>
          <div className="rounded-xl border border-purple-100 bg-purple-50/50 p-4 text-sm text-[#4a4550]">
            <p className="font-semibold text-[#260054] mb-2">📋 Questionário NR-1 Padrão (6 perguntas)</p>
            <ul className="space-y-1">
              {DEFAULT_QUESTIONS.map((q) => (
                <li key={q.id} className="flex items-start gap-2">
                  <span className="material-symbols-outlined text-sm text-[#6b538c] mt-0.5">{q.icon}</span>
                  <span className="text-xs">{q.text}</span>
                </li>
              ))}
            </ul>
          </div>
          {error && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}
          <button onClick={handleCreate} disabled={loading}
            className="w-full rounded-xl bg-[#3d1a6e] py-4 font-bold text-white hover:bg-[#2D1052] disabled:opacity-50 transition-all" type="button">
            {loading ? "Criando..." : "Criar e Enviar para Colaboradores"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PesquisasPage() {
  const router = useRouter();
  const { user, loading } = useAuth("admin");
  const [surveys, setSurveys] = useState<SurveyRow[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const fetchSurveys = useCallback(async () => {
    if (!user) return;
    setDataLoading(true);
    try {
      const res = await authenticatedFetch(`/api/admin/surveys?adminId=${user.id}`);
      const data = await res.json();
      if (res.ok) setSurveys(data.surveys ?? []);
    } catch { /* ignore */ }
    setDataLoading(false);
  }, [user]);

  useEffect(() => { fetchSurveys(); }, [fetchSurveys]);

  const toggleActive = async (s: SurveyRow) => {
    await authenticatedFetch(`/api/admin/surveys/${s.id}`, { method: "PATCH", body: JSON.stringify({ adminId: user?.id, is_active: !s.is_active }) });
    fetchSurveys();
  };

  const deleteSurvey = async (s: SurveyRow) => {
    if (!confirm(`Remover "${s.title}"?`)) return;
    await authenticatedFetch(`/api/admin/surveys/${s.id}`, { method: "DELETE", body: JSON.stringify({ adminId: user?.id }) });
    setToast("Pesquisa removida."); setTimeout(() => setToast(null), 3000); fetchSurveys();
  };

  if (loading) return <LoadingSpinner message="Verificando acesso..." />;

  const getBadge = (s: SurveyRow) => {
    if (!s.is_active) return { label: "Inativa", color: "bg-gray-100 text-gray-600", icon: "pause_circle" };
    if (s.ends_at && new Date(s.ends_at) < new Date()) return { label: "Encerrada", color: "bg-amber-100 text-amber-700", icon: "schedule" };
    return { label: "Ativa", color: "bg-emerald-100 text-emerald-700", icon: "check_circle" };
  };

  return (
    <div className="flex flex-col">
      <header className="flex items-center justify-between border-b border-purple-100 bg-white px-8 py-4 shadow-sm">
        <div>
          <h1 className="text-lg font-bold text-[#260054]">Pesquisas</h1>
          <p className="text-xs text-[#4a4550]">Agende e gerencie pesquisas NR-1</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 rounded-xl bg-[#3d1a6e] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#2D1052] transition-all" type="button">
            <span className="material-symbols-outlined text-lg">add_circle</span>Nova Pesquisa
          </button>
        </div>
      </header>

      <main className="flex-1 space-y-6 p-8">
        <div className="grid grid-cols-3 gap-5">
          {[
            { icon: "assignment", label: "Total de Pesquisas", value: surveys.length, gradient: "from-[#3d1a6e] to-[#260054]" },
            { icon: "check_circle", label: "Ativas agora", value: surveys.filter((s) => s.is_active).length, gradient: "from-[#6b538c] to-[#3d1a6e]" },
            { icon: "groups", label: "Respostas Recebidas", value: surveys.reduce((a, s) => a + s.total_completed, 0), gradient: "from-[#8b5cf6] to-[#6b538c]" },
          ].map((c) => (
            <div key={c.label} className={`rounded-2xl bg-gradient-to-br ${c.gradient} p-6 text-white shadow-lg`}>
              <span className="material-symbols-outlined text-3xl opacity-90">{c.icon}</span>
              <p className="mt-3 text-4xl font-bold">{c.value}</p>
              <p className="mt-1 text-sm opacity-70">{c.label}</p>
            </div>
          ))}
        </div>

        <div className="overflow-hidden rounded-2xl border border-purple-100 bg-white shadow-sm">
          <div className="border-b border-purple-100 px-6 py-5">
            <h2 className="font-bold text-[#260054]">Pesquisas Cadastradas</h2>
          </div>
          {dataLoading ? (
            <div className="flex items-center justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-4 border-purple-200 border-t-[#3d1a6e]" /></div>
          ) : surveys.length === 0 ? (
            <div className="py-20 text-center text-[#4a4550]">
              <span className="material-symbols-outlined text-5xl opacity-20">assignment</span>
              <p className="mt-3 text-sm">Nenhuma pesquisa criada.</p>
              <button onClick={() => setShowCreate(true)} className="mt-4 text-sm font-semibold text-[#3d1a6e] hover:underline" type="button">Criar primeira pesquisa →</button>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-purple-50 text-xs font-bold uppercase tracking-wider text-[#4a4550]">
                <tr>
                  <th className="px-6 py-3 text-left">Pesquisa</th>
                  <th className="px-6 py-3 text-left">Status</th>
                  <th className="px-6 py-3 text-left">Respostas</th>
                  <th className="px-6 py-3 text-left">Criada</th>
                  <th className="px-6 py-3 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-purple-50">
                {surveys.map((s) => { const b = getBadge(s); return (
                  <tr key={s.id} className="hover:bg-purple-50/40 transition-colors">
                    <td className="px-6 py-4"><p className="font-semibold text-[#260054]">{s.title}</p>{s.description && <p className="text-xs text-[#4a4550]">{s.description}</p>}</td>
                    <td className="px-6 py-4"><span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold ${b.color}`}><span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>{b.icon}</span>{b.label}</span></td>
                    <td className="px-6 py-4"><span className="font-semibold text-[#260054]">{s.total_completed}</span><span className="text-[#4a4550]"> / {s.total_assigned}</span></td>
                    <td className="px-6 py-4 text-[#4a4550]">{new Date(s.created_at).toLocaleDateString("pt-BR")}</td>
                    <td className="px-6 py-4"><div className="flex items-center justify-center gap-1">
                      <button onClick={() => toggleActive(s)} className={`rounded-lg p-2 transition-all ${s.is_active ? "text-amber-500 hover:bg-amber-50" : "text-emerald-500 hover:bg-emerald-50"}`} type="button" title={s.is_active ? "Desativar" : "Ativar"}><span className="material-symbols-outlined text-lg">{s.is_active ? "pause" : "play_arrow"}</span></button>
                      <button onClick={() => deleteSurvey(s)} className="rounded-lg p-2 text-red-400 hover:bg-red-50 hover:text-red-600 transition-all" type="button" title="Remover"><span className="material-symbols-outlined text-lg">delete</span></button>
                    </div></td>
                  </tr>
                ); })}
              </tbody>
            </table>
          )}
        </div>
      </main>

      {showCreate && user && <CreateSurveyModal adminId={user.id} onClose={() => setShowCreate(false)} onCreated={() => { fetchSurveys(); setToast("Pesquisa criada!"); setTimeout(() => setToast(null), 3500); }} />}
      {toast && <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-2xl bg-green-600 px-5 py-4 text-sm font-semibold text-white shadow-xl"><span className="material-symbols-outlined text-base">check_circle</span>{toast}</div>}
    </div>
  );
}
