// Synthetic local environment; never points at the user's data directory.
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
process.env.EQUILIBRA_DATA_DIR = fs.mkdtempSync(
  path.join(os.tmpdir(), "equilibra-browser-"),
);
process.env.NODE_ENV = "test";
process.env.GROQ_API_KEY = "";
process.env.AI_MODEL = "";
process.env.MERCADOPAGO_ACCESS_TOKEN = "";
process.env.MERCADOPAGO_WEBHOOK_SECRET = "";
process.env.BILLING_ENFORCE = "false";
const app = require("../src/server");
const storage = require("../src/config/equilibraStorage");
const { derive } = require("../src/services/passwordService");
const { INSTRUMENT, FACTORS } = require("../src/domain/instruments");
const { aggregate, summarizeDistribution } = require("../src/domain/analysis");
const crypto = require("node:crypto");
const accountId = crypto.randomUUID();
storage.write("accounts", [
  {
    id: accountId,
    name: "Ana QA",
    company: "Empresa de demonstração",
    email: "qa@example.test",
    passwordHash: derive("senha-teste-123"),
    role: "owner",
    createdAt: new Date().toISOString(),
  },
]);
const members = Array.from({ length: 10 }, (_, i) => ({
  id: crypto.randomUUID(),
  accountId,
  name: `Participante fictício ${i + 1}`,
  email: "",
  phone: "",
  createdAt: new Date().toISOString(),
}));
storage.write("members", members);
const group = {
  id: crypto.randomUUID(),
  accountId,
  name: "Operações",
  memberIds: members.map((row) => row.id),
  color: "#2E7D52",
  createdAt: new Date().toISOString(),
};
storage.write("groups", [group]);
const reports = [],
  surveys = [],
  responses = [];
for (let index = 0; index < 2; index++) {
  const surveyId = crypto.randomUUID(),
    closedAt = `2026-0${index + 1}-15T12:00:00.000Z`;
  const rows = Array.from({ length: 10 }, () => ({
    id: crypto.randomUUID(),
    accountId,
    surveyId,
    answers: Object.fromEntries(FACTORS.map(([key]) => [key, index + 2])),
  }));
  const result = aggregate(rows),
    audienceFingerprint = crypto
      .createHash("sha256")
      .update([...group.memberIds].sort().join(":"))
      .digest("hex");
  surveys.push({
    id: surveyId,
    accountId,
    title: index ? "Pulso de fevereiro" : "Linha de base",
    cycle: index ? "Fevereiro 2026" : "Janeiro 2026",
    model: "Pulso mensal",
    groupId: group.id,
    groupIds: [group.id],
    memberIds: group.memberIds,
    instrument: INSTRUMENT,
    audienceFingerprint,
    groupNamesSnapshot: [group.name],
    status: "closed",
    endsAt: closedAt,
    closedAt,
    result,
    responseCount: 10,
  });
  reports.push({
    id: crypto.randomUUID(),
    accountId,
    surveyId,
    title: surveys.at(-1).title,
    cycle: surveys.at(-1).cycle,
    model: "Pulso mensal",
    groupName: group.name,
    closedAt,
    published: true,
    responseCount: 10,
    result,
    instrument: INSTRUMENT,
    audienceFingerprint,
    distribution: summarizeDistribution(rows),
    methodology: "Questionário exploratório, versão 1",
  });
  responses.push(...rows);
}
storage.write("surveys", surveys);
storage.write("reports", reports);
storage.write("responses", responses);
app.listen(3107, "127.0.0.1", () =>
  console.log("QA sintético disponível em http://127.0.0.1:3107"),
);
