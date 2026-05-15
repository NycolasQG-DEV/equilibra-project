"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useExternalLibs } from "@/hooks/useExternalLibs";
import { SurveyAssignment } from "@/types/database";

export default function ColaboradorPage() {
  const router = useRouter();
  const [pending, setPending] = useState<(SurveyAssignment & { surveys: { title: string; description: string } }) | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const check = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data } = await supabase
        .from("survey_assignments")
        .select("*, surveys(title, description)")
        .eq("user_id", session.user.id)
        .eq("status", "pending")
        .limit(1)
        .maybeSingle();
      if (data) setPending(data as any);
      setChecked(true);
    };
    check();
  }, []);

  useExternalLibs(() => {
    const anime = window.anime;
    const tl = anime.timeline({ easing: "easeOutExpo" });
    tl.add({ targets: ".ob-orb", scale: [0, 1], opacity: [0, 0.35], duration: 1500 }, 0)
      .add({ targets: ".ob-logo", scale: [0.4, 1], opacity: [0, 1], duration: 900 }, 300)
      .add({ targets: ".ob-greet", opacity: [0, 1], translateY: [30, 0], duration: 700 }, 900)
      .add({ targets: ".ob-sub", opacity: [0, 1], translateY: [20, 0], duration: 600 }, 1300)
      .add({ targets: ".ob-div", scaleX: [0, 1], opacity: [0, 1], duration: 500 }, 1900)
      .add({ targets: ".ob-info", opacity: [0, 1], translateY: [40, 0], duration: 800 }, 2400)
      .add({ targets: ".ob-priv", opacity: [0, 1], translateY: [40, 0], duration: 800 }, 3200)
      .add({ targets: ".ob-cta", opacity: [0, 1], scale: [0.9, 1], duration: 600 }, 4000);
    anime({ targets: ".ob-orb", translateY: [-12, 12], duration: 3500, direction: "alternate", easing: "easeInOutSine", loop: true });
  });

  const handleStart = (surveyId: string) => {
    if (window.anime) {
      window.anime({ targets: ".ob-wrap", opacity: [1, 0], scale: [1, 1.04], duration: 450, easing: "easeInExpo",
        complete: () => router.push(`/colaborador/questionario?survey_id=${surveyId}`),
      });
    } else {
      router.push(`/colaborador/questionario?survey_id=${surveyId}`);
    }
  };

  if (!checked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0d0a17]">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-purple-900 border-t-purple-400" />
      </div>
    );
  }

  /* ── No pending survey ── */
  if (!pending) {
    return (
      <div className="ob-wrap flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-[#0d0a17] via-[#1a1230] to-[#0d0a17] px-6 relative overflow-hidden">
        <div className="ob-orb absolute -top-20 -left-20 h-72 w-72 rounded-full bg-purple-600/10 blur-3xl" style={{ opacity: 0 }} />
        <div className="ob-orb absolute -bottom-20 -right-20 h-96 w-96 rounded-full bg-violet-500/8 blur-3xl" style={{ opacity: 0 }} />

        <div className="ob-logo mb-8 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-600 to-violet-800 shadow-2xl shadow-purple-900/50" style={{ opacity: 0 }}>
          <span className="material-symbols-outlined text-4xl text-white" style={{ fontVariationSettings: "'FILL' 1" }}>psychology</span>
        </div>

        <h1 className="ob-greet text-center font-['Epilogue'] text-4xl font-bold text-white lg:text-5xl" style={{ opacity: 0 }}>Bem-vindo(a)</h1>
        <p className="ob-sub mt-3 max-w-md text-center text-lg text-purple-200/60" style={{ opacity: 0 }}>Tudo tranquilo por aqui! 🎉</p>

        <div className="ob-div my-8 h-px w-48 bg-gradient-to-r from-transparent via-purple-500/30 to-transparent" style={{ opacity: 0 }} />

        <div className="ob-info w-full max-w-md rounded-2xl border border-purple-500/10 bg-white/[0.04] p-6 backdrop-blur-sm" style={{ opacity: 0 }}>
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400">
              <span className="material-symbols-outlined text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
            </div>
            <div>
              <h3 className="font-semibold text-white">Nenhuma pesquisa ativa</h3>
              <p className="mt-1 text-sm leading-relaxed text-purple-200/50">
                Não há pesquisas pendentes para você no momento. Quando seu gestor agendar uma nova pesquisa, ela aparecerá aqui automaticamente.
              </p>
            </div>
          </div>
        </div>

        <div className="ob-priv mt-4 flex gap-3 w-full max-w-md" style={{ opacity: 0 }}>
          <button onClick={() => router.push("/colaborador/historico")}
            className="flex-1 flex items-center justify-center gap-2 rounded-2xl border border-purple-500/20 bg-white/[0.04] px-6 py-4 font-semibold text-purple-300 backdrop-blur-sm transition-all hover:bg-white/[0.08]" type="button">
            <span className="material-symbols-outlined">history</span>Histórico
          </button>
          <button onClick={() => router.push("/colaborador/chat")}
            className="flex-1 flex items-center justify-center gap-2 rounded-2xl border border-purple-500/20 bg-white/[0.04] px-6 py-4 font-semibold text-purple-300 backdrop-blur-sm transition-all hover:bg-white/[0.08]" type="button">
            <span className="material-symbols-outlined">chat</span>Chat com IA
          </button>
        </div>

        <p className="ob-cta mt-8 text-xs text-purple-300/25" style={{ opacity: 0 }}>Suas respostas são protegidas pela LGPD</p>
      </div>
    );
  }

  /* ── Has pending survey ── */
  return (
    <div className="ob-wrap flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-[#0d0a17] via-[#1a1230] to-[#0d0a17] px-6 relative overflow-hidden">
      <div className="ob-orb absolute -top-20 -left-20 h-72 w-72 rounded-full bg-purple-600/10 blur-3xl" style={{ opacity: 0 }} />
      <div className="ob-orb absolute -bottom-20 -right-20 h-96 w-96 rounded-full bg-violet-500/8 blur-3xl" style={{ opacity: 0 }} />
      <div className="ob-orb absolute top-1/3 right-1/4 h-48 w-48 rounded-full bg-indigo-500/8 blur-3xl" style={{ opacity: 0 }} />

      <div className="ob-logo mb-8 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-600 to-violet-800 shadow-2xl shadow-purple-900/50" style={{ opacity: 0 }}>
        <span className="material-symbols-outlined text-4xl text-white" style={{ fontVariationSettings: "'FILL' 1" }}>psychology</span>
      </div>

      <h1 className="ob-greet text-center font-['Epilogue'] text-4xl font-bold text-white lg:text-5xl" style={{ opacity: 0 }}>Bem-vindo(a)</h1>
      <p className="ob-sub mt-3 max-w-md text-center text-lg text-purple-200/60" style={{ opacity: 0 }}>Estamos aqui para ouvir você de forma segura e acolhedora.</p>

      <div className="ob-div my-8 h-px w-48 bg-gradient-to-r from-transparent via-purple-500/30 to-transparent" style={{ opacity: 0 }} />

      <div className="ob-info w-full max-w-md rounded-2xl border border-purple-500/10 bg-white/[0.04] p-6 backdrop-blur-sm" style={{ opacity: 0 }}>
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-purple-500/10 text-purple-400">
            <span className="material-symbols-outlined text-2xl">timer</span>
          </div>
          <div>
            <h3 className="font-semibold text-white">{pending.surveys?.title || "Pesquisa Rápida"}</h3>
            <p className="mt-1 text-sm leading-relaxed text-purple-200/50">
              {pending.surveys?.description || "A seguir, você terá uma conversa com nossa assistente inteligente. Leva aproximadamente 5 minutos."}
            </p>
          </div>
        </div>
      </div>

      <div className="ob-priv mt-4 w-full max-w-md rounded-2xl border border-emerald-500/10 bg-white/[0.04] p-6 backdrop-blur-sm" style={{ opacity: 0 }}>
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400">
            <span className="material-symbols-outlined text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>shield</span>
          </div>
          <div>
            <h3 className="font-semibold text-white">100% Anônimo</h3>
            <p className="mt-1 text-sm leading-relaxed text-purple-200/50">
              Seus dados pessoais são <strong className="text-emerald-400">totalmente protegidos</strong>. As respostas são anônimas e tratadas em conformidade com a <strong className="text-purple-300">LGPD</strong>.
            </p>
          </div>
        </div>
      </div>

      <button className="ob-cta cta-pulse mt-10 flex items-center gap-3 rounded-2xl bg-gradient-to-r from-purple-600 to-violet-700 px-10 py-4 font-bold text-white transition-all hover:scale-[1.03] active:scale-95"
        onClick={() => handleStart(pending.survey_id)} type="button" style={{ opacity: 0 }}>
        <span className="material-symbols-outlined">assignment</span>Iniciar Pesquisa
      </button>

      <p className="ob-cta mt-4 text-xs text-purple-300/25" style={{ opacity: 0 }}>Suas respostas são protegidas pela LGPD</p>
    </div>
  );
}
