"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { authenticatedFetch } from "@/lib/api-client";
import { PlanType } from "@/types/database";

const PLANS: { id: PlanType; name: string; price: string; testPrice: string; limit: number; features: string[]; popular?: boolean }[] = [
  { id: "starter", name: "Starter", price: "R$ 99", testPrice: "R$ 0,50", limit: 10,
    features: ["Até 10 colaboradores", "Chat com IA", "Questionário NR-1", "Relatórios básicos", "Suporte por e-mail"] },
  { id: "professional", name: "Professional", price: "R$ 249", testPrice: "R$ 0,50", limit: 50, popular: true,
    features: ["Até 50 colaboradores", "Chat com IA avançado", "Questionário NR-1 personalizado", "Relatórios completos", "Dashboard analítico", "Suporte prioritário"] },
  { id: "enterprise", name: "Enterprise", price: "R$ 499", testPrice: "R$ 0,50", limit: 9999,
    features: ["Colaboradores ilimitados", "Chat com IA premium", "Questionários ilimitados", "Relatórios avançados + exportação", "API de integração", "Gerente de conta dedicado"] },
];

function PixModal({ plan, userId, onClose }: { plan: typeof PLANS[0]; userId: string; onClose: () => void }) {
  const router = useRouter();
  const [step, setStep] = useState<"loading" | "pix" | "confirming" | "done">("loading");
  const [error, setError] = useState("");
  const [brCode, setBrCode] = useState("");
  const [qrImage, setQrImage] = useState("");
  const [paymentId, setPaymentId] = useState("");
  const [autoVerify, setAutoVerify] = useState(false);
  const [copied, setCopied] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const create = async () => {
      try {
        const res = await authenticatedFetch("/api/payments/create-pix", {
          method: "POST", body: JSON.stringify({ userId, plan: plan.id }),
        });
        const data = await res.json();
        if (!res.ok) { setError(data.error || "Erro ao gerar PIX."); setStep("pix"); return; }
        setBrCode(data.brCode || "");
        setQrImage(data.qrCodeImage || "");
        setPaymentId(data.paymentId || "");
        setAutoVerify(data.autoVerify || false);
        setStep("pix");
      } catch { setError("Erro de conexão."); setStep("pix"); }
    };
    create();
  }, [userId, plan.id]);

  // Auto-poll Asaas for payment status
  useEffect(() => {
    if (!autoVerify || !paymentId || step === "done") return;
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/payments/status?paymentId=${paymentId}&userId=${userId}&plan=${plan.id}`);
        const data = await res.json();
        if (data.paid) {
          setStep("done");
          if (pollRef.current) clearInterval(pollRef.current);
          setTimeout(() => router.push("/admin"), 2000);
        }
      } catch { /* ignore */ }
    }, 4000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [autoVerify, paymentId, step, userId, plan.id, router]);

  const confirmPayment = async () => {
    setStep("confirming");
    try {
      const res = await authenticatedFetch("/api/payments/confirm", {
        method: "POST", body: JSON.stringify({ userId, plan: plan.id, txId: paymentId }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Erro."); setStep("pix"); return; }
      setStep("done");
      setTimeout(() => router.push("/admin"), 2000);
    } catch { setError("Erro de conexão."); setStep("pix"); }
  };

  const copyCode = () => {
    if (brCode) { navigator.clipboard.writeText(brCode); setCopied(true); setTimeout(() => setCopied(false), 3000); }
  };

  if (step === "done") {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
        <div className="w-full max-w-md rounded-2xl bg-white p-10 text-center shadow-2xl">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100">
            <span className="material-symbols-outlined text-5xl text-emerald-600" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
          </div>
          <h3 className="text-2xl font-bold text-[#260054]">Pagamento Confirmado!</h3>
          <p className="mt-2 text-sm text-[#4a4550]">Plano {plan.name} ativado. Redirecionando...</p>
          <div className="mt-4 h-1 w-full overflow-hidden rounded-full bg-purple-100">
            <div className="h-full animate-pulse rounded-full bg-emerald-500" style={{ width: "100%" }} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl border border-purple-200 bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="border-b border-purple-100 px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-[#260054]">Pagamento via PIX</h3>
              <p className="text-xs text-[#4a4550]">Plano {plan.name} — {plan.testPrice}</p>
            </div>
            <button onClick={onClose} className="text-[#4a4550] hover:text-[#260054]" type="button">
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>
        </div>
        <div className="px-8 py-6">
          {step === "loading" ? (
            <div className="flex flex-col items-center gap-4 py-10">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-purple-200 border-t-[#3d1a6e]" />
              <p className="text-sm text-[#4a4550]">Gerando QR Code PIX...</p>
            </div>
          ) : error && !brCode ? (
            <div className="py-6 text-center">
              <span className="material-symbols-outlined text-4xl text-red-400">error</span>
              <p className="mt-2 text-sm text-red-600">{error}</p>
              <button onClick={onClose} className="mt-4 rounded-xl border border-purple-200 px-6 py-2 text-sm font-semibold text-[#4a4550] hover:bg-purple-50" type="button">Fechar</button>
            </div>
          ) : (
            <div className="space-y-5">
              {qrImage && (
                <div className="flex flex-col items-center">
                  <div className="rounded-2xl border-2 border-purple-100 bg-white p-3 shadow-sm">
                    <img src={qrImage} alt="QR Code PIX" className="h-48 w-48" />
                  </div>
                  <p className="mt-3 text-sm font-semibold text-[#260054]">Escaneie com o app do seu banco</p>
                </div>
              )}
              {brCode && (
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-[#4a4550]">PIX Copia e Cola</label>
                  <div className="mt-1 flex items-center gap-2">
                    <input className="flex-1 rounded-xl border border-purple-200 bg-purple-50 px-3 py-3 text-[10px] font-mono text-[#4a4550] outline-none" value={brCode} readOnly />
                    <button onClick={copyCode}
                      className={`flex shrink-0 items-center gap-1 rounded-xl px-4 py-3 text-sm font-semibold transition-all ${copied ? "bg-emerald-100 text-emerald-700" : "bg-[#3d1a6e] text-white hover:bg-[#2D1052]"}`} type="button">
                      <span className="material-symbols-outlined text-base">{copied ? "check" : "content_copy"}</span>
                      {copied ? "Copiado!" : "Copiar"}
                    </button>
                  </div>
                </div>
              )}

              {autoVerify ? (
                <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4">
                  <div className="h-3 w-3 animate-pulse rounded-full bg-emerald-500" />
                  <div>
                    <p className="text-sm font-semibold text-emerald-800">Verificação automática ativa</p>
                    <p className="text-xs text-emerald-700">Pague o PIX e o plano será ativado automaticamente.</p>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4">
                    <div className="h-3 w-3 animate-pulse rounded-full bg-amber-500" />
                    <div>
                      <p className="text-sm font-semibold text-amber-800">Aguardando pagamento</p>
                      <p className="text-xs text-amber-700">Após pagar, clique no botão abaixo.</p>
                    </div>
                  </div>
                  <button onClick={confirmPayment} disabled={step === "confirming"}
                    className="w-full rounded-xl bg-emerald-600 py-4 font-bold text-white transition-all hover:bg-emerald-700 disabled:opacity-60 flex items-center justify-center gap-2" type="button">
                    {step === "confirming" ? (
                      <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />Ativando...</>
                    ) : (
                      <><span className="material-symbols-outlined">verified</span>Já paguei — Ativar plano</>
                    )}
                  </button>
                </>
              )}

              <div className="rounded-xl bg-purple-50 px-4 py-3 text-xs text-[#4a4550]">
                <div className="flex items-center gap-2 font-semibold text-[#6b538c]">
                  <span className="material-symbols-outlined text-sm">lock</span>
                  {autoVerify ? "PIX via Asaas — Verificação automática" : "PIX direto — Sem taxas"}
                </div>
                <p className="mt-1">Valor: <strong>R$ 0,50</strong> (preço de teste)</p>
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
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace("/"); return; }
      const { data: userData } = await supabase.from("users").select("plan, role").eq("id", session.user.id).single();
      if (userData?.plan && userData.plan !== "none") { router.replace("/admin"); return; }
      if (!userData) {
        await supabase.from("users").upsert([{
          id: session.user.id, name: session.user.user_metadata?.name || session.user.email?.split("@")[0] || "Usuário",
          email: session.user.email || "", role: "admin", plan: "none", max_colaboradores: 0,
        }], { onConflict: "id" });
      }
      setUserId(session.user.id); setLoading(false);
    };
    check();
  }, [router]);

  if (loading) return <div className="flex min-h-screen items-center justify-center bg-[#F8F6FB]"><div className="h-10 w-10 animate-spin rounded-full border-4 border-purple-200 border-t-[#3d1a6e]" /></div>;

  return (
    <div className="flex min-h-screen flex-col bg-[#F8F6FB]">
      <header className="flex items-center justify-between border-b border-purple-100 px-8 py-5">
        <span className="font-['Epilogue'] text-2xl font-bold tracking-tight text-purple-900">EQUILIBRA</span>
        <button onClick={async () => { await supabase.auth.signOut(); router.replace("/"); }} className="text-sm text-purple-600 hover:underline" type="button">Sair</button>
      </header>
      <main className="flex flex-1 flex-col items-center px-8 py-16">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-[#eddcff] px-4 py-1 text-xs font-bold uppercase tracking-widest text-purple-900">
          <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>rocket_launch</span>COMECE AGORA
        </div>
        <h1 className="mb-4 text-center font-['Epilogue'] text-4xl font-bold text-[#260054] lg:text-5xl">Escolha o plano ideal<br />para sua empresa</h1>
        <p className="mb-12 max-w-xl text-center text-lg text-[#4a4550]">Todos os planos incluem acesso completo. Pagamento via PIX — sem taxas.</p>
        <div className="grid w-full max-w-5xl gap-8 md:grid-cols-3">
          {PLANS.map((plan) => (
            <div key={plan.id} className={`relative flex flex-col rounded-2xl border-2 bg-white p-8 shadow-md transition-all hover:shadow-xl ${plan.popular ? "border-[#3d1a6e] scale-[1.03]" : "border-purple-200"}`}>
              {plan.popular && <div className="absolute -top-4 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-[#3d1a6e] to-[#6b538c] px-5 py-1 text-xs font-bold uppercase tracking-widest text-white shadow-lg">Mais Popular</div>}
              <h3 className="mb-2 font-['Epilogue'] text-xl font-bold text-[#260054]">{plan.name}</h3>
              <div className="mb-1"><span className="text-4xl font-bold text-[#260054]">{plan.testPrice}</span><span className="text-sm text-[#4a4550]"> (teste)</span></div>
              <p className="mb-6 text-xs text-[#4a4550]">Preço normal: {plan.price}/mês</p>
              <div className="mb-2 rounded-lg bg-purple-50 px-4 py-2 text-center text-sm font-semibold text-[#3d1a6e]">{plan.limit >= 9999 ? "Colaboradores ilimitados" : `Até ${plan.limit} colaboradores`}</div>
              <ul className="mb-8 flex-grow space-y-3 pt-4">
                {plan.features.map((f) => (<li key={f} className="flex items-start gap-2 text-sm text-[#4a4550]"><span className="material-symbols-outlined mt-0.5 text-base text-green-600" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>{f}</li>))}
              </ul>
              <button onClick={() => setSelectedPlan(plan)} className={`w-full rounded-xl py-4 font-bold transition-all flex items-center justify-center gap-2 ${plan.popular ? "bg-gradient-to-b from-[#3d1a6e] to-[#2D1052] text-white shadow-lg hover:shadow-xl" : "border-2 border-[#3d1a6e] text-[#3d1a6e] hover:bg-purple-50"}`} type="button">
                <span className="material-symbols-outlined text-lg">pix</span>Pagar com PIX
              </button>
            </div>
          ))}
        </div>
        <p className="mt-12 max-w-md text-center text-xs text-[#4a4550]/60">PIX via Mercado Pago — verificação automática. Valor de teste: R$ 0,50.</p>
      </main>
      {selectedPlan && userId && <PixModal plan={selectedPlan} userId={userId} onClose={() => setSelectedPlan(null)} />}
    </div>
  );
}
