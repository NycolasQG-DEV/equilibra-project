import Groq from "groq-sdk";
import {
  DIMENSIONS,
  ANSWERS,
  PROTOCOL_VERSION,
  explicitRating,
  isSkipped,
} from "./protocol";
import { SYSTEM_INTERVIEW_PROMPT } from "./prompts";
import { followupContract, minimizeText } from "./contracts";
import { PROMPT_VERSION } from "./prompts/policy";
export async function structuredCompletion<T>(
  system: string,
  data: unknown,
  validate: (value: unknown) => T,
): Promise<T | null> {
  if (!process.env.GROQ_API_KEY?.trim()) return null;
  try {
    const client = new Groq({
      apiKey: process.env.GROQ_API_KEY,
      timeout: 12000,
      maxRetries: 0,
    });
    const result = await client.chat.completions.create({
      model: process.env.GROQ_MODEL?.trim() || "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: system },
        { role: "user", content: JSON.stringify({ untrusted_data: data }) },
      ],
      temperature: 0,
      max_completion_tokens: 256,
      response_format: { type: "json_object" },
    });
    if (result.choices[0]?.finish_reason !== "stop") return null;
    const content = result.choices[0]?.message?.content;
    if (!content || content.length > 4000) return null;
    return validate(JSON.parse(content));
  } catch {
    console.warn(
      "Equilibra: resposta de IA indisponível ou rejeitada pelo contrato.",
    );
    return null;
  }
}
export async function getNextInterviewStep(session: any) {
  const history: any[] = session.history || [],
    last = history.at(-1);
  if (last?.kind === "rating" && !isSkipped(last.userAnswer)) {
    const d = DIMENSIONS.find((d) => d.id === last.dimensionTarget)!;
    const pick = await structuredCompletion(
      SYSTEM_INTERVIEW_PROMPT,
      {
        dimension: d.id,
        answer: minimizeText(last.userAnswer),
        context: minimizeText(session.profile?.context),
        options: d.followups,
      },
      followupContract,
    );
    return {
      protocol_version: PROTOCOL_VERSION,
      step_id: d.id + ":comment",
      kind: "comment",
      bot_statement: "Você pode comentar ou pular esta pergunta.",
      next_question: d.followups[pick?.followup_id ?? 0],
      ui_widget: "text_input",
      widget_options: {
        placeholder: "Sem nomes ou detalhes que identifiquem pessoas.",
      },
      dimension_target: d.id,
      is_interview_complete: false,
    };
  }
  const answered = new Set(
      history.filter((h) => h.kind === "rating").map((h) => h.dimensionTarget),
    ),
    next = DIMENSIONS.find((d) => !answered.has(d.id));
  if (!next)
    return {
      protocol_version: PROTOCOL_VERSION,
      step_id: "suggestion",
      kind: "suggestion",
      bot_statement: "Falta só uma pergunta, que também é opcional.",
      next_question: "Que mudança na rotina de trabalho ajudaria sua equipe?",
      ui_widget: "text_input",
      widget_options: {
        placeholder: "Descreva a mudança que gostaria de sugerir.",
      },
      dimension_target: "suggestion",
      is_interview_complete: true,
    };
  return {
    protocol_version: PROTOCOL_VERSION,
    step_id: next.id + ":rating",
    kind: "rating",
    bot_statement: history.length
      ? ""
      : "Olá, sou a assistente virtual da Equilibra. Vamos conversar sobre as condições do seu trabalho.",
    next_question: next.question,
    ui_widget: "choice_chips",
    widget_options: { choices: [...ANSWERS] },
    dimension_target: next.id,
    is_interview_complete: false,
  };
}
export async function generateComprehensiveReport(session: any) {
  const dimensions = Object.fromEntries(
    DIMENSIONS.map((d) => {
      const item = (session.history || []).find(
        (h: any) => h.kind === "rating" && h.dimensionTarget === d.id,
      );
      return [
        d.id,
        {
          name: d.name,
          rating: explicitRating(item?.userAnswer),
          source: "explicit_participant_choice",
        },
      ];
    }),
  );
  return {
    id: session.id,
    sessionId: session.id,
    linkId: session.linkId,
    profile: { sector: session.profile?.sector },
    createdAt: new Date().toISOString(),
    protocolVersion: PROTOCOL_VERSION,
    promptVersion: PROMPT_VERSION,
    dimensions,
    riskLevel: "not_assessed",
    confidenceScore: 0,
    executiveSummary: "Participação registrada para análise coletiva.",
    actionPlan: [],
    assessmentStatus: "pending_technical_assessment",
  };
}
