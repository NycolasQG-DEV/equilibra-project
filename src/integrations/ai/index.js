const { DomainError } = require("../../domain/workflow");
const providers = new Map();

function registerProvider(name, factory) {
  providers.set(name, factory);
}

registerProvider("groq", () => ({
  async generate(messages) {
    if (!process.env.GROQ_API_KEY) {
      throw new DomainError(
        "Configure GROQ_API_KEY no servidor.",
        503,
      );
    }
    const model = process.env.AI_MODEL || "llama-3.3-70b-versatile";
    const baseUrl = (
      process.env.GROQ_BASE_URL || "https://api.groq.com/openai/v1"
    ).replace(/\/+$/, "");

    let response;
    try {
      response = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        signal: AbortSignal.timeout(25000),
        headers: {
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: 0.2,
          max_tokens: 3000,
          ...(model.startsWith("openai/gpt-oss-")
            ? { reasoning_effort: "low" }
            : {}),
        }),
      });
    } catch {
      throw new DomainError(
        "IA indisponível no momento. Tente novamente.",
        503,
      );
    }
    if (!response.ok) {
      let detail = "";
      try {
        const errJson = await response.json();
        detail = errJson.error?.message || errJson.message || "";
      } catch {}
      throw new DomainError(
        `O provedor de IA recusou a solicitação${detail ? ": " + detail : ". Confira modelo, crédito e configuração."}`,
        503,
      );
    }
    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (typeof content !== "string" || !content.trim()) {
      throw new DomainError("A IA não retornou uma resposta utilizável.", 502);
    }
    return content.slice(0, 14000);
  },
}));

function configuration() {
  const currentProvider = process.env.AI_PROVIDER || "groq";
  return {
    provider: currentProvider,
    model: process.env.AI_MODEL || "llama-3.3-70b-versatile",
    configured: Boolean(process.env.GROQ_API_KEY && process.env.AI_MODEL),
  };
}

function provider() {
  const factory = providers.get(process.env.AI_PROVIDER || "groq");
  if (!factory) throw new DomainError("Provedor de IA não configurado.", 503);
  return factory();
}

module.exports = { registerProvider, configuration, provider };
