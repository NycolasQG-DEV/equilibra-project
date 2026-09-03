"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { authenticatedFetch } from "@/lib/api-client";
import { useAuth } from "@/hooks/useAuth";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { Subscription, PLAN_NAMES } from "@/types/database";

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  active: { label: "Ativa", color: "bg-emerald-100 text-emerald-700", icon: "check_circle" },
  cancelled: { label: "Cancelada", color: "bg-red-100 text-red-700", icon: "cancel" },
  expired: { label: "Expirada", color: "bg-amber-100 text-amber-700", icon: "schedule" },
};

function formatBRL(cents: number) { return `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`; }

function daysRemaining(expiresAt: string): number {
  const diff = new Date(expiresAt).getTime() - new Date().getTime();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
}

/* ─── Cancel Modal ─── */
function CancelModal({ sub, userId, onClose, onCancelled }: {
  sub: Subscription; userId: string; onClose: () => void; onCancelled: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleCancel = async () => {
    setLoading(true); setError("");
    try {
      const res = await authenticatedFetch("/api/admin/cancel-subscription", {
        method: "POST",
        body: JSON.stringify({ userId, subscriptionId: sub.id }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Erro ao cancelar."); return; }
      onCancelled(); onClose();
    } catch { setError("Erro de conexão."); } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl border border-red-200 bg-white p-8 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-100 text-red-600 mx-auto">
          <span className="material-symbols-outlined text-3xl">credit_card_off</span>
        </div>
        <h3 className="text-center text-lg font-bold text-[#260054]">Cancelar Assinatura</h3>
        <p className="mt-2 text-center text-sm text-[#4a4550]">
          Tem certeza que deseja cancelar o plano <strong>{PLAN_NAMES[sub.plan]}</strong>?
          Você perderá acesso aos recursos e seus colaboradores ficarão sem acesso.
        </p>
        {error && <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}
        <div className="mt-6 flex gap-3">
          <button onClick={onClose} className="flex-1 rounded-xl border border-purple-200 py-3 font-semibold text-[#4a4550] hover:bg-purple-50 transition-all" type="button">Manter plano</button>
          <button onClick={handleCancel} disabled={loading} className="flex-1 rounded-xl bg-red-600 py-3 font-bold text-white hover:bg-red-700 disabled:opacity-50 transition-all" type="button">
            {loading ? "Cancelando..." : "Cancelar"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Main Page ─── */
export default function AssinaturaPage() {
  const router = useRouter();
  const { user, loading } = useAuth("admin");
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [cancelTarget, setCancelTarget] = useState<Subscription | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const fetchSubs = useCallback(async () => {
    if (!user) return;
    setDataLoading(true);
    try {
      const res = await authenticatedFetch(`/api/admin/subscriptions?userId=${user.id}`);
      if (res.ok) {
        const data = await res.json();
        setSubs(data.subscriptions || []);
      }
    } catch (err) {
      console.error("Erro ao buscar assinaturas:", err);
    } finally {
      setDataLoading(false);
    }
  }, [user]);

  useEffect(() => { fetchSubs(); }, [fetchSubs]);

  const activeSub = subs.find((s) => s.status === "active");
  const pastSubs = subs.filter((s) => s.status !== "active");
  const days = activeSub ? daysRemaining(activeSub.expires_at) : 0;
  const progressPct = activeSub ? Math.max(0, Math.min(100, (days / 30) * 100)) : 0;

  if (loading) return <LoadingSpinner message="Verificando acesso..." />;

  return (
    <div className="flex flex-col">
      <header className="flex items-center justify-between border-b border-purple-100 bg-white px-8 py-4 shadow-sm">
        <div>
          <h1 className="text-lg font-bold text-[#260054]">Assinatura</h1>
          <p className="text-xs text-[#4a4550]">Gerencie seu plano e pagamento</p>
        </div>
      </header>

      <main className="flex-1 space-y-6 p-8">
        {dataLoading ? (
          <div className="flex items-center justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-4 border-purple-200 border-t-[#3d1a6e]" /></div>
        ) : !activeSub && pastSubs.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-6 py-20 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-purple-100">
              <span className="material-symbols-outlined text-4xl text-[#3d1a6e]">credit_card_off</span>
            </div>
            <div>
              <h2 className="text-xl font-bold text-[#260054]">Nenhuma assinatura ativa</h2>
              <p className="mt-1 text-sm text-[#4a4550]">Escolha um plano e pague via PIX para começar.</p>
            </div>
            <button onClick={() => router.push("/planos")} className="rounded-xl bg-[#3d1a6e] px-8 py-3 font-bold text-white hover:bg-[#2D1052] transition-all" type="button">
              Ver planos disponíveis
            </button>
          </div>
        ) : (
          <>
            {/* Active Plan */}
            {activeSub && (
              <div className="grid gap-6 lg:grid-cols-3">
                <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#3d1a6e] to-[#1a0740] p-6 text-white shadow-xl lg:col-span-2">
                  <div className="absolute -right-8 -top-8 h-40 w-40 rounded-full bg-white/5" />
                  <div className="absolute -bottom-12 -right-4 h-28 w-28 rounded-full bg-white/5" />
                  <div className="relative">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-medium text-white/60">Plano atual</p>
                        <h2 className="mt-1 text-3xl font-bold">{PLAN_NAMES[activeSub.plan]}</h2>
                        <p className="mt-2 text-2xl font-bold text-white/90">{formatBRL(activeSub.price_brl)}<span className="text-sm font-normal text-white/50">/mês</span></p>
                      </div>
                      <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold ${STATUS_CONFIG[activeSub.status].color}`}>
                        <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>{STATUS_CONFIG[activeSub.status].icon}</span>
                        {STATUS_CONFIG[activeSub.status].label}
                      </span>
                    </div>
                    <div className="mt-6 grid grid-cols-2 gap-4">
                      <div className="rounded-xl bg-white/10 px-4 py-3">
                        <p className="text-xs text-white/50">Início</p>
                        <p className="mt-1 text-sm font-semibold">{formatDate(activeSub.started_at)}</p>
                      </div>
                      <div className="rounded-xl bg-white/10 px-4 py-3">
                        <p className="text-xs text-white/50">Vencimento</p>
                        <p className="mt-1 text-sm font-semibold">{formatDate(activeSub.expires_at)}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col justify-center rounded-2xl border border-purple-200 bg-white p-6 shadow-sm">
                  <p className="text-xs font-bold uppercase tracking-wider text-[#4a4550]">Dias restantes</p>
                  <p className="mt-2 text-5xl font-bold text-[#260054]">{days}</p>
                  <div className="mt-3 h-3 w-full overflow-hidden rounded-full bg-purple-100">
                    <div className={`h-full rounded-full transition-all ${days <= 5 ? "bg-red-500" : days <= 10 ? "bg-amber-500" : "bg-gradient-to-r from-[#3d1a6e] to-[#6b538c]"}`} style={{ width: `${progressPct}%` }} />
                  </div>
                  <p className="mt-2 text-xs text-[#4a4550]">
                    {days <= 0 ? "Assinatura expirada" : days <= 5 ? "Renove em breve!" : `Próxima cobrança em ${days} dias`}
                  </p>
                </div>
              </div>
            )}

            {/* Payment Method + Actions */}
            {activeSub && (
              <div className="grid gap-6 lg:grid-cols-2">
                <div className="rounded-2xl border border-purple-200 bg-white p-6 shadow-sm">
                  <div className="flex items-center gap-3 mb-5">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-100 text-[#3d1a6e]">
                      <span className="material-symbols-outlined">account_balance</span>
                    </div>
                    <div>
                      <h3 className="font-bold text-[#260054]">Método de Pagamento</h3>
                      <p className="text-xs text-[#4a4550]">Forma de pagamento utilizada</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 rounded-xl border border-purple-100 bg-purple-50/50 px-5 py-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-white shadow-sm text-[#3d1a6e]">
                      <span className="material-symbols-outlined text-2xl">pix</span>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-[#260054]">{activeSub.payment_method}</p>
                      <p className="text-xs text-[#4a4550]">Pagamento instantâneo</p>
                    </div>
                    <span className="material-symbols-outlined text-emerald-500" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
                  </div>
                </div>

                <div className="rounded-2xl border border-purple-200 bg-white p-6 shadow-sm">
                  <div className="flex items-center gap-3 mb-5">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-100 text-[#3d1a6e]">
                      <span className="material-symbols-outlined">tune</span>
                    </div>
                    <div>
                      <h3 className="font-bold text-[#260054]">Ações</h3>
                      <p className="text-xs text-[#4a4550]">Gerencie sua assinatura</p>
                    </div>
                  </div>
                  <button onClick={() => setCancelTarget(activeSub)}
                    className="flex w-full items-center gap-3 rounded-xl border border-red-200 px-5 py-4 text-sm font-semibold text-red-600 hover:bg-red-50 transition-all" type="button">
                    <span className="material-symbols-outlined text-lg">cancel</span>Cancelar assinatura
                  </button>
                </div>
              </div>
            )}

            {/* Past subs */}
            {pastSubs.length > 0 && (
              <div className="rounded-2xl border border-purple-100 bg-white shadow-sm">
                <div className="border-b border-purple-100 px-6 py-5">
                  <h3 className="font-bold text-[#260054]">Histórico de Assinaturas</h3>
                </div>
                <table className="w-full text-sm">
                  <thead className="bg-purple-50 text-xs font-bold uppercase tracking-wider text-[#4a4550]">
                    <tr>
                      <th className="px-6 py-3 text-left">Plano</th>
                      <th className="px-6 py-3 text-left">Valor</th>
                      <th className="px-6 py-3 text-left">Período</th>
                      <th className="px-6 py-3 text-left">Pagamento</th>
                      <th className="px-6 py-3 text-left">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-purple-50">
                    {pastSubs.map((s) => (
                      <tr key={s.id} className="hover:bg-purple-50/40 transition-colors">
                        <td className="px-6 py-4 font-semibold text-[#260054]">{PLAN_NAMES[s.plan]}</td>
                        <td className="px-6 py-4 text-[#4a4550]">{formatBRL(s.price_brl)}</td>
                        <td className="px-6 py-4 text-[#4a4550]">{formatDate(s.started_at)} — {formatDate(s.expires_at)}</td>
                        <td className="px-6 py-4 text-[#4a4550]">{s.payment_method}</td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold ${STATUS_CONFIG[s.status]?.color || "bg-gray-100 text-gray-600"}`}>
                            {STATUS_CONFIG[s.status]?.label || s.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {!activeSub && pastSubs.length > 0 && (
              <div className="flex flex-col items-center gap-4 rounded-2xl border-2 border-dashed border-purple-300 bg-purple-50/50 py-10 text-center">
                <span className="material-symbols-outlined text-4xl text-[#6b538c]">restart_alt</span>
                <div>
                  <h3 className="font-bold text-[#260054]">Reative sua assinatura</h3>
                  <p className="mt-1 text-sm text-[#4a4550]">Escolha um novo plano e pague via PIX.</p>
                </div>
                <button onClick={() => router.push("/planos")} className="rounded-xl bg-[#3d1a6e] px-8 py-3 font-bold text-white hover:bg-[#2D1052] transition-all" type="button">Ver planos</button>
              </div>
            )}
          </>
        )}
      </main>

      {cancelTarget && user && (
        <CancelModal sub={cancelTarget} userId={user.id} onClose={() => setCancelTarget(null)}
          onCancelled={() => { fetchSubs(); setToast("Assinatura cancelada."); setTimeout(() => setToast(null), 3500); }} />
      )}

      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-2xl bg-red-600 px-5 py-4 text-sm font-semibold text-white shadow-xl">
          <span className="material-symbols-outlined text-base">info</span>{toast}
        </div>
      )}
    </div>
  );
}
