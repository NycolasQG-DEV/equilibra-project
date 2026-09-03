"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { authenticatedFetch } from "@/lib/api-client";
import { clearAuthSession } from "@/lib/auth-client";
import { PlanType, User } from "@/types/database";

const PLANS: { id: PlanType; name: string; price: string; testPrice: string; limit: number; features: string[]; popular?: boolean }[] = [
  {
    id: "starter",
    name: "Starter",
    price: "R$ 99",
    testPrice: "R$ 0,50",
    limit: 10,
    features: [
      "Até 10 colaboradores",
      "Chat com IA de Bem-Estar",
      "Questionário NR-1",
      "Relatórios de conformidade",
      "Suporte por e-mail",
    ],
  },
  {
    id: "professional",
    name: "Professional",
    price: "R$ 249",
    testPrice: "R$ 0,50",
    limit: 50,
    popular: true,
    features: [
      "Até 50 colaboradores",
      "Chat com IA avançado",
      "Questionário NR-1 personalizado",
      "Relatórios e métricas de risco",
      "Dashboard analítico completo",
      "Suporte prioritário",
    ],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: "R$ 499",
    testPrice: "R$ 0,50",
    limit: 9999,
    features: [
      "Colaboradores ilimitados",
      "Chat com IA premium",
      "Questionários ilimitados",
      "Relatórios avançados + exportação",
      "API de integração",
      "Gerente de conta dedicado",
    ],
  },
];

