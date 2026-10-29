const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const ai = require("../src/integrations/ai");
const { explain } = require("../src/services/assistantService");

// ── helpers ────────────────────────────────────────────────────────────────

function makeMockServer(responseContent) {
  const server = http.createServer((req, res) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          choices: [{ message: { role: "assistant", content: responseContent } }],
        }),
      );
    });
  });
  return server;
}

const BASE_REPORT = {
  id: "rep-test",
  published: true,
  responseCount: 15,
  instrument: {
    id: "percepcao-exploratoria",
    name: "Percepção do trabalho",
    limitation: "Instrumento exploratório. Sem causalidade demonstrada.",
    factors: [
      ["demandas", "Demandas", "Consigo lidar com o volume de trabalho."],
      ["autonomia", "Autonomia", "Tenho autonomia para organizar meu trabalho."],
    ],
  },
  result: [
    { key: "demandas", label: "Demandas", average: 2.3 },
    { key: "autonomia", label: "Autonomia", average: 3.9 },
  ],
};

// ── Testes do módulo AI (integração/Groq) ─────────────────────────────────

test("Groq Provider: configuration() e detecção de status", () => {
  const origProvider = process.env.AI_PROVIDER;
  const origKey = process.env.GROQ_API_KEY;
  const origModel = process.env.AI_MODEL;

  try {
    delete process.env.AI_PROVIDER;
    delete process.env.GROQ_API_KEY;
    delete process.env.AI_MODEL;

    const conf = ai.configuration();
    assert.equal(conf.provider, "groq");
    assert.equal(conf.model, "llama-3.3-70b-versatile");
    assert.equal(conf.configured, false);

    process.env.GROQ_API_KEY = "gsk_test123";
    process.env.AI_MODEL = "llama-3.3-70b-versatile";
    const confConfigured = ai.configuration();
    assert.equal(confConfigured.configured, true);
    assert.equal(confConfigured.model, "llama-3.3-70b-versatile");
  } finally {
    process.env.AI_PROVIDER = origProvider;
    process.env.GROQ_API_KEY = origKey;
    process.env.AI_MODEL = origModel;
  }
});

test("Groq Provider: generate() envia mensagens e retorna conteúdo", async () => {
  let receivedBody = null;
  const server = http.createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      receivedBody = JSON.parse(body);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          choices: [{ message: { role: "assistant", content: "Análise de clima." } }],
        }),
      );
    });
  });
  await new Promise((r) => server.listen(0, r));
  const port = server.address().port;

  const orig = {
    provider: process.env.AI_PROVIDER,
    base: process.env.GROQ_BASE_URL,
    key: process.env.GROQ_API_KEY,
    model: process.env.AI_MODEL,
  };

  try {
    process.env.AI_PROVIDER = "groq";
    process.env.GROQ_BASE_URL = `http://127.0.0.1:${port}/openai/v1`;
    process.env.GROQ_API_KEY = "gsk_mock_token";
    process.env.AI_MODEL = "llama-3.3-70b-versatile";

    const result = await ai.provider().generate([
      { role: "user", content: "Avalie o clima." },
    ]);

    assert.equal(result, "Análise de clima.");
    assert.equal(receivedBody.model, "llama-3.3-70b-versatile");
    assert.equal(receivedBody.messages.length, 1);
  } finally {
    process.env.AI_PROVIDER = orig.provider;
    process.env.GROQ_BASE_URL = orig.base;
    process.env.GROQ_API_KEY = orig.key;
    process.env.AI_MODEL = orig.model;
    await new Promise((r) => server.close(r));
  }
});

test("Groq Provider: erro 503 sem chave e com endpoint inacessível", async () => {
  const orig = { provider: process.env.AI_PROVIDER, base: process.env.GROQ_BASE_URL, key: process.env.GROQ_API_KEY };

  try {
    process.env.AI_PROVIDER = "groq";
    delete process.env.GROQ_API_KEY;

    const provider = ai.provider();

    await assert.rejects(
      () => provider.generate([{ role: "user", content: "teste" }]),
      (err) => {
        assert.equal(err.status, 503);
        assert.ok(err.message.includes("Configure GROQ_API_KEY"));
        return true;
      },
    );

    process.env.GROQ_API_KEY = "gsk_test";
    process.env.GROQ_BASE_URL = "http://127.0.0.1:59999/openai/v1";

    await assert.rejects(
      () => provider.generate([{ role: "user", content: "teste" }]),
      (err) => {
        assert.equal(err.status, 503);
        assert.ok(err.message.includes("IA indisponível no momento"));
        return true;
      },
    );
  } finally {
    process.env.AI_PROVIDER = orig.provider;
    process.env.GROQ_BASE_URL = orig.base;
    process.env.GROQ_API_KEY = orig.key;
  }
});

// ── Testes do assistantService ─────────────────────────────────────────────

