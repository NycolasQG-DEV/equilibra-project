// Synthetic local environment; never points at the user's data directory.
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const tempDir = fs.mkdtempSync(
  path.join(os.tmpdir(), "equilibra-browser-"),
);
process.env.EQUILIBRA_DATA_DIR = tempDir;
process.env.NODE_ENV = "test";
process.env.GROQ_API_KEY = "";
process.env.AI_MODEL = "";
process.env.MERCADOPAGO_ACCESS_TOKEN = "";
process.env.MERCADOPAGO_WEBHOOK_SECRET = "";
process.env.BILLING_ENFORCE = "false";

const app = require("../src/server");
const storage = require("../src/config/equilibraStorage");
const { derive } = require("../src/services/passwordService");
const { runSeed, ACC_ID } = require("./seedConsolidatedCompany");

// Roda o seed completo com 181 colaboradores em 7 áreas, 6 ciclos com variação real, ações e HSE
runSeed();

// Adiciona também a conta de conveniência Ana QA para testes de browser legados
const accounts = storage.read("accounts");
accounts.push({
  id: "acc-qa-convenience",
  name: "Ana QA",
  company: "Zenai Soluções Tecnológicas [DEMO]",
  email: "qa@example.test",
  passwordHash: derive("senha-teste-123"),
  role: "owner",
  createdAt: new Date().toISOString(),
});
// Garante que o usuário da demo também possa logar com senha-teste-123
accounts.push({
  id: "user-nycolas-qa",
  organizationId: ACC_ID,
  name: "Nycolas (QA)",
  company: "Zenai Soluções Tecnológicas [DEMO]",
  email: "nycolas@example.test",
  passwordHash: derive("senha-teste-123"),
  role: "owner",
  createdAt: new Date().toISOString(),
});
storage.write("accounts", accounts);

const server = app.listen(3107, "127.0.0.1", () =>
  console.log(`QA sintético disponível em http://127.0.0.1:3107 (dados em ${tempDir})`),
);

module.exports = server;
