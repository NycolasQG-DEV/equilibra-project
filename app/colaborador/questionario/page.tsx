"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SurveyQuestion } from "@/types/database";
import { authenticatedFetch } from "@/lib/api-client";

const FALLBACK_QUESTIONS: SurveyQuestion[] = [
  { id: 1, text: "Com que frequência você se sente sobrecarregado(a) no trabalho?", icon: "psychology",
    options: [{ label: "Nunca", value: 0 },{ label: "Raramente", value: 1 },{ label: "Às vezes", value: 2 },{ label: "Frequentemente", value: 3 },{ label: "Sempre", value: 4 }] },
  { id: 2, text: "Você sente que tem autonomia suficiente para realizar suas tarefas?", icon: "workspace_premium",
    options: [{ label: "Totalmente", value: 0 },{ label: "Na maioria", value: 1 },{ label: "Parcialmente", value: 2 },{ label: "Raramente", value: 3 },{ label: "Nunca", value: 4 }] },
  { id: 3, text: "Como avalia o suporte emocional de colegas e gestores?", icon: "group",
    options: [{ label: "Excelente", value: 0 },{ label: "Bom", value: 1 },{ label: "Regular", value: 2 },{ label: "Insuficiente", value: 3 },{ label: "Inexistente", value: 4 }] },
  { id: 4, text: "Dificuldade para dormir por preocupações com o trabalho nos últimos 30 dias?", icon: "bedtime",
    options: [{ label: "Nenhuma", value: 0 },{ label: "1-2 vezes", value: 1 },{ label: "1x/semana", value: 2 },{ label: "Várias vezes", value: 3 },{ label: "Quase toda noite", value: 4 }] },
  { id: 5, text: "Você sente que seu trabalho é reconhecido e valorizado?", icon: "emoji_events",
    options: [{ label: "Sempre", value: 0 },{ label: "Na maioria", value: 1 },{ label: "Às vezes", value: 2 },{ label: "Raramente", value: 3 },{ label: "Nunca", value: 4 }] },
  { id: 6, text: "Nível geral de satisfação com o ambiente de trabalho?", icon: "sentiment_satisfied",
    options: [{ label: "Muito satisfeito", value: 0 },{ label: "Satisfeito", value: 1 },{ label: "Neutro", value: 2 },{ label: "Insatisfeito", value: 3 },{ label: "Muito insatisfeito", value: 4 }] },
];

function getRiskLevel(score: number, total: number) {
  const pct = (score / total) * 100;
  if (pct <= 33) return { level: "Baixo", color: "text-green-700", bg: "bg-green-50 border-green-200", icon: "check_circle", desc: "Seus indicadores estão na faixa saudável. Continue cuidando de si!" };
  if (pct <= 66) return { level: "Médio", color: "text-amber-700", bg: "bg-amber-50 border-amber-200", icon: "warning", desc: "Alguns pontos merecem atenção. Considere conversar com alguém de confiança." };
  return { level: "Alto", color: "text-red-700", bg: "bg-red-50 border-red-200", icon: "error", desc: "Indicadores sugerem estresse elevado. Recomendamos buscar apoio profissional." };
}

