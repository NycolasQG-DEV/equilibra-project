const { DomainError } = require("../../domain/workflow");
const providers = new Map();
function registerProvider(name, factory) {
  providers.set(name, factory);
}
registerProvider("groq", () => ({
  async generate(messages) {
    if (!process.env.GROQ_API_KEY || !process.env.AI_MODEL)
      throw new DomainError(
        "Configure GROQ_API_KEY e AI_MODEL no servidor.",
        503,
      );
    let response;
    try {
      response = await fetch(
        "https://api.groq.com/openai/v1/chat/completions",
        {
          method: "POST",
          signal: AbortSignal.timeout(25000),
          headers: {
            Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: process.env.AI_MODEL,
            messages,
            temperature: 0.2,
            max_completion_tokens: 3000,
            ...(process.env.AI_MODEL.startsWith("openai/gpt-oss-")
              ? { reasoning_effort: "low" }
              : {}),
          }),
        },
      );
    } catch {
      throw new DomainError(
        "IA indisponível no momento. Tente novamente.",
        503,
      );
    }
    if (!response.ok)
      throw new DomainError(
        "O provedor de IA recusou a solicitação. Confira modelo, crédito e configuração.",
        503,
      );
    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (typeof content !== "string" || !content.trim())
      throw new DomainError("A IA não retornou uma resposta utilizável.", 502);
    return content.slice(0, 14000);
  },
}));
function configuration() {
  return {
    provider: process.env.AI_PROVIDER || "groq",
    model: process.env.AI_MODEL || null,
    configured: Boolean(process.env.GROQ_API_KEY && process.env.AI_MODEL),
  };
}
function provider() {
  const factory = providers.get(process.env.AI_PROVIDER || "groq");
  if (!factory) throw new DomainError("Provedor de IA não configurado.", 503);
  return factory();
}
module.exports = { registerProvider, configuration, provider };
