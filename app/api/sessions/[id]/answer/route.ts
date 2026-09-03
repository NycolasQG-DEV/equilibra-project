import { NextRequest, NextResponse } from "next/server";
import { getSession, saveSession } from "@/lib/ai/storage-mysql";
import { SafetyGuard } from "@/lib/ai/safety-guard";
import { getNextInterviewStep } from "@/lib/ai/groq-service";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { userAnswer, widgetType, responseDurationMs } = body;

    const session = await getSession(id);
    if (!session) {
      return NextResponse.json({ error: "Sessão não encontrada." }, { status: 404 });
    }

    if (session.status === "completed") {
      return NextResponse.json({ error: "Esta sessão já foi concluída." }, { status: 400 });
    }

    const currentStep = session.currentStepData || {};

    // Verificação de Segurança e Moderação Ético-Legal
    const safetyCheck = SafetyGuard.validateUserInput(userAnswer);
    if (!safetyCheck.isSafe) {
      const warningStep = {
        bot_statement: safetyCheck.warningStatement || "Identificamos conteúdos que necessitam de direcionamento específico aos canais formais da empresa.",
        next_question: safetyCheck.warningQuestion || "Este canal é dedicado exclusivamente ao diálogo sobre saúde, ergonomia e segurança no trabalho (NR-01) protegido pela LGPD. Gostaria de focar nas condições do seu posto?",
        ui_widget: "text_input",
        widget_options: {
          placeholder: "Descreva como é o seu dia a dia no setor...",
        },
        dimension_target: "psicossocial_organizacional",
        psychological_assessment: {
          openness_score: 2,
          fear_of_retaliation: 3,
          fatigue_level: 3,
          subtext_detected: `Alerta de moderação/segurança acionado: ${safetyCheck.reason}`,
          hidden_risk_flags: ["Alerta de Conteúdo Sensível / Diretriz de Proteção"],
        },
        ai_realtime_observation: `Aviso de conformidade emitido devido ao acionamento de filtro de segurança (${safetyCheck.reason}).`,
        is_interview_complete: false,
      };

      session.currentStepData = warningStep;
      await saveSession(session);

      return NextResponse.json({
        success: true,
        isCompleted: false,
        nextStep: warningStep,
        session,
      });
    }

    // Registra interação no histórico
    const historyItem = {
      stepNumber: (session.history || []).length + 1,
      question: currentStep.next_question || "",
      botStatement: currentStep.bot_statement || "",
      userAnswer: userAnswer,
      widgetType: widgetType || currentStep.ui_widget || "text_input",
      dimensionTarget: currentStep.dimension_target || "demandas_psicologicas",
      psychologicalAssessment: currentStep.psychological_assessment || null,
      aiObservation: currentStep.ai_realtime_observation || "",
      timestamp: new Date().toISOString(),
      durationMs: responseDurationMs || null,
    };

    session.history = [...(session.history || []), historyItem];

    // Se concluiu as dimensões ou limite de etapas
    if (currentStep.is_interview_complete || session.history.length >= 8) {
      session.status = "ready_for_report";
      await saveSession(session);

      return NextResponse.json({
        success: true,
        isCompleted: true,
        session,
      });
    }

    // Formula o próximo passo com a IA
    const rawNextStep = await getNextInterviewStep(session);
    const nextStep = SafetyGuard.validateAiOutput(rawNextStep);
    session.currentStepData = nextStep;

    await saveSession(session);

    return NextResponse.json({
      success: true,
      isCompleted: false,
      nextStep,
      session,
    });
  } catch (err: any) {
    console.error("Erro ao processar resposta:", err);
    return NextResponse.json(
      { error: "Erro ao processar resposta da entrevista." },
      { status: 500 }
    );
  }
}
