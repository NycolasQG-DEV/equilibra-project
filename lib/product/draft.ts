import Groq from "groq-sdk";
import { MASTER_QUESTIONS, Question, validateQuestions } from "./surveys";

export function masterDraft(): Question[] {
  return [
    ...MASTER_QUESTIONS,
    { id: "sugestao", type: "text", text: "Que mudança nas condições de trabalho ajudaria sua equipe? Não inclua nomes ou dados pessoais." },
  ];
}

function fallbackDraft(topic: string): Question[] {
  const focus = topic.slice(0, 90).replace(/[.?!]+$/g, "");
  return [
    { id: "carga", type: "likert", text: `Nas últimas duas semanas, com que frequência ${focus} aumentou sua carga de trabalho?` },
    { id: "clareza", type: "likert", text: "Com que frequência faltaram orientações claras sobre as prioridades do trabalho?" },
    { id: "autonomia", type: "likert", text: "Com que frequência você teve dificuldade para organizar suas tarefas e pausas?" },
    { id: "apoio", type: "likert", text: "Com que frequência faltou apoio para resolver dificuldades da rotina?" },
    { id: "respeito", type: "likert", text: "Com que frequência houve situações de desrespeito nas relações de trabalho?" },
    { id: "mudanca", type: "text", text: "Que mudança na organização do trabalho ajudaria a equipe? Não inclua nomes." },
  ];
}

export async function generateDraft(
  topic: string,
  sector = "Geral",
  sectorContext?: {
    roles?: string[];
    routineDescription?: string;
    shiftHours?: number;
    breakPolicy?: string;
    workModel?: string;
    hasOvertimeExpected?: boolean;
  }
): Promise<{ questions: Question[]; source: "ai" | "template" }> {
  if (!process.env.GROQ_API_KEY) return { questions: fallbackDraft(topic), source: "template" };
  try {
    const client = new Groq({ apiKey: process.env.GROQ_API_KEY, timeout: 14000, maxRetries: 0 });
    const systemPrompt = `Você é um especialista sênior em Ergonomia Psicossocial, Segurança e Saúde no Trabalho (NR-1/GRO) e People Analytics.
Sua missão é gerar um questionário diagnóstico anônimo e objetivo para identificar riscos psicossociais e atritos entre a ROTINA PREVISTA PELA EMPRESA e a REALIDADE VIVIDA pelos colaboradores.

Regras Estritas:
1. Responda APENAS JSON no formato: {"questions":[{"id":"q1","type":"likert","text":"..."},{"id":"q_open","type":"text","text":"..."}]}.
2. Gere exatamente entre 6 e 8 perguntas de escala de frequência (likert) e 1 pergunta aberta ao final.
3. As perguntas devem ser formuladas em português brasileiro, em tom profissional, empático e neutro.
4. As perguntas DEVEM explorar o setor, os cargos e a rotina descrita (ex: pausas, cumprimento de jornada, metas, autonomia e apoio da liderança).
5. NUNCA peça dados que identifiquem a pessoa (como nome, CPF, e-mail, idade, ou cargo exclusivo).`;

    const userPayload = {
      objetivo_pesquisa: topic,
      setor_alvo: sector,
      cargos_envolvidos: sectorContext?.roles || [],
      rotina_prevista: sectorContext?.routineDescription || "Rotina padrão do setor.",
      jornada_horas: sectorContext?.shiftHours || 8,
      politica_pausas: sectorContext?.breakPolicy || "Pausas regulamentadas.",
      modelo_trabalho: sectorContext?.workModel || "presencial",
      horas_extras_previstas: sectorContext?.hasOvertimeExpected ? "Sim" : "Não",
    };

    const response = await client.chat.completions.create({
      model: process.env.GROQ_MODEL?.trim() || "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: JSON.stringify(userPayload) },
      ],
      temperature: 0.3,
      max_completion_tokens: 1500,
      response_format: { type: "json_object" },
    });
    if (response.choices[0]?.finish_reason !== "stop") throw new Error("Resposta incompleta");
    const raw = response.choices[0]?.message?.content;
    if (!raw || raw.length > 15000) throw new Error("Resposta inválida");
    const questions = validateQuestions(JSON.parse(raw).questions);
    return { questions, source: "ai" };
  } catch {
    return { questions: fallbackDraft(topic), source: "template" };
  }
}
