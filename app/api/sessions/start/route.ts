import { NextRequest, NextResponse } from "next/server";
import { getSurveyLink, saveSession, logAuditAccess, SessionData } from "@/lib/ai/storage-mysql";
import { getNextInterviewStep } from "@/lib/ai/groq-service";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { workerName, workerRole, sector, shift, companyTime, consentGiven, linkId } = body;

    if (!linkId) {
      return NextResponse.json(
        {
          success: false,
          error: "Link de pesquisa obrigatório. É necessário um link oficial gerado pelo administrador para iniciar a coleta.",
          code: "LINK_REQUIRED",
        },
        { status: 400 }
      );
    }

    const surveyLink = await getSurveyLink(linkId);
    if (!surveyLink || surveyLink.active === false || surveyLink.used === true) {
      return NextResponse.json(
        {
          success: false,
          error: surveyLink?.used
            ? "Este link de pesquisa já foi utilizado e concluído. Cada link gerado pelo gestor é de uso único."
            : "Link de pesquisa inválido, expirado ou inativo. Apenas links oficiais ativos cadastrados no sistema pelo gestor podem ser respondidos.",
          code: surveyLink?.used ? "LINK_ALREADY_USED" : "INVALID_SURVEY_LINK",
        },
        { status: 403 }
      );
    }

    const sessionId = `ses_${Math.random().toString(36).substring(2, 10)}`;

    const inheritedSector = (surveyLink.sector && surveyLink.sector !== "all") 
      ? surveyLink.sector 
      : (sector || "Produção Geral");
    const inheritedRole = surveyLink.role || workerRole || "Operacional";

    const session: SessionData = {
      id: sessionId,
      linkId: surveyLink.id,
      createdAt: new Date().toISOString(),
      status: "in_progress",
      profile: {
        workerName: "Colaborador Anônimo",
        workerRole: inheritedRole,
        sector: inheritedSector,
        shift: shift || "1º Turno (Manhã)",
        companyTime: companyTime || "6 meses a 2 anos",
        anonymous: true,
        linkId: surveyLink.id,
      },
      lgpdConsent: {
        consentGiven: consentGiven !== false,
        consentTimestamp: new Date().toISOString(),
        legalBasis: 'LGPD Art. 7º, II (Obrigação Legal SST) e Art. 11, II, "f" (Tutela da Saúde) c/c Art. 13 (Pseudonimização)',
        purpose: "Avaliação preventiva de riscos psicossociais para o PGR/GRO (NR-01 item 1.5.3.3)",
        rightsChannel: "Art. 18 da LGPD disponível no menu de direitos do titular",
      },
      history: [],
      currentStepData: null,
    };

    // Gera o 1º passo com a IA
    const firstStep = await getNextInterviewStep(session);
    session.currentStepData = firstStep;

    await saveSession(session);

    await logAuditAccess({
      action: "SESSION_INITIATED",
      targetId: sessionId,
      performedBy: "COLABORADOR_COM_LINK",
      sector: session.profile.sector,
      legalBasis: session.lgpdConsent.legalBasis,
      details: `Coleta de dados iniciada e validada via link de uso único: "${surveyLink.title}" (ID: ${surveyLink.id}).`,
    });

    return NextResponse.json({
      success: true,
      sessionId,
      session,
    });
  } catch (err: any) {
    console.error("Erro ao iniciar sessão de entrevista:", err);
    return NextResponse.json(
      { error: "Erro ao iniciar sessão de entrevista." },
      { status: 500 }
    );
  }
}
