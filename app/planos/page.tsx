"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useExternalLibs } from "@/hooks/useExternalLibs";
import { authenticatedFetch } from "@/lib/api-client";
import { clearAuthSession } from "@/lib/auth-client";
import { PlanType, User } from "@/types/database";

interface CardConfig {
  id: string;
  type: "trial" | "plan" | "custom";
  planId?: PlanType;
  name: string;
  badge?: string;
  monthlyPrice: string;
  annualPrice: string;
  originalPrice?: string;
  annualSavings?: string;
  limitLabel: string;
  popular?: boolean;
  features: { text: string; highlight?: boolean }[];
  buttonText: string;
}

const CARDS: CardConfig[] = [
  {
    id: "trial",
    type: "trial",
    name: "DEGUSTAÇÃO",
    badge: "GRÁTIS",
    monthlyPrice: "R$ 0",
    annualPrice: "R$ 0",
    limitLabel: "7 dias sem cartão",
    features: [
      { text: "7 dias de acesso total", highlight: true },
      { text: "Até 10 colaboradores" },
      { text: "Criação de pesquisas por IA", highlight: true },
      { text: "Sem cartão de crédito" },
      { text: "Ativação imediata da conta", highlight: true },
    ],
    buttonText: "Testar Grátis",
  },
  {
    id: "starter",
    type: "plan",
    planId: "starter",
    name: "STARTER",
    monthlyPrice: "R$ 99",
    annualPrice: "R$ 79",
    originalPrice: "R$ 99",
    annualSavings: "Economize R$ 240/ano",
    limitLabel: "Até 10 colaboradores",
    features: [
      { text: "Até 10 colaboradores/mês", highlight: true },
      { text: "Coletas via Link e QR Code" },
      { text: "Rascunhos de pesquisas por IA", highlight: true },
      { text: "Relatórios agregados" },
      { text: "Anonimato garantido", highlight: true },
    ],
    buttonText: "Contratar",
  },
  {
    id: "professional",
    type: "plan",
    planId: "professional",
    name: "PROFESSIONAL",
    badge: "MELHOR OFERTA",
    monthlyPrice: "R$ 249",
    annualPrice: "R$ 199",
    originalPrice: "R$ 249",
    annualSavings: "Economize R$ 600/ano",
    limitLabel: "Até 50 colaboradores",
    popular: true,
    features: [
      { text: "Até 50 colaboradores/mês", highlight: true },
      { text: "Tudo do plano Starter" },
      { text: "Setores, cargos e rotinas", highlight: true },
      { text: "IA contextualizada ao setor", highlight: true },
      { text: "Dashboards Radar & NR-1", highlight: true },
    ],
    buttonText: "Contratar Agora",
  },
  {
    id: "enterprise",
    type: "plan",
    planId: "enterprise",
    name: "ENTERPRISE",
    monthlyPrice: "R$ 499",
    annualPrice: "R$ 399",
    originalPrice: "R$ 499",
    annualSavings: "Economize R$ 1.200/ano",
    limitLabel: "Colaboradores ilimitados",
    features: [
      { text: "Colaboradores ilimitados", highlight: true },
      { text: "Todas as funções Pro" },
      { text: "Histórico longitudinal de ciclos", highlight: true },
      { text: "Laudos executivos CIPA/SST", highlight: true },
      { text: "Suporte e implantação VIP", highlight: true },
    ],
    buttonText: "Contratar",
  },
  {
    id: "custom",
    type: "custom",
    name: "CUSTOMIZADO",
    badge: "SOB MEDIDA",
    monthlyPrice: "SOB MEDIDA",
    annualPrice: "SOB MEDIDA",
    limitLabel: "Acima de 500 colaborad.",
    features: [
      { text: "Para grandes grupos ou redes", highlight: true },
      { text: "Condições sob medida", highlight: true },
      { text: "Consultoria SST dedicada" },
      { text: "SLA de atendimento prioritário" },
      { text: "Atendimento WhatsApp & E-mail", highlight: true },
    ],
    buttonText: "Falar com Consultor",
  },
];

