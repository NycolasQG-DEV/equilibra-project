"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { LIKERT, Question } from "@/lib/product/shared";
import { useExternalLibs } from "@/hooks/useExternalLibs";

export default function RespondPage() {
  const params = useParams<{ token: string }>();
  const token = params.token;
  const [survey, setSurvey] = useState<{ title: string; sector: string; questions: Question[] } | null>(null);
  const [answers, setAnswers] = useState<Record<string, number | string | null>>({});
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) return;
    fetch(`/api/product/public/${encodeURIComponent(token)}`, { cache: "no-store" })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "Não foi possível carregar a pesquisa.");
        setSurvey(d);
      })
      .catch((e) => setError(e.message));
  }, [token]);

  useExternalLibs(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    let lenis: InstanceType<typeof window.Lenis> | null = null;
    let frame = 0;
    const stop = () => {
      cancelAnimationFrame(frame);
      lenis?.destroy();
      lenis = null;
    };
    if (!preference.matches && typeof window.Lenis === "function") {
      lenis = new window.Lenis({ duration: 1.2, smoothWheel: true });
      const tick = (time: number) => {
        lenis?.raf(time);
        frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    }

    const anime = window.anime;
    if (typeof anime === "function") {
      anime({
        targets: ".resp-reveal",
        translateY: [20, 0],
        opacity: [0, 1],
        delay: anime.stagger(80, { start: 100 }),
        duration: 700,
        easing: "easeOutExpo",
      });
    }

    return () => {
      stop();
    };
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/product/public/${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ consent, answers }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Falha ao registrar suas respostas.");
      setDone(true);
      setAnswers({});
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const answeredCount = survey?.questions
    ? survey.questions.filter((q) => answers[q.id] !== undefined && answers[q.id] !== "").length
    : 0;
  const totalQuestions = survey?.questions?.length || 0;
  const progressPercent = totalQuestions > 0 ? Math.round((answeredCount / totalQuestions) * 100) : 0;

  return (
    <main className="min-h-screen bg-[#0a0714] text-slate-100 selection:bg-indigo-500 selection:text-white pb-20 pt-8 px-4 sm:px-6">
      {/* Background ambient lighting */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[700px] h-[500px] bg-gradient-to-br from-indigo-900/25 via-blue-900/15 to-transparent rounded-full blur-3xl" />
        <div className="absolute bottom-10 right-10 w-[450px] h-[450px] bg-gradient-to-tr from-cyan-950/20 to-transparent rounded-full blur-3xl" />
      </div>

      <div className="mx-auto max-w-2xl space-y-6">
        {/* Brand & Header */}
        <header className="resp-reveal rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 h-32 w-32 bg-indigo-500/10 rounded-full blur-2xl" />
          <div className="flex items-center gap-2.5 text-xs font-semibold uppercase tracking-widest text-indigo-400">
            <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            EQUILIBRA · ESPAÇO SEGURO
          </div>
          <h1 className="mt-3 text-2xl sm:text-3xl font-bold tracking-tight text-white">
            {survey?.title || "Pesquisa de Clima e Condições de Trabalho"}
          </h1>
          {survey && (
            <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-slate-300">
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-white/5 px-3 py-1 border border-white/10 text-xs font-medium">
                <span className="material-symbols-outlined text-sm text-indigo-400">domain</span>
                Setor: {survey.sector}
              </span>
              <span className="inline-flex items-center gap-1.5 text-xs text-slate-400">
                <span className="material-symbols-outlined text-sm text-emerald-400">lock</span>
                Respostas 100% anônimas
              </span>
            </div>
          )}

          {/* Progress bar when survey is loaded */}
          {survey && !done && (
            <div className="mt-6 pt-5 border-t border-white/10">
              <div className="flex justify-between text-xs font-medium text-slate-400 mb-2">
                <span>Progresso do questionário</span>
                <span className="text-indigo-300 font-semibold">{progressPercent}%</span>
              </div>
              <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-indigo-500 to-emerald-400 transition-all duration-300 rounded-full"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          )}
        </header>

        {error && (
          <div
            role="alert"
            className="resp-reveal rounded-2xl border border-red-500/30 bg-red-950/40 p-4 text-red-200 text-sm flex items-start gap-3 backdrop-blur-md"
          >
            <span className="material-symbols-outlined text-red-400 text-xl shrink-0">error</span>
            <div>
              <p className="font-semibold">Aviso</p>
              <p className="mt-0.5 text-xs text-red-300">{error}</p>
            </div>
          </div>
        )}

        {done ? (
          <section className="resp-reveal rounded-3xl border border-emerald-500/20 bg-emerald-950/20 backdrop-blur-xl p-8 text-center space-y-4">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <span className="material-symbols-outlined text-3xl">task_alt</span>
            </div>
            <h2 className="text-2xl font-bold text-white">Contribuição Registrada com Sucesso!</h2>
            <p className="text-sm text-slate-300 max-w-md mx-auto leading-relaxed">
              Obrigado pelo seu tempo e honestidade. Sua voz é fundamental para aprimorarmos continuamente o ambiente de trabalho e as diretrizes de bem-estar.
            </p>
            <div className="pt-4">
              <span className="inline-block text-xs text-slate-400 bg-white/5 border border-white/10 px-4 py-2 rounded-full">
                Este link individual de resposta foi concluído e encerrado com segurança.
              </span>
            </div>
          </section>
        ) : survey ? (
          <form onSubmit={submit} className="space-y-6">
            {/* Termo e Consentimento */}
            <section className="resp-reveal rounded-3xl border border-white/10 bg-white/[0.02] backdrop-blur-xl p-6 sm:p-7 shadow-lg">
              <div className="flex items-center gap-2 text-indigo-300 font-semibold text-sm mb-3">
                <span className="material-symbols-outlined text-lg">shield_with_heart</span>
                Diretrizes de Confidencialidade
              </div>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                Sua participação é estritamente confidencial e voluntária. Todos os dados são agregados estatisticamente para gerar diagnósticos e planos de melhoria das condições operacionais e ergonômicas, sem qualquer identificação individual.
              </p>
              <label className="mt-5 flex items-start gap-3 cursor-pointer select-none rounded-xl bg-white/[0.04] p-3.5 border border-white/10 hover:border-indigo-500/40 transition-colors">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-white/20 bg-slate-800 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-0"
                />
                <span className="text-xs sm:text-sm text-slate-200 font-medium">
                  Compreendo a natureza confidencial da pesquisa e concordo em participar.
                </span>
              </label>
            </section>

            {/* Perguntas */}
            {survey.questions.map((q, i) => {
              const currentVal = answers[q.id];
              return (
                <fieldset
                  key={q.id}
                  className="resp-reveal rounded-3xl border border-white/10 bg-white/[0.02] backdrop-blur-xl p-6 sm:p-7 shadow-lg transition-all hover:border-white/20"
                >
                  <legend className="sr-only">Pergunta {i + 1}</legend>
                  <div className="flex items-start gap-3 mb-4">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-indigo-500/20 text-indigo-300 text-xs font-bold border border-indigo-500/30">
                      {i + 1}
                    </span>
                    <p className="font-semibold text-slate-100 text-sm sm:text-base leading-snug">
                      {q.text}
                    </p>
                  </div>

                  {q.type === "likert" ? (
                    <div className="space-y-2 mt-4">
                      <div className="grid gap-2 sm:grid-cols-2">
                        {LIKERT.map((label, n) => {
                          const val = n + 1;
                          const isSelected = currentVal === val;
                          return (
                            <label
                              key={label}
                              className={`flex min-h-12 items-center gap-3 rounded-2xl border px-4 py-2.5 text-xs sm:text-sm font-medium cursor-pointer transition-all ${
                                isSelected
                                  ? "border-indigo-400 bg-indigo-500/20 text-white shadow-lg shadow-indigo-900/30"
                                  : "border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.06] hover:border-white/20"
                              }`}
                            >
                              <input
                                type="radio"
                                name={q.id}
                                checked={isSelected}
                                onChange={() => setAnswers((old) => ({ ...old, [q.id]: val }))}
                                className="sr-only"
                              />
                              <span
                                className={`h-4 w-4 rounded-full border flex items-center justify-center shrink-0 transition-colors ${
                                  isSelected
                                    ? "border-indigo-400 bg-indigo-500"
                                    : "border-white/30 bg-transparent"
                                }`}
                              >
                                {isSelected && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                              </span>
                              <span>{label}</span>
                            </label>
                          );
                        })}
                      </div>
                      <div className="pt-2 flex justify-end">
                        <button
                          type="button"
                          onClick={() => setAnswers((old) => ({ ...old, [q.id]: null }))}
                          className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                            currentVal === null
                              ? "border-amber-400/40 bg-amber-500/10 text-amber-300"
                              : "border-transparent text-slate-400 hover:text-slate-200"
                          }`}
                        >
                          Prefiro não responder esta questão
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-3">
                      <textarea
                        maxLength={1200}
                        rows={4}
                        value={String(answers[q.id] ?? "")}
                        onChange={(e) => setAnswers((old) => ({ ...old, [q.id]: e.target.value }))}
                        placeholder="Escreva sua percepção ou sugestão de forma construtiva (opcional)..."
                        className="w-full rounded-2xl border border-white/10 bg-black/20 p-4 text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400 transition-colors"
                      />
                      <div className="mt-1 flex justify-between text-[11px] text-slate-400 px-1">
                        <span>Livre de dados pessoais</span>
                        <span>{String(answers[q.id] ?? "").length} / 1200</span>
                      </div>
                    </div>
                  )}
                </fieldset>
              );
            })}

            {/* Submit button */}
            <div className="resp-reveal pt-4">
              <button
                type="submit"
                disabled={!consent || busy}
                className="w-full rounded-2xl bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 px-6 py-4 font-semibold text-white shadow-xl shadow-indigo-950/50 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center gap-2"
              >
                {busy ? (
                  <>
                    <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    <span>Gravando respostas com segurança...</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-xl">send</span>
                    <span>Concluir e Enviar Respostas</span>
                  </>
                )}
              </button>
            </div>
          </form>
        ) : !error ? (
          <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-12 text-center text-slate-400 flex flex-col items-center justify-center space-y-4">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
            <p className="text-sm font-medium">Carregando formulário seguro de pesquisa...</p>
          </div>
        ) : null}
      </div>
    </main>
  );
}