test("assistantService: mode=explain retorna sections estruturadas com observacoes/hipoteses/investigacao", async () => {
  const explainPayload = JSON.stringify({
    observacoes: ["Demandas com média 2.3 — abaixo da faixa adequada.", "Autonomia com média 3.9 — na faixa adequada."],
    hipoteses: ["A percepção desfavorável de demandas pode indicar sobrecarga."],
    investigacao: ["Investigar distribuição de tarefas entre equipes.", "Verificar se há variação por setor."],
  });

  const server = makeMockServer(explainPayload);
  await new Promise((r) => server.listen(0, r));
  const port = server.address().port;

  const orig = { provider: process.env.AI_PROVIDER, base: process.env.GROQ_BASE_URL, key: process.env.GROQ_API_KEY };

  try {
    process.env.AI_PROVIDER = "groq";
    process.env.GROQ_BASE_URL = `http://127.0.0.1:${port}/openai/v1`;
    process.env.GROQ_API_KEY = "gsk_mock";

    const res = await explain("acc-1", BASE_REPORT, {
      question: "Como está o fator demandas?",
      mode: "explain",
      allowExternal: true,
    });

    // Campos esperados
    assert.equal(res.provider, "groq");
    assert.equal(res.humanReviewRequired, true);
    assert.equal(res.suggestion, null);

    // Seções estruturadas
    assert.ok(Array.isArray(res.sections.observacoes), "observacoes deve ser array");
    assert.ok(Array.isArray(res.sections.hipoteses), "hipoteses deve ser array");
    assert.ok(Array.isArray(res.sections.investigacao), "investigacao deve ser array");
    assert.ok(res.sections.observacoes.length >= 1);
    assert.ok(res.sections.hipoteses.length >= 1);
    assert.ok(res.sections.investigacao.length >= 1);

    // Texto consolidado deve conter os títulos de seção
    assert.ok(res.answer.includes("Observações"));
    assert.ok(res.answer.includes("Hipóteses"));
    assert.ok(res.answer.includes("O que investigar"));
  } finally {
    process.env.AI_PROVIDER = orig.provider;
    process.env.GROQ_BASE_URL = orig.base;
    process.env.GROQ_API_KEY = orig.key;
    await new Promise((r) => server.close(r));
  }
});

test("assistantService: mode=action com markdown fence retorna suggestion estruturada", async () => {
  const actionPayload =
    '```json\n{"title":"Ajuste na Carga de Trabalho","description":"Redistribuir demandas dos setores críticos.","successCriteria":"Redução do índice de sobrecarga em 15%.","rationale":"Baseado nos fatores apontados no relatório."}\n```';

  const server = makeMockServer(actionPayload);
  await new Promise((r) => server.listen(0, r));
  const port = server.address().port;

  const orig = { provider: process.env.AI_PROVIDER, base: process.env.GROQ_BASE_URL, key: process.env.GROQ_API_KEY };

  try {
    process.env.AI_PROVIDER = "groq";
    process.env.GROQ_BASE_URL = `http://127.0.0.1:${port}/openai/v1`;
    process.env.GROQ_API_KEY = "gsk_mock";

    const res = await explain("acc-2", BASE_REPORT, {
      question: "Proponha uma medida organizacional.",
      mode: "action",
      allowExternal: true,
    });

    assert.equal(res.provider, "groq");
    assert.equal(res.humanReviewRequired, true);
    assert.equal(res.sections, null);
    assert.ok(res.suggestion);
    assert.equal(res.suggestion.title, "Ajuste na Carga de Trabalho");
    assert.equal(res.suggestion.description, "Redistribuir demandas dos setores críticos.");
    assert.equal(res.suggestion.successCriteria, "Redução do índice de sobrecarga em 15%.");
  } finally {
    process.env.AI_PROVIDER = orig.provider;
    process.env.GROQ_BASE_URL = orig.base;
    process.env.GROQ_API_KEY = orig.key;
    await new Promise((r) => server.close(r));
  }
});

test("assistantService: contexto envia texto da pergunta de cada fator ao modelo", async () => {
  let receivedUserMessage = null;
  const server = http.createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      const parsed = JSON.parse(body);
      receivedUserMessage = JSON.parse(
        parsed.messages.find((m) => m.role === "user").content,
      );
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  observacoes: ["Demandas baixas."],
                  hipoteses: ["Possível sobrecarga."],
                  investigacao: ["Investigar tarefas."],
                }),
              },
            },
          ],
        }),
      );
    });
  });
  await new Promise((r) => server.listen(0, r));
  const port = server.address().port;

  const orig = { provider: process.env.AI_PROVIDER, base: process.env.GROQ_BASE_URL, key: process.env.GROQ_API_KEY };

  try {
    process.env.AI_PROVIDER = "groq";
    process.env.GROQ_BASE_URL = `http://127.0.0.1:${port}/openai/v1`;
    process.env.GROQ_API_KEY = "gsk_mock";

    await explain("acc-3", BASE_REPORT, {
      question: "Como está o fator demandas?",
      mode: "explain",
      allowExternal: true,
    });

    // O contexto deve conter o texto da pergunta do fator "demandas"
    const demandasFactor = receivedUserMessage.context.factors.find(
      (f) => f.key === "demandas",
    );
    assert.ok(demandasFactor, "fator demandas deve estar no contexto");
    assert.equal(
      demandasFactor.question,
      "Consigo lidar com o volume de trabalho.",
      "texto da pergunta deve ser enviado",
    );

    // O contexto deve incluir classificação de faixa
    assert.ok(demandasFactor.band, "band deve estar presente");
    assert.equal(demandasFactor.band, "atencao", "2.3 deve cair na faixa atenção");

    // O instrumento deve ter nome e limitação
    assert.ok(receivedUserMessage.context.instrument.name);
    assert.ok(receivedUserMessage.context.instrument.limitation);
  } finally {
    process.env.AI_PROVIDER = orig.provider;
    process.env.GROQ_BASE_URL = orig.base;
    process.env.GROQ_API_KEY = orig.key;
    await new Promise((r) => server.close(r));
  }
});