export default function QuestionarioPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const surveyId = searchParams.get("survey_id");

  const [questions, setQuestions] = useState<SurveyQuestion[]>([]);
  const [surveyTitle, setSurveyTitle] = useState("");
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loadingSurvey, setLoadingSurvey] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        if (surveyId) {
          const res = await authenticatedFetch(`/api/colaborador/surveys?surveyId=${surveyId}`);
          if (res.ok) {
            const data = await res.json();
            if (data.survey) {
              setSurveyTitle(data.survey.title);
              setQuestions(data.survey.questions as SurveyQuestion[]);
              setLoadingSurvey(false);
              return;
            }
          }
        }
      } catch (err) {
        console.error("Erro ao carregar questionário:", err);
      }
      setQuestions(FALLBACK_QUESTIONS);
      setLoadingSurvey(false);
    };
    load();
  }, [surveyId]);

  if (loadingSurvey || questions.length === 0) {
    return (
      <main className="flex flex-1 items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-purple-200 border-t-[#3d1a6e]" />
      </main>
    );
  }

  const q = questions[current];
  const progress = (Object.keys(answers).length / questions.length) * 100;
  const maxScore = questions.length * 4;
  const totalScore = Object.values(answers).reduce((a, b) => a + b, 0);
  const risk = getRiskLevel(totalScore, maxScore);

  const selectAnswer = (value: number) => {
    setAnswers((prev) => ({ ...prev, [q.id]: value }));
    setTimeout(() => { if (current < questions.length - 1) setCurrent(current + 1); }, 350);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    const riskLabel = risk.level === "Baixo" ? "baixo" : risk.level === "Médio" ? "medio" : "alto";

    try {
      await authenticatedFetch("/api/colaborador/responses", {
        method: "POST",
        body: JSON.stringify({
          surveyId: surveyId || null,
          surveyType: "questionario",
          answers,
          score: totalScore,
          riskLevel: riskLabel,
        }),
      });
    } catch (err) {
      console.error("Erro ao enviar respostas:", err);
    } finally {
      setSubmitting(false);
      setSubmitted(true);
    }
  };

  if (submitted) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center px-8 py-16">
        <div className={`w-full max-w-lg rounded-2xl border p-10 text-center shadow-md ${risk.bg}`}>
          <div className="mb-4 flex justify-center">
            <span className={`material-symbols-outlined text-6xl ${risk.color}`}>{risk.icon}</span>
          </div>
          <h2 className={`mb-2 font-['Epilogue'] text-2xl font-bold ${risk.color}`}>Risco Psicossocial: {risk.level}</h2>
          <p className="mb-4 text-sm text-[#4a4550]">Pontuação: {totalScore} de {maxScore}</p>
          <p className={`mb-8 text-base ${risk.color}`}>{risk.desc}</p>
          <div className="flex flex-col gap-3">
            <button onClick={() => router.push("/colaborador")} className="rounded-xl bg-[#3d1a6e] py-4 font-bold text-white hover:bg-[#2D1052] transition-colors" type="button">Voltar ao Dashboard</button>
            <button onClick={() => router.push("/colaborador/chat")} className="rounded-xl border-2 border-[#3d1a6e] py-4 font-bold text-[#3d1a6e] hover:bg-purple-50 transition-colors" type="button">Conversar com a IA</button>
          </div>
        </div>
        <p className="mt-6 max-w-md text-center text-xs text-[#4a4550]/60">Suas respostas são 100% anônimas e protegidas pela LGPD.</p>
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col items-center px-8 py-12">
      {surveyTitle && <p className="mb-2 text-sm font-semibold text-[#6b538c]">{surveyTitle}</p>}
      <div className="mb-8 w-full max-w-2xl">
        <div className="mb-2 flex items-center justify-between text-sm text-[#4a4550]">
          <span>Pergunta {current + 1} de {questions.length}</span>
          <span>{Math.round(progress)}% concluído</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-purple-100">
          <div className="h-full rounded-full bg-gradient-to-r from-[#3d1a6e] to-[#6b538c] transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div className="w-full max-w-2xl rounded-2xl border border-purple-100 bg-white p-10 shadow-md">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-100 text-[#3d1a6e]">
            <span className="material-symbols-outlined text-2xl">{q.icon}</span>
          </div>
          <span className="text-xs font-bold uppercase tracking-widest text-[#4a4550]">Pergunta {current + 1}</span>
        </div>
        <h2 className="mb-8 font-['Epilogue'] text-xl font-bold text-[#260054]">{q.text}</h2>
        <div className="space-y-3">
          {q.options.map((opt) => {
            const selected = answers[q.id] === opt.value;
            return (
              <button key={opt.value} onClick={() => selectAnswer(opt.value)} type="button"
                className={`w-full rounded-xl border-2 px-5 py-4 text-left text-sm font-medium transition-all ${
                  selected ? "border-[#3d1a6e] bg-[#3d1a6e] text-white shadow-md" : "border-purple-200 bg-[#F8F6FB] text-[#260054] hover:border-[#6b538c] hover:bg-purple-50"
                }`}>{opt.label}</button>
            );
          })}
        </div>
      </div>

      <div className="mt-8 flex w-full max-w-2xl items-center justify-between">
        <button onClick={() => setCurrent(Math.max(0, current - 1))} disabled={current === 0}
          className="flex items-center gap-1 rounded-lg px-4 py-2 text-sm font-semibold text-[#4a4550] hover:bg-purple-50 disabled:opacity-30 transition-all" type="button">
          <span className="material-symbols-outlined text-lg">chevron_left</span>Anterior
        </button>
        {current === questions.length - 1 && Object.keys(answers).length === questions.length ? (
          <button onClick={handleSubmit} disabled={submitting}
            className="flex items-center gap-2 rounded-xl bg-[#3d1a6e] px-8 py-3 font-bold text-white hover:bg-[#2D1052] transition-colors disabled:opacity-60" type="button">
            {submitting ? <span className="flex items-center gap-2"><span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />Enviando...</span> : <>Enviar Respostas<span className="material-symbols-outlined">check</span></>}
          </button>
        ) : (
          <button onClick={() => setCurrent(Math.min(questions.length - 1, current + 1))} disabled={!(q.id in answers)}
            className="flex items-center gap-1 rounded-lg px-4 py-2 text-sm font-semibold text-[#3d1a6e] hover:bg-purple-50 disabled:opacity-30 transition-all" type="button">
            Próxima<span className="material-symbols-outlined text-lg">chevron_right</span>
          </button>
        )}
      </div>
    </main>
  );
}
