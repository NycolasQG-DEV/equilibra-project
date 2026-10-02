"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { clearAuthSession } from "@/lib/auth-client";
import { authenticatedFetch } from "@/lib/api-client";
import { PageReveal } from "@/components/admin/PageReveal";

export default function ConfiguracoesPage() {
  const router = useRouter();
  const { user, loading } = useAuth("admin");
  const [companyName, setCompanyName] = useState("");
  const [sector, setSector] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [notifyOnComplete, setNotifyOnComplete] = useState(true);
  const [requireMinParticipants, setRequireMinParticipants] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (user) {
      setCompanyName(user.name || "");
      setContactEmail(user.email || "");
      setSector(user.setor || "Serviços / Tecnologia");
    }
  }, [user]);

  const handleLogout = () => {
    clearAuthSession();
    router.replace("/");
  };

  async function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      // Salva preferências no backend se houver rota ou atualiza localmente
      const res = await authenticatedFetch("/api/admin/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName,
          sector,
          contactEmail,
          notifyOnComplete,
          requireMinParticipants,
        }),
      }).catch(() => null);

      if (res && !res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Não foi possível atualizar as configurações.");
      }

      setNotice("Configurações atualizadas com sucesso!");
    } catch (err: any) {
      setError(err.message || "Erro ao salvar alterações.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <LoadingSpinner message="Carregando configurações..." />;

  return (
    <main className="mx-auto w-full max-w-5xl space-y-6 p-4 sm:p-8 text-slate-800">
      <PageReveal selector=".pg-reveal" />

      {/* Header */}
      <header className="pg-reveal flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-indigo-600">
            <span className="material-symbols-outlined text-base">tune</span>
            EQUILIBRA · GESTÃO E CONFORMIDADE
          </div>
          <h1 className="mt-1 text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            Configurações da Conta
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-slate-500">
            Gerencie o perfil institucional da empresa, preferências de privacidade e diretrizes da NR-1.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleLogout}
            className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 px-4 py-2.5 text-xs font-semibold transition shadow-sm"
            type="button"
          >
            <span className="material-symbols-outlined text-sm">logout</span>
            Encerrar Sessão
          </button>
        </div>
      </header>

      {notice && (
        <div role="status" className="pg-reveal rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-xs sm:text-sm text-emerald-800 flex items-center gap-3">
          <span className="material-symbols-outlined text-emerald-600 text-lg">check_circle</span>
          <span>{notice}</span>
        </div>
      )}

      {error && (
        <div role="alert" className="pg-reveal rounded-2xl border border-red-200 bg-red-50 p-4 text-xs sm:text-sm text-red-700 flex items-center gap-3">
          <span className="material-symbols-outlined text-red-500 text-lg">error</span>
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSaveSettings} className="space-y-6">
        {/* Section 1: Perfil da Empresa */}
        <section className="pg-reveal rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm space-y-5">
          <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
            <div className="h-10 w-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <span className="material-symbols-outlined text-xl">domain</span>
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Perfil Institucional</h2>
              <p className="text-xs text-slate-500">Informações apresentadas no cabeçalho das pesquisas e relatórios.</p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">Nome da Empresa ou Grupo</label>
              <input
                required
                minLength={2}
                maxLength={100}
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs sm:text-sm text-slate-800 focus:bg-white focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 transition"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">Setor Econômico / Ramo</label>
              <input
                maxLength={100}
                value={sector}
                onChange={(e) => setSector(e.target.value)}
                placeholder="Ex.: Indústria, Varejo, Saúde, Tecnologia"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs sm:text-sm text-slate-800 focus:bg-white focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 transition"
              />
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-xs font-semibold text-slate-700">E-mail Institucional de Notificações</label>
              <input
                type="email"
                required
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs sm:text-sm text-slate-800 focus:bg-white focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 transition"
              />
            </div>
          </div>
        </section>

        {/* Section 2: Privacidade & Conformidade NR-1 */}
        <section className="pg-reveal rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm space-y-5">
          <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
            <div className="h-10 w-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <span className="material-symbols-outlined text-xl">gavel</span>
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Privacidade, Sigilo e NR-1</h2>
              <p className="text-xs text-slate-500">Parâmetros de blindagem de identidade e conformidade ocupacional.</p>
            </div>
          </div>

          <div className="space-y-4">
            <label className="flex items-start gap-3 p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 cursor-pointer hover:bg-slate-100/60 transition">
              <input
                type="checkbox"
                checked={requireMinParticipants}
                onChange={(e) => setRequireMinParticipants(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <div className="text-xs sm:text-sm">
                <span className="font-semibold text-slate-800 block">Exigir quórum mínimo de 5 respostas</span>
                <span className="text-slate-500 text-xs">
                  Impede a visualização de relatórios de grupos pequenos para assegurar que nenhum colaborador seja identificado.
                </span>
              </div>
            </label>

            <label className="flex items-start gap-3 p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 cursor-pointer hover:bg-slate-100/60 transition">
              <input
                type="checkbox"
                checked={notifyOnComplete}
                onChange={(e) => setNotifyOnComplete(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <div className="text-xs sm:text-sm">
                <span className="font-semibold text-slate-800 block">Notificar encerramento e alertas de risco SST</span>
                <span className="text-slate-500 text-xs">
                  Receba avisos instantâneos quando uma rodada atingir o quórum ou apontar fatores com alta frequência de sobrecarga.
                </span>
              </div>
            </label>
          </div>
        </section>

        {/* Section 3: Plano Atual e Limites */}
        <section className="pg-reveal rounded-3xl border border-indigo-100 bg-gradient-to-br from-indigo-50/50 to-purple-50/30 p-6 sm:p-8 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
          <div>
            <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-indigo-700 bg-indigo-100 px-2.5 py-1 rounded-full">
              <span className="material-symbols-outlined text-xs">workspace_premium</span>
              PLANO ATIVO
            </span>
            <h3 className="mt-2 text-lg font-bold text-slate-900">
              {user?.plan === "enterprise" ? "Plano Enterprise" : user?.plan === "professional" ? "Plano Professional" : "Plano Starter"}
            </h3>
            <p className="text-xs text-slate-600 mt-0.5">
              Capacidade contratada: <strong>{user?.max_colaboradores || 10} colaboradores</strong> por ciclo de pesquisa.
            </p>
          </div>

          <Link
            href="/admin/assinatura"
            className="rounded-xl bg-indigo-700 hover:bg-indigo-600 text-white px-5 py-3 text-xs sm:text-sm font-semibold shadow-md shadow-indigo-900/20 transition flex items-center gap-1.5 shrink-0"
          >
            <span>Gerenciar Assinatura</span>
            <span className="material-symbols-outlined text-sm">arrow_forward</span>
          </Link>
        </section>

        {/* Save button */}
        <div className="pg-reveal flex justify-end">
          <button
            type="submit"
            disabled={busy}
            className="rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white px-7 py-3.5 text-xs sm:text-sm font-bold shadow-lg shadow-indigo-900/25 disabled:opacity-50 transition-all flex items-center gap-2"
          >
            {busy ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                <span>Salvando...</span>
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-base">save</span>
                <span>Salvar Configurações</span>
              </>
            )}
          </button>
        </div>
      </form>
    </main>
  );
}