export default function PlanosPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string>("");
  const [annual, setAnnual] = useState(false);
  const [processingPlan, setProcessingPlan] = useState<PlanType | null>(null);
  const [loadingTrial, setLoadingTrial] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [paymentId, setPaymentId] = useState("");
  const [reference, setReference] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("");

  useExternalLibs(() => {
    const anime = window.anime;
    if (typeof anime !== "function") return;

    anime({
      targets: ".ref-heading",
      translateY: [-20, 0],
      opacity: [0, 1],
      duration: 600,
      easing: "easeOutExpo",
    });

    anime({
      targets: ".ref-card",
      translateY: [50, 0],
      scale: [0.92, 1],
      opacity: [0, 1],
      delay: anime.stagger(110, { start: 150 }),
      duration: 800,
      easing: "easeOutBack",
    });
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const returnedId = params.get("payment_id") || params.get("collection_id");
    if (returnedId && /^\d+$/.test(returnedId)) setPaymentId(returnedId);
    const savedRef = window.sessionStorage.getItem("equilibra_checkout_reference");
    if (savedRef) setReference(savedRef);
    if (params.get("status") === "failure")
      setError("O pagamento não foi concluído. Tente novamente.");

    const check = async () => {
      try {
        const res = await authenticatedFetch("/api/auth/me");
        if (!res.ok) {
          clearAuthSession();
          router.replace("/");
          return;
        }
        const data = await res.json();
        const user: User = data.user;
        if (user.plan && user.plan !== "none") {
          router.replace("/admin");
          return;
        }
        setUserId(user.id);
        setUserEmail(user.email || "");
      } catch {
        clearAuthSession();
        router.replace("/");
      } finally {
        setLoading(false);
      }
    };
    check();
  }, [router]);

  // Payment status polling
  useEffect(() => {
    if ((!paymentId && !reference) || !userId) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const query = paymentId
          ? `paymentId=${encodeURIComponent(paymentId)}`
          : `reference=${encodeURIComponent(reference)}`;
        const res = await authenticatedFetch(`/api/payments/status?${query}`);
        const data = await res.json();
        if (!res.ok) {
          if (!stopped) setError(data.error || "Não foi possível verificar o pagamento.");
          if (!stopped && res.status >= 500) timer = setTimeout(poll, 5000);
          return;
        }
        if (stopped) return;
        setError("");
        setPaymentStatus(data.status || "pending");
        if (data.paid) {
          window.sessionStorage.removeItem("equilibra_checkout_reference");
          router.replace("/admin");
          return;
        }
        if (["rejected", "cancelled", "refunded", "charged_back"].includes(data.status)) return;
        timer = setTimeout(poll, 3000);
      } catch {
        if (!stopped) timer = setTimeout(poll, 5000);
      }
    };
    poll();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [paymentId, reference, userId, router]);

  const startCheckout = async (plan: PlanType) => {
    if (!userId || processingPlan) return;
    setError("");
    setProcessingPlan(plan);
    const checkoutWindow = window.open("", "_blank");
    if (checkoutWindow) checkoutWindow.opener = null;
    try {
      const res = await authenticatedFetch("/api/payments/create-checkout", {
        method: "POST",
        body: JSON.stringify({ userId, plan }),
      });
      const data = await res.json();
      if (!res.ok || !data.checkoutUrl)
        throw new Error(data.error || "Não foi possível abrir o checkout.");
      window.sessionStorage.setItem("equilibra_checkout_reference", data.reference);
      setReference(data.reference);
      setPaymentId("");
      setPaymentStatus("pending");
      if (checkoutWindow) checkoutWindow.location.href = data.checkoutUrl;
      else window.location.assign(data.checkoutUrl);
    } catch (cause) {
      checkoutWindow?.close();
      setError(cause instanceof Error ? cause.message : "Erro ao abrir o checkout.");
    } finally {
      setProcessingPlan(null);
    }
  };

  const handleStartTrial = async () => {
    if (!userId || loadingTrial) return;
    setError("");
    setLoadingTrial(true);
    try {
      const res = await authenticatedFetch("/api/payments/start-trial", {
        method: "POST",
        body: JSON.stringify({ userId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao ativar teste grátis.");
      setNotice("Degustação gratuita de 7 dias ativada com sucesso! Redirecionando...");
      setTimeout(() => router.replace("/admin"), 1200);
    } catch (err: any) {
      setError(err.message || "Não foi possível ativar o teste grátis.");
    } finally {
      setLoadingTrial(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f8f6fb]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-3 border-[#e6dfee] border-t-[#3d1a6e]" />
          <p className="text-xs font-semibold text-[#675575]">Carregando opções...</p>
        </div>
      </div>
    );
  }

  const isPolling = (paymentId || reference) && !error;
  const isPollApproved = paymentStatus === "approved";
  const isPollRejected = ["rejected", "cancelled", "refunded", "charged_back"].includes(paymentStatus);

  return (
    <div className="min-h-screen bg-[#f9f8fc] text-[#260054] font-['Manrope',sans-serif] flex flex-col justify-between overflow-x-hidden">
      {/* ── CSS Motion Keyframes ── */}
      <style>{`
        @keyframes strikeLine {
          from { width: 0%; }
          to   { width: 100%; }
        }
        @keyframes pricePopIn {
          0%   { opacity: 0; transform: translateY(-8px) scale(0.92); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes glowPulse {
          0%, 100% { box-shadow: 0 0 15px rgba(203, 155, 250, 0.3); }
          50%      { box-shadow: 0 0 30px rgba(203, 155, 250, 0.6); }
        }
        .strike-through-anim {
          position: relative;
          display: inline-block;
        }
        .strike-through-anim::after {
          content: "";
          position: absolute;
          left: 0;
          top: 50%;
          width: 100%;
          height: 2px;
          background: #ef4444;
          transform: translateY(-50%);
          animation: strikeLine 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .price-pop {
          animation: pricePopIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }
      `}</style>

      {/* ── Header ── */}
      <header className="ref-heading border-b border-[#ece6f5] bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between px-8 py-4">
          <div className="flex items-center gap-3">
            <span
              className="flex h-9 w-9 items-center justify-center rounded-xl text-xl font-black italic text-[#cb9bfa] shadow-sm"
              style={{ background: "linear-gradient(140deg,#693ca3,#260054)" }}
            >
              e
            </span>
            <span className="font-['Epilogue'] text-xl font-bold tracking-tight text-[#260054]">
              equilibra<span className="text-[#7d50aa]">.</span>
            </span>
          </div>

          <div className="flex items-center gap-4 text-xs">
            {userEmail && (
              <span className="hidden text-[#675575] sm:inline-block font-medium">
                {userEmail}
              </span>
            )}
            <button
              onClick={() => {
                clearAuthSession();
                router.replace("/");
              }}
              className="font-bold text-[#675575] hover:text-[#260054] transition-colors"
              type="button"
            >
              Sair
            </button>
          </div>
        </div>
      </header>

      {/* ── Main Canvas (Spacious Viewport Layout) ── */}
      <main className="mx-auto w-full max-w-[1520px] px-8 py-8 flex-1 flex flex-col justify-center">
        {/* Header & Dragging Switcher Toggle */}
        <div className="ref-heading text-center max-w-3xl mx-auto">
          <span className="text-[12px] font-black uppercase tracking-widest text-[#7d50aa]">
            PRICING &amp; PLANOS DE ADESÃO
          </span>
          <h1 className="font-['Epilogue'] mt-1 text-3xl font-black tracking-tight text-[#260054] sm:text-4xl lg:text-5xl">
            Escolha Seu Melhor Plano
          </h1>

          {/* Smooth Sliding Pill Switcher Toggle */}
          <div className="mt-5 inline-flex items-center rounded-full bg-[#eee7f7] p-1.5 shadow-inner relative overflow-hidden">
            {/* Sliding Pill Background Knob */}
            <div
              className="absolute top-1.5 bottom-1.5 rounded-full bg-[#3d1a6e] shadow-lg transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]"
              style={{
                left: annual ? "calc(50% + 2px)" : "6px",
                width: "calc(50% - 8px)",
              }}
            />

            <button
              onClick={() => setAnnual(false)}
              className={`relative z-10 rounded-full px-6 py-2 text-xs font-extrabold transition-all duration-300 ${
                !annual ? "text-white" : "text-[#786586] hover:text-[#260054]"
              }`}
              type="button"
            >
              Faturamento Mensal
            </button>
            <button
              onClick={() => setAnnual(true)}
              className={`relative z-10 flex items-center gap-2 rounded-full px-6 py-2 text-xs font-extrabold transition-all duration-300 ${
                annual ? "text-white" : "text-[#786586] hover:text-[#260054]"
              }`}
              type="button"
            >
              <span>Faturamento Anual</span>
              <span className="rounded-full bg-[#d1fae5] px-2 py-0.5 text-[9px] text-[#065f46] font-black animate-pulse">
                -20% OFF
              </span>
            </button>
          </div>

          {/* Notifications */}
          {notice && (
            <div role="status" className="mt-3 rounded-xl bg-emerald-50 px-4 py-2.5 text-xs font-bold text-emerald-800 shadow-sm">
              {notice}
            </div>
          )}
          {error && (
            <div role="alert" className="mt-3 rounded-xl bg-red-50 px-4 py-2.5 text-xs font-medium text-red-700">
              {error}
            </div>
          )}
          {isPolling && !error && (
            <div role="status" className="mt-3 rounded-xl bg-[#ede5fa] px-4 py-2.5 text-xs font-bold text-[#260054]">
              {isPollApproved
                ? "Pagamento aprovado! Redirecionando..."
                : isPollRejected
                ? "Pagamento não concluído. Tente novamente."
                : "Aguardando confirmação do pagamento..."}
            </div>
          )}
        </div>

        {/* ── 5 Prominent Cards Side-by-Side Horizontal Grid ── */}
        <div className="mt-10 grid gap-5 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 items-stretch">
          {CARDS.map((card) => {
            const isPop = card.popular;
            const currentPrice = annual ? card.annualPrice : card.monthlyPrice;
            const originalPrice = card.originalPrice;

            if (isPop) {
              // Featured Prominent Card (PROFESSIONAL / MELHOR OFERTA)
              return (
                <div
                  key={card.id}
                  className="ref-card relative flex flex-col justify-between rounded-[36px] p-7 text-white shadow-2xl transition-all duration-300 hover:-translate-y-3 lg:-mt-3 lg:mb-0 min-h-[520px]"
                  style={{
                    background: "linear-gradient(135deg, #3d1a6e 0%, #542589 60%, #693ca3 100%)",
                    boxShadow: "0 22px 55px rgba(61, 26, 110, 0.4)",
                  }}
                >
                  {/* Floating Circular Badge */}
                  <div
                    className="absolute -top-5 -left-4 flex h-20 w-20 flex-col items-center justify-center rounded-full text-center shadow-xl border-2 border-white/30 text-white font-extrabold animate-bounce"
                    style={{
                      animationDuration: "3s",
                      background: "linear-gradient(135deg, #260054, #3d1a6e)",
                    }}
                  >
                    <span className="text-[9px] uppercase tracking-wider leading-none text-[#cb9bfa]">MELHOR</span>
                    <span className="text-[11px] font-black leading-none mt-0.5">OFERTA</span>
                  </div>

                  <div>
                    {/* Header */}
                    <div className="text-center pt-2">
                      <h2 className="font-['Epilogue'] text-xl font-black tracking-wider text-white">
                        {card.name}
                      </h2>

                      {/* Animated Fluid Price Organic Blob */}
                      <div className="mx-auto my-4 flex h-28 w-36 flex-col items-center justify-center text-center shadow-lg transition-all duration-500"
                        style={{
                          borderRadius: "60% 40% 30% 70% / 60% 30% 70% 40%",
                          background: "rgba(255, 255, 255, 0.16)",
                          backdropFilter: "blur(10px)",
                        }}
                      >
                        {annual && originalPrice ? (
                          <div className="price-pop flex flex-col items-center">
                            <span className="strike-through-anim text-[11px] font-extrabold text-red-200">
                              {originalPrice}/mês
                            </span>
                            <span className="font-['Epilogue'] text-3xl font-black text-white">
                              {currentPrice}
                            </span>
                          </div>
                        ) : (
                          <span className="font-['Epilogue'] text-3xl font-black text-white">
                            {currentPrice}
                          </span>
                        )}
                        <span className="text-[9px] text-white/80 uppercase tracking-widest font-extrabold">
                          {annual ? "no plano anual" : "/mês"}
                        </span>
                      </div>

                      {annual ? (
                        <span className="inline-block rounded-full bg-emerald-400/25 px-3 py-1 text-[10px] font-black text-emerald-200 border border-emerald-300/40">
                          {card.annualSavings}
                        </span>
                      ) : (
                        <p className="text-[11px] text-white/80 font-bold">
                          {card.limitLabel} &middot; R$ 1,00 no 1º mês
                        </p>
                      )}
                    </div>

                    {/* Features List */}
                    <div className="mt-6 space-y-0 text-xs text-white/90">
                      {card.features.map((feat) => (
                        <div
                          key={feat.text}
                          className={`border-b border-white/15 py-2.5 text-center text-[11px] transition-all hover:bg-white/10 ${
                            feat.highlight ? "font-bold text-white" : "font-medium text-white/80"
                          }`}
                        >
                          {feat.highlight && <span className="text-amber-300 mr-1.5">✦</span>}
                          {feat.text}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* High Contrast Pill Button */}
                  <div className="mt-8 text-center">
                    <button
                      onClick={() => startCheckout(card.planId!)}
                      disabled={!!processingPlan || !userId}
                      type="button"
                      className="w-full rounded-full bg-[#cb9bfa] py-4 text-xs font-black uppercase tracking-wider text-[#260054] shadow-xl transition-all duration-300 hover:bg-white hover:scale-105 active:scale-95 disabled:opacity-50"
                    >
                      {processingPlan === card.planId ? "Conectando..." : card.buttonText}
                    </button>
                  </div>
                </div>
              );
            }

            // Normal Prominent White Card
            return (
              <div
                key={card.id}
                className="ref-card relative flex flex-col justify-between rounded-[32px] bg-white p-7 border border-[#ece6f5] shadow-xl shadow-purple-900/5 transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl min-h-[500px]"
              >
                <div>
                  {/* Header */}
                  <div className="text-center">
                    <h2 className="font-['Epilogue'] text-lg font-extrabold tracking-wider text-[#260054]">
                      {card.name}
                    </h2>

                    {/* Fluid Price Blob with Strikethrough Motion */}
                    <div
                      className="mx-auto my-4 flex h-24 w-32 flex-col items-center justify-center text-center shadow-sm transition-all duration-500"
                      style={{
                        borderRadius: "50% 50% 40% 60% / 60% 40% 60% 40%",
                        background: card.type === "trial" ? "#ede5fa" : card.type === "custom" ? "#f4effa" : "#f3ecfb",
                      }}
                    >
                      {annual && originalPrice ? (
                        <div className="price-pop flex flex-col items-center">
                          <span className="strike-through-anim text-[10px] font-bold text-red-500">
                            {originalPrice}/mês
                          </span>
                          <span className="font-['Epilogue'] text-2xl font-extrabold text-[#260054]">
                            {currentPrice}
                          </span>
                        </div>
                      ) : (
                        <span className="font-['Epilogue'] text-2xl font-extrabold text-[#260054]">
                          {currentPrice}
                        </span>
                      )}
                      <span className="text-[8px] text-[#786586] uppercase tracking-wider font-extrabold">
                        {card.type === "plan" ? (annual ? "no plano anual" : "/mês") : card.badge || "ACESSO"}
                      </span>
                    </div>

                    {annual && card.annualSavings ? (
                      <span className="inline-block rounded-full bg-[#ede5fa] px-2.5 py-0.5 text-[10px] font-extrabold text-[#542589]">
                        {card.annualSavings}
                      </span>
                    ) : (
                      <p className="text-[11px] text-[#786586] font-bold">
                        {card.limitLabel}
                      </p>
                    )}
                  </div>

                  {/* Features List */}
                  <div className="mt-6 space-y-0 text-xs text-[#2f223c]">
                    {card.features.map((feat) => (
                      <div
                        key={feat.text}
                        className={`border-b border-[#f1edf5] py-2.5 text-center text-[11px] transition-colors hover:bg-[#faf7fd] ${
                          feat.highlight ? "font-bold text-[#260054]" : "font-normal text-[#544766]"
                        }`}
                      >
                        {feat.highlight && <span className="text-[#3d1a6e] mr-1.5">✦</span>}
                        {feat.text}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Button */}
                <div className="mt-8 text-center">
                  {card.type === "trial" ? (
                    <button
                      onClick={handleStartTrial}
                      disabled={loadingTrial}
                      type="button"
                      className="w-full rounded-full bg-[#542589] py-3.5 text-xs font-extrabold uppercase tracking-wider text-white shadow-md transition-all duration-300 hover:bg-[#260054] hover:scale-105 active:scale-95 disabled:opacity-50"
                    >
                      {loadingTrial ? "Ativando..." : card.buttonText}
                    </button>
                  ) : card.type === "custom" ? (
                    <button
                      onClick={() => setShowContactModal(true)}
                      type="button"
                      className="w-full rounded-full border-2 border-[#3d1a6e] bg-white py-3.5 text-xs font-extrabold uppercase tracking-wider text-[#3d1a6e] shadow-md transition-all duration-300 hover:bg-[#3d1a6e] hover:text-white hover:scale-105 active:scale-95"
                    >
                      {card.buttonText}
                    </button>
                  ) : (
                    <button
                      onClick={() => startCheckout(card.planId!)}
                      disabled={!!processingPlan || !userId}
                      type="button"
                      className="w-full rounded-full bg-[#3d1a6e] py-3.5 text-xs font-extrabold uppercase tracking-wider text-white shadow-md transition-all duration-300 hover:bg-[#260054] hover:scale-105 active:scale-95 disabled:opacity-50"
                    >
                      {processingPlan === card.planId ? "Abrindo..." : card.buttonText}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {/* ── Custom Enterprise Contact Modal ── */}
      {showContactModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-[#ece6f5] bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#f1edf5] pb-3">
              <h3 className="font-['Epilogue'] text-lg font-bold text-[#260054]">
                Orçamento Customizado
              </h3>
              <button onClick={() => setShowContactModal(false)} className="text-[#8e8597] hover:text-[#260054]">
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>
            <div className="mt-4 space-y-3 text-xs leading-relaxed text-[#675575]">
              <p>
                Oferecemos condições especiais para grandes empresas, grupos hospitalares, redes industriais e consultorias de SST com demandas acima de 500 colaboradores.
              </p>
              <div className="rounded-2xl bg-[#faf7fd] p-4 border border-[#eee6f7] space-y-2">
                <p className="font-bold text-[#260054]">Contato Direto:</p>
                <a
                  href="https://wa.me/5511999999999?text=Ol%C3%A1%2C%20gostaria%20de%20um%20or%C3%A7amento%20customizado%20para%20o%20EQUILIBRA"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-xs font-bold text-emerald-700 hover:underline"
                >
                  <span className="material-symbols-outlined text-base">chat</span>
                  Atendimento via WhatsApp
                </a>
                <a
                  href="mailto:contato@equilibra.com.br?subject=Orçamento%20Customizado%20EQUILIBRA"
                  className="flex items-center gap-2 text-xs font-bold text-[#542589] hover:underline"
                >
                  <span className="material-symbols-outlined text-base">mail</span>
                  E-mail: contato@equilibra.com.br
                </a>
              </div>
            </div>
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowContactModal(false)}
                className="rounded-full bg-[#3d1a6e] px-6 py-2.5 text-xs font-bold text-white hover:bg-[#260054]"
                type="button"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Footer Trust Line ── */}
      <footer className="border-t border-[#ece6f5] bg-white py-3">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 text-[11px] text-[#675575]">
          <div className="flex items-center gap-1.5 font-medium">
            <span className="material-symbols-outlined text-sm text-[#3d1a6e]">security</span>
            Mercado Pago (PIX, Crédito e Boleto)
          </div>
          <div className="flex items-center gap-1.5 font-medium">
            <span className="material-symbols-outlined text-sm text-[#3d1a6e]">verified</span>
            Conformidade LGPD &amp; Diretrizes NR-1
          </div>
          <div className="flex items-center gap-1.5 font-medium">
            <span className="material-symbols-outlined text-sm text-[#3d1a6e]">cancel</span>
            Sem fidelidade ou multa rescisória
          </div>
        </div>
      </footer>
    </div>
  );
}
