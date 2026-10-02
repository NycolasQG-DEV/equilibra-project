"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { authenticatedFetch } from "@/lib/api-client";
import { useAuth } from "@/hooks/useAuth";
import { useExternalLibs } from "@/hooks/useExternalLibs";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { Subscription, PLAN_NAMES } from "@/types/database";

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  active: {
    label: "Ativa",
    color: "text-emerald-700",
    bg: "bg-emerald-50 border-emerald-200",
    icon: "check_circle",
  },
  cancelled: {
    label: "Cancelada",
    color: "text-red-700",
    bg: "bg-red-50 border-red-200",
    icon: "cancel",
  },
  expired: {
    label: "Expirada",
    color: "text-amber-700",
    bg: "bg-amber-50 border-amber-200",
    icon: "schedule",
  },
};

function formatBRL(cents: number) {
  return `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`;
}

function daysRemaining(expiresAt: string): number {
  const diff = new Date(expiresAt).getTime() - new Date().getTime();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

/* ─── Cancel Modal ─── */
function CancelModal({
  sub,
  userId,
  onClose,
  onCancelled,
}: {
  sub: Subscription;
  userId: string;
  onClose: () => void;
  onCancelled: () => void;
}) {
  const [loadingCancel, setLoadingCancel] = useState(false);
  const [cancelError, setCancelError] = useState("");

  const handleCancel = async () => {
    setLoadingCancel(true);
    setCancelError("");
    try {
      const res = await authenticatedFetch("/api/admin/cancel-subscription", {
        method: "POST",
        body: JSON.stringify({ userId, subscriptionId: sub.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCancelError(data.error || "Erro ao cancelar.");
        return;
      }
      onCancelled();
      onClose();
    } catch {
      setCancelError("Erro de conexão.");
    } finally {
      setLoadingCancel(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-3xl border border-red-200 bg-white p-8 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        style={{ animation: "asn-modal-in 0.28s cubic-bezier(0.16,1,0.3,1) both" }}
      >
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-red-100">
          <span className="material-symbols-outlined text-3xl text-red-600">credit_card_off</span>
        </div>
        <h3 className="text-center font-['Epilogue'] text-xl font-bold text-[#260054]">
          Cancelar Assinatura
        </h3>
        <p className="mt-2 text-center text-sm leading-relaxed text-[#4a4550]">
          Tem certeza que deseja cancelar o plano{" "}
          <strong className="text-[#260054]">{PLAN_NAMES[sub.plan]}</strong>?<br />
          Você perderá acesso aos recursos da plataforma.
        </p>
        {cancelError && (
          <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
            {cancelError}
          </p>
        )}
        <div className="mt-6 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-2xl border border-purple-200 py-3 text-sm font-semibold text-[#4a4550] transition-all hover:bg-purple-50"
            type="button"
          >
            Manter plano
          </button>
          <button
            onClick={handleCancel}
            disabled={loadingCancel}
            className="flex-1 rounded-2xl bg-red-600 py-3 text-sm font-bold text-white transition-all hover:bg-red-700 disabled:opacity-50"
            type="button"
          >
            {loadingCancel ? "Cancelando..." : "Cancelar"}
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

  useExternalLibs(() => {
    const anime = window.anime;
    if (typeof anime !== "function") return;

    anime({
      targets: ".asn-reveal",
      translateY: [20, 0],
      delay: anime.stagger(60),
      duration: 500,
      easing: "easeOutExpo",
    });
  });

  const fetchSubs = useCallback(async () => {
    if (!user) return;
    setDataLoading(true);
    try {
      const res = await authenticatedFetch(
        `/api/admin/subscriptions?userId=${user.id}`
      );
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

  useEffect(() => {
    fetchSubs();
  }, [fetchSubs]);

  const activeSub = subs.find((s) => s.status === "active");
  const pastSubs = subs.filter((s) => s.status !== "active");
  const days = activeSub ? daysRemaining(activeSub.expires_at) : 0;
  const progressPct = activeSub
    ? Math.max(0, Math.min(100, (days / 30) * 100))
    : 0;
  const progressColor =
    days <= 5
      ? "from-red-500 to-red-400"
      : days <= 10
      ? "from-amber-500 to-amber-400"
      : "from-[#3d1a6e] to-[#6b538c]";

  if (loading) return <LoadingSpinner message="Verificando acesso..." />;

  return (
    <>
      <style>{`
        @keyframes asn-modal-in {
          from { opacity: 0; transform: scale(0.92) translateY(16px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes asn-toast-in {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div className="eq-page flex flex-col">
        {/* Page heading */}
        <div className="asn-reveal eq-page-heading">
          <div>
            <span className="eq-eyebrow">Conta</span>
            <h1>Plano e assinatura</h1>
            <p>Gerencie seu plano ativo, histórico de pagamentos e renovações.</p>
          </div>
        </div>

        {dataLoading ? (
          <div className="flex items-center justify-center py-24">
            <div className="flex flex-col items-center gap-4">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-purple-200 border-t-[#3d1a6e]" />
              <p className="text-sm font-medium text-[#6b538c]">Carregando assinatura...</p>
            </div>
          </div>
        ) : !activeSub && pastSubs.length === 0 ? (
          /* ── No subscription ── */
          <div className="asn-reveal flex flex-col items-center justify-center gap-8 rounded-3xl border border-purple-100 bg-white py-24 text-center shadow-sm">
            <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-gradient-to-br from-purple-100 to-purple-50">
              <span className="material-symbols-outlined text-5xl text-[#3d1a6e]">
                credit_card_off
              </span>
            </div>
            <div>
              <h2 className="font-['Epilogue'] text-2xl font-bold text-[#260054]">
                Nenhum plano ativo
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-[#4a4550]">
                Escolha um plano e pague via Mercado Pago para começar<br />a usar a plataforma completa.
              </p>
            </div>
            <button
              onClick={() => router.push("/planos")}
              className="inline-flex items-center gap-2 rounded-2xl px-8 py-4 font-bold text-white shadow-lg transition-all hover:-translate-y-0.5"
              style={{ background: "linear-gradient(135deg, #542589, #3d1a6e)" }}
              type="button"
            >
              <span className="material-symbols-outlined text-lg">workspace_premium</span>
              Ver planos disponíveis
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* ── Active subscription card ── */}
            {activeSub && (
              <>
                <div className="asn-reveal grid gap-5 lg:grid-cols-3">
                  {/* Plan hero */}
                  <div
                    className="relative col-span-2 overflow-hidden rounded-3xl p-7 text-white shadow-xl"
                    style={{
                      background: "linear-gradient(135deg, #260054 0%, #3d1a6e 50%, #542589 100%)",
                    }}
                  >
                    <div className="absolute -right-10 -top-10 h-48 w-48 rounded-full bg-white/5" />
                    <div className="absolute -bottom-16 right-4 h-36 w-36 rounded-full bg-white/5" />
                    <div className="absolute right-16 top-8 h-20 w-20 rounded-full bg-white/5" />
                    <div className="relative">
                      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-white/60">Plano atual</p>
                          <h2 className="mt-0.5 font-['Epilogue'] text-3xl font-bold">
                            {PLAN_NAMES[activeSub.plan]}
                          </h2>
                          <p className="mt-1 text-2xl font-bold text-white/90">
                            {formatBRL(activeSub.price_brl)}
                            <span className="text-sm font-normal text-white/50">/mês</span>
                          </p>
                        </div>
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold ${
                            STATUS_CONFIG[activeSub.status]?.bg ?? "bg-white/10 border-white/20 text-white"
                          } ${STATUS_CONFIG[activeSub.status]?.color ?? ""}`}
                        >
                          <span
                            className="material-symbols-outlined text-sm"
                            style={{ fontVariationSettings: "'FILL' 1" }}
                          >
                            {STATUS_CONFIG[activeSub.status]?.icon ?? "info"}
                          </span>
                          {STATUS_CONFIG[activeSub.status]?.label ?? activeSub.status}
                        </span>
                      </div>
                      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-2">
                        <div className="rounded-2xl bg-white/10 px-4 py-3">
                          <p className="text-xs text-white/50">Início</p>
                          <p className="mt-1 text-sm font-semibold">
                            {formatDate(activeSub.started_at)}
                          </p>
                        </div>
                        <div className="rounded-2xl bg-white/10 px-4 py-3">
                          <p className="text-xs text-white/50">Vencimento</p>
                          <p className="mt-1 text-sm font-semibold">
                            {formatDate(activeSub.expires_at)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Days remaining */}
                  <div className="flex flex-col justify-center rounded-3xl border border-purple-100 bg-white p-7 shadow-sm">
                    <p className="text-xs font-bold uppercase tracking-widest text-[#4a4550]">
                      Dias restantes
                    </p>
                    <p className="mt-2 font-['Epilogue'] text-6xl font-bold tracking-tight text-[#260054]">
                      {days}
                    </p>
                    <div className="mt-4 h-3 w-full overflow-hidden rounded-full bg-purple-100">
                      <div
                        className={`h-full rounded-full bg-gradient-to-r transition-all ${progressColor}`}
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                    <p className="mt-2 text-xs text-[#4a4550]">
                      {days <= 0
                        ? "Assinatura expirada"
                        : days <= 5
                        ? "⚠️ Renove em breve!"
                        : `Próxima cobrança em ${days} dias`}
                    </p>
                  </div>
                </div>

                {/* Payment method + Actions */}
                <div className="asn-reveal grid gap-5 lg:grid-cols-2">
                  <div className="rounded-3xl border border-purple-100 bg-white p-6 shadow-sm">
                    <div className="mb-5 flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-purple-100">
                        <span className="material-symbols-outlined text-[#3d1a6e]">
                          account_balance
                        </span>
                      </div>
                      <div>
                        <h3 className="font-bold text-[#260054]">Método de pagamento</h3>
                        <p className="text-xs text-[#4a4550]">Forma utilizada na assinatura</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 rounded-2xl border border-purple-100 bg-purple-50/40 px-5 py-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white shadow-sm text-[#3d1a6e]">
                        <span className="material-symbols-outlined text-2xl">pix</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-[#260054] truncate">
                          {activeSub.payment_method}
                        </p>
                        <p className="text-xs text-[#4a4550]">Pagamento instantâneo</p>
                      </div>
                      <span
                        className="material-symbols-outlined flex-shrink-0 text-emerald-500"
                        style={{ fontVariationSettings: "'FILL' 1" }}
                      >
                        verified
                      </span>
                    </div>
                  </div>

                  <div className="rounded-3xl border border-purple-100 bg-white p-6 shadow-sm">
                    <div className="mb-5 flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-purple-100">
                        <span className="material-symbols-outlined text-[#3d1a6e]">tune</span>
                      </div>
                      <div>
                        <h3 className="font-bold text-[#260054]">Gerenciar assinatura</h3>
                        <p className="text-xs text-[#4a4550]">Ações disponíveis</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setCancelTarget(activeSub)}
                      className="flex w-full items-center gap-3 rounded-2xl border border-red-200 px-5 py-4 text-sm font-semibold text-red-600 transition-all hover:bg-red-50 hover:-translate-y-0.5"
                      type="button"
                    >
                      <span className="material-symbols-outlined text-lg">cancel</span>
                      Cancelar assinatura
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* ── Past subscriptions ── */}
            {pastSubs.length > 0 && (
              <div className="asn-reveal overflow-hidden rounded-3xl border border-purple-100 bg-white shadow-sm">
                <div className="border-b border-purple-100 px-6 py-5">
                  <h3 className="font-['Epilogue'] text-lg font-bold text-[#260054]">
                    Histórico de assinaturas
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-purple-50/60 text-xs font-bold uppercase tracking-wider text-[#4a4550]">
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
                        <tr key={s.id} className="transition-colors hover:bg-purple-50/30">
                          <td className="px-6 py-4 font-semibold text-[#260054]">
                            {PLAN_NAMES[s.plan]}
                          </td>
                          <td className="px-6 py-4 text-[#4a4550]">{formatBRL(s.price_brl)}</td>
                          <td className="px-6 py-4 text-[#4a4550] whitespace-nowrap">
                            {formatDate(s.started_at)} — {formatDate(s.expires_at)}
                          </td>
                          <td className="px-6 py-4 text-[#4a4550]">{s.payment_method}</td>
                          <td className="px-6 py-4">
                            <span
                              className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-bold ${
                                STATUS_CONFIG[s.status]?.bg ?? "bg-gray-100 border-gray-200 text-gray-600"
                              } ${STATUS_CONFIG[s.status]?.color ?? ""}`}
                            >
                              {STATUS_CONFIG[s.status]?.label ?? s.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Reactivate CTA */}
            {!activeSub && pastSubs.length > 0 && (
              <div className="asn-reveal flex flex-col items-center gap-5 rounded-3xl border-2 border-dashed border-purple-200 bg-purple-50/40 py-12 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-purple-100">
                  <span className="material-symbols-outlined text-3xl text-[#3d1a6e]">
                    restart_alt
                  </span>
                </div>
                <div>
                  <h3 className="font-['Epilogue'] text-xl font-bold text-[#260054]">
                    Reative sua assinatura
                  </h3>
                  <p className="mt-1 text-sm text-[#4a4550]">
                    Escolha um novo plano e pague via Mercado Pago.
                  </p>
                </div>
                <button
                  onClick={() => router.push("/planos")}
                  className="inline-flex items-center gap-2 rounded-2xl px-8 py-3 font-bold text-white shadow-md transition-all hover:-translate-y-0.5"
                  style={{ background: "linear-gradient(135deg, #542589, #3d1a6e)" }}
                  type="button"
                >
                  <span className="material-symbols-outlined text-lg">workspace_premium</span>
                  Ver planos
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Cancel Modal */}
      {cancelTarget && user && (
        <CancelModal
          sub={cancelTarget}
          userId={user.id}
          onClose={() => setCancelTarget(null)}
          onCancelled={() => {
            fetchSubs();
            setToast("Assinatura cancelada com sucesso.");
            setTimeout(() => setToast(null), 3500);
          }}
        />
      )}

      {/* Toast */}
      {toast && (
        <div
          className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-2xl bg-[#3d1a6e] px-5 py-4 text-sm font-semibold text-white shadow-xl"
          style={{ animation: "asn-toast-in 0.3s ease-out both" }}
        >
          <span
            className="material-symbols-outlined text-base text-[#d6bbfc]"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            check_circle
          </span>
          {toast}
        </div>
      )}
    </>
  );
}
