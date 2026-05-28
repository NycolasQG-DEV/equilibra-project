import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { verifyAuth, isAuthError } from "@/lib/auth-guard";

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_BASE_URL = process.env.GROQ_BASE_URL || "https://api.groq.com/openai/v1";
const GROQ_CHAT_MODEL = process.env.GROQ_CHAT_MODEL || "llama-3.1-8b-instant";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { adminId, messages } = body;

    if (!adminId || !messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: "adminId e messages são obrigatórios." },
        { status: 400 }
      );
    }

    // 1. Authenticate the admin caller
    const auth = await verifyAuth(request, adminId);
    if (isAuthError(auth)) return auth;

    // 2. Fetch context data concurrently
    const [
      { data: adminProfile },
      { data: colabs },
      { data: surveys },
      { data: responses },
    ] = await Promise.all([
      supabaseAdmin
        .from("users")
        .select("id, name, email, plan, max_colaboradores, company_name")
        .eq("id", adminId)
        .single(),
      supabaseAdmin
        .from("users")
        .select("id, name, email, cargo, setor")
        .eq("admin_id", adminId)
        .eq("role", "default"),
      supabaseAdmin
        .from("surveys")
        .select("id, title, is_active, questions")
        .eq("admin_id", adminId),
      supabaseAdmin
        .from("responses")
        .select("id, score, risk_level, created_at, user_id, survey_id")
        .eq("admin_id", adminId),
    ]);

    if (!adminProfile) {
      return NextResponse.json(
        { error: "Perfil de administrador não encontrado." },
        { status: 404 }
      );
    }

    // 3. Compile context prompt
    const colabsList = (colabs || [])
      .map(
        (c: any) =>
          `- ${c.name} (${c.setor || "Sem setor"} / ${c.cargo || "Sem cargo"})`
      )
      .join("\n");

    const surveysList = (surveys || [])
      .map(
        (s: any) => `- "${s.title}" (Ativa: ${s.is_active ? "Sim" : "Não"})`
      )
      .join("\n");

    const responsesList = (responses || [])
      .map((r: any) => {
        const c = (colabs || []).find((c: any) => c.id === r.user_id);
        const s = (surveys || []).find((s: any) => s.id === r.survey_id);
        return `- Colaborador: ${c?.name || "Desconhecido"} | Pesquisa: "${s?.title || "Desconhecida"}" | Score: ${r.score} | Risco: ${r.risk_level}`;
      })
      .join("\n");

    const systemPrompt = `Você é a Assistente de Inteligência da EQUILIBRA (chamada Equilibra IA), focada em ajudar o Administrador a compreender dados psicossociais, riscos no trabalho (NR-1) e engajamento da equipe.
Você tem acesso aos dados reais da conta:

DADOS DA EMPRESA:
- Administrador: ${adminProfile.name}
- Empresa: ${adminProfile.company_name || "Não informada"}
- Plano: ${adminProfile.plan}

COLABORADORES (${(colabs || []).length}):
${colabsList || "Nenhum cadastrado"}

PESQUISAS (${(surveys || []).length}):
${surveysList || "Nenhuma"}

RESPOSTAS RECENTES (${(responses || []).length}):
${responsesList || "Nenhuma"}

DIRETRIZES DE RESPOSTA (MUITO IMPORTANTE):
1. Seja empática, profissional, concisa e analítica. Fale sobre os dados acima para oferecer recomendações úteis.
2. NUNCA envie um "textão". Divida sempre a sua resposta em múltiplos balões pequenos usando a palavra exata [SPLIT] como separador entre eles.
3. Cada parte entre um [SPLIT] e outro será renderizada como um balão de conversa separado. Coloque no máximo 2 ou 3 frases curtas por balão.
Exemplo de formato esperado:
Olá! Vi que o setor de Marketing tem 2 colaboradores com risco alto. [SPLIT] Recomendo agendarmos uma nova pesquisa focada em estresse. [SPLIT] Gostaria de ver o detalhamento do score dessas respostas?`;

    // 4. Format messages for OpenAI/Groq API
    const apiMessages = [
      { role: "system" as const, content: systemPrompt },
      ...messages.map((m: any) => ({
        role:
          m.role === "ai" || m.role === "assistant"
            ? ("assistant" as const)
            : ("user" as const),
        content: m.content || m.text,
      })),
    ];

    if (!GROQ_API_KEY) {
      console.warn(
        "GROQ_API_KEY não encontrada, usando resposta de fallback."
      );
      return NextResponse.json({
        text: "Desculpe, a chave da API da IA não está configurada no servidor. [SPLIT] Por favor, adicione GROQ_API_KEY ao .env.local",
      });
    }

    // 5. Fetch completion from Groq
    const res = await fetch(`${GROQ_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: GROQ_CHAT_MODEL,
        messages: apiMessages,
        temperature: 0.7,
        max_tokens: 1500,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("Erro na API da Groq:", res.status, errText);
      return NextResponse.json(
        { error: "Erro ao consultar provedor de IA." },
        { status: 502 }
      );
    }

    const data = await res.json();
    const aiText =
      data.choices?.[0]?.message?.content || "Sem resposta.";

    return NextResponse.json({ text: aiText });
  } catch (error: any) {
    console.error("Erro interno no chat IA:", error);
    return NextResponse.json(
      { error: "Erro interno no servidor." },
      { status: 500 }
    );
  }
}