function PixModal({ plan, userId, onClose }: { plan: typeof PLANS[0]; userId: string; onClose: () => void }) {
  const router = useRouter();
  const [step, setStep] = useState<"loading" | "pix" | "done">("loading");
  const [error, setError] = useState("");
  const [brCode, setBrCode] = useState("");
  const [qrImage, setQrImage] = useState("");
  const [paymentId, setPaymentId] = useState("");
  const [amount, setAmount] = useState<number>(0.5);
  const [copied, setCopied] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 1. Criar PIX via API oficial Mercado Pago
  useEffect(() => {
    const create = async () => {
      try {
        const res = await authenticatedFetch("/api/payments/create-pix", {
          method: "POST",
          body: JSON.stringify({ userId, plan: plan.id }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "Erro ao gerar PIX no Mercado Pago.");
          setStep("pix");
          return;
        }
        setBrCode(data.brCode || "");
        setQrImage(data.qrCodeImage || "");
        setPaymentId(data.paymentId || "");
        if (data.amount) setAmount(data.amount);
        setStep("pix");
      } catch {
        setError("Erro de conexão com o servidor ao gerar PIX.");
        setStep("pix");
      }
    };
    create();
  }, [userId, plan.id]);

  // 2. Polling contínuo de verificação em tempo real
  useEffect(() => {
    if (!paymentId || step === "done") return;

    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/payments/status?paymentId=${paymentId}&userId=${userId}&plan=${plan.id}`);
        const data = await res.json();
        if (data.paid) {
          setStep("done");
          if (pollRef.current) clearInterval(pollRef.current);
          setTimeout(() => {
            router.push("/admin");
          }, 2200);
        }
      } catch {
        /* continua tentando */
      }
    }, 3000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [paymentId, step, userId, plan.id, router]);

  const copyCode = () => {
    if (brCode) {
      navigator.clipboard.writeText(brCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }
  };

  if (step === "done") {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
        <div className="w-full max-w-md rounded-3xl bg-white p-10 text-center shadow-2xl animate-in fade-in zoom-in duration-300">
          <div className="mx-auto mb-5 flex h-24 w-24 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 shadow-inner">
            <span className="material-symbols-outlined text-6xl" style={{ fontVariationSettings: "'FILL' 1" }}>
              verified
            </span>
          </div>
          <h3 className="text-2xl font-bold text-[#260054]">Pagamento Aprovado!</h3>
          <p className="mt-2 text-sm text-[#4a4550]">
            Seu plano <strong>{plan.name}</strong> foi ativado com sucesso no sistema.
          </p>
          <div className="mt-6 flex items-center justify-center gap-2 text-xs font-semibold text-purple-700">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-purple-200 border-t-purple-600" />
            Redirecionando para o Dashboard...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-lg max-h-[92vh] overflow-y-auto rounded-3xl border border-purple-100 bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-purple-100 px-8 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-100 text-[#3d1a6e]">
              <span className="material-symbols-outlined text-2xl">pix</span>
            </div>
            <div>
              <h3 className="text-lg font-bold text-[#260054]">Pagamento Seguro via PIX</h3>
              <p className="text-xs text-[#4a4550]">Mercado Pago • Plano {plan.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-[#4a4550] hover:bg-purple-50 transition-colors"
            type="button"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Content */}
        <div className="p-8">
          {step === "loading" ? (
            <div className="flex flex-col items-center gap-4 py-12">
              <div className="h-12 w-12 animate-spin rounded-full border-4 border-purple-100 border-t-[#3d1a6e]" />
              <p className="text-sm font-medium text-[#260054]">Conectando com o Mercado Pago...</p>
              <p className="text-xs text-[#4a4550]">Gerando cobrança PIX oficial</p>
            </div>
          ) : error ? (
            <div className="py-6 text-center">
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-red-100 text-red-600">
                <span className="material-symbols-outlined text-3xl">error</span>
              </div>
              <h4 className="font-bold text-[#260054]">Não foi possível gerar o PIX</h4>
              <p className="mt-2 text-sm text-red-600">{error}</p>
              <div className="mt-6 flex justify-center gap-3">
                <button
                  onClick={onClose}
                  className="rounded-xl border border-purple-200 px-6 py-2.5 text-sm font-semibold text-[#4a4550] hover:bg-purple-50 transition-colors"
                  type="button"
                >
                  Fechar
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* QR Code */}
              {qrImage && (
                <div className="flex flex-col items-center">
                  <div className="relative rounded-2xl border-2 border-purple-200 bg-white p-4 shadow-sm">
                    <img src={qrImage} alt="QR Code PIX Mercado Pago" className="h-52 w-52" />
                  </div>
                  <p className="mt-3 text-sm font-bold text-[#260054]">
                    Valor: R$ {amount.toFixed(2).replace(".", ",")}
                  </p>
                  <p className="text-xs text-[#4a4550]">
                    Abra o aplicativo do seu banco e escaneie o código
                  </p>
                </div>
              )}

              {/* PIX Copia e Cola */}
              {brCode && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold uppercase tracking-wider text-[#4a4550]">
                      PIX Copia e Cola
                    </label>
                    <span className="text-[11px] text-purple-600 font-semibold">Válido por 30 minutos</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      className="flex-1 rounded-xl border border-purple-200 bg-purple-50/50 px-3.5 py-3 text-xs font-mono text-[#260054] outline-none"
                      value={brCode}
                      readOnly
                    />
                    <button
                      onClick={copyCode}
                      className={`flex shrink-0 items-center gap-1.5 rounded-xl px-5 py-3 text-sm font-bold shadow-sm transition-all active:scale-95 ${
                        copied
                          ? "bg-emerald-600 text-white"
                          : "bg-[#3d1a6e] text-white hover:bg-[#2D1052]"
                      }`}
                      type="button"
                    >
                      <span className="material-symbols-outlined text-base">
                        {copied ? "check" : "content_copy"}
                      </span>
                      {copied ? "Copiado!" : "Copiar"}
                    </button>
                  </div>
                </div>
              )}

              {/* Live Status Indicator */}
              <div className="flex items-center gap-3.5 rounded-2xl border border-purple-200 bg-purple-50/50 p-4">
                <div className="relative flex h-4 w-4 items-center justify-center">
                  <span className="absolute h-4 w-4 animate-ping rounded-full bg-[#8b5cf6] opacity-75" />
                  <span className="relative h-2.5 w-2.5 rounded-full bg-[#3d1a6e]" />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-bold text-[#260054]">
                    Aguardando pagamento no Mercado Pago...
                  </p>
                  <p className="text-[11px] text-[#4a4550]">
                    A verificação é automática. Assim que pagar, sua conta será liberada instantaneamente.
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-[#4a4550]/80 pt-2 border-t border-purple-100">
                <div className="flex items-center gap-1">
                  <span className="material-symbols-outlined text-sm text-emerald-600">lock</span>
                  <span>Ambiente Criptografado</span>
                </div>
                <span className="font-semibold text-purple-900">Mercado Pago</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function PlanosPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState<typeof PLANS[0] | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
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
      } catch {
        clearAuthSession();
        router.replace("/");
      } finally {
        setLoading(false);
      }
    };
    check();
  }, [router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F8F6FB]">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-purple-200 border-t-[#3d1a6e]" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#F8F6FB]">
      <header className="flex items-center justify-between border-b border-purple-100 px-8 py-5 bg-white shadow-sm">
        <span className="font-['Epilogue'] text-2xl font-bold tracking-tight text-purple-900">EQUILIBRA</span>
        <button
          onClick={() => {
            clearAuthSession();
            router.replace("/");
          }}
          className="text-sm font-semibold text-purple-700 hover:text-purple-900 transition-colors"
          type="button"
        >
          Sair
        </button>
      </header>

      <main className="flex flex-1 flex-col items-center px-8 py-16">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-[#eddcff] px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-purple-900 shadow-sm">
          <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>
            rocket_launch
          </span>
          COMECE AGORA
        </div>

        <h1 className="mb-4 text-center font-['Epilogue'] text-4xl font-bold text-[#260054] lg:text-5xl">
          Escolha o plano ideal<br />para sua empresa
        </h1>
        <p className="mb-12 max-w-xl text-center text-base text-[#4a4550]">
          Pagamento instantâneo via PIX com aprovação em tempo real pelo Mercado Pago.
        </p>

        <div className="grid w-full max-w-5xl gap-8 md:grid-cols-3">
          {PLANS.map((plan) => (
            <div
              key={plan.id}
              className={`relative flex flex-col rounded-3xl border-2 bg-white p-8 shadow-md transition-all hover:shadow-xl ${
                plan.popular ? "border-[#3d1a6e] scale-[1.03]" : "border-purple-200"
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-[#3d1a6e] to-[#6b538c] px-5 py-1 text-xs font-bold uppercase tracking-widest text-white shadow-lg">
                  Mais Popular
                </div>
              )}

              <h3 className="mb-2 font-['Epilogue'] text-2xl font-bold text-[#260054]">{plan.name}</h3>

              <div className="mb-1">
                <span className="text-4xl font-bold text-[#260054]">{plan.testPrice}</span>
                <span className="text-xs font-semibold text-[#4a4550]"> /mês (teste)</span>
              </div>
              <p className="mb-6 text-xs text-[#4a4550]">Preço normal: {plan.price}/mês</p>

              <div className="mb-4 rounded-xl bg-purple-50 px-4 py-2.5 text-center text-sm font-bold text-[#3d1a6e]">
                {plan.limit >= 9999 ? "Colaboradores ilimitados" : `Até ${plan.limit} colaboradores`}
              </div>

              <ul className="mb-8 flex-grow space-y-3 pt-2">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm text-[#4a4550]">
                    <span
                      className="material-symbols-outlined mt-0.5 text-base text-emerald-600"
                      style={{ fontVariationSettings: "'FILL' 1" }}
                    >
                      check_circle
                    </span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>

              <button
                onClick={() => setSelectedPlan(plan)}
                className={`w-full rounded-2xl py-4 font-bold transition-all flex items-center justify-center gap-2 shadow-md active:scale-95 ${
                  plan.popular
                    ? "bg-[#3d1a6e] text-white hover:bg-[#2D1052]"
                    : "border-2 border-[#3d1a6e] text-[#3d1a6e] hover:bg-purple-50"
                }`}
                type="button"
              >
                <span className="material-symbols-outlined text-lg">pix</span>
                Pagar com PIX (Mercado Pago)
              </button>
            </div>
          ))}
        </div>

        <p className="mt-12 max-w-md text-center text-xs text-[#4a4550]/70">
          Processamento seguro pelo Mercado Pago com liberação automática de acesso.
        </p>
      </main>

      {selectedPlan && userId && (
        <PixModal plan={selectedPlan} userId={userId} onClose={() => setSelectedPlan(null)} />
      )}
    </div>
  );
}
