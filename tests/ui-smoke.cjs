// Run after npm run build. Uses a separate database and a headless Edge browser.
require("@next/env").loadEnvConfig(process.cwd());
const crypto = require("node:crypto"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  { spawn } = require("node:child_process");
const testDb = "eq_validation_" + crypto.randomBytes(8).toString("hex"),
  port = 3107,
  base = "http://localhost:" + port;
process.env.DB_NAME = testDb;
process.env.GROQ_API_KEY = "";
process.env.JWT_SECRET = crypto.randomBytes(48).toString("hex");
process.env.APP_URL = base;
require("./register.cjs");
const db = require("../lib/db/index.ts"),
  { signToken } = require("../lib/auth/jwt.ts"),
  { DIMENSIONS, PROTOCOL_VERSION } = require("../lib/ai/protocol.ts");
let server, browser, debugPage;
let serverOutput = "";
async function main() {
  await db.initDatabase();
  const user = {
    id: crypto.randomUUID(),
    name: "Gestão de demonstração",
    email: "visual@example.invalid",
    role: "admin",
    plan: "professional",
    max_colaboradores: 100,
  };
  await db.execute(
    "INSERT INTO users(id,name,email,password_hash,role,plan,max_colaboradores) VALUES(?,?,?,?,?,?,?)",
    [user.id, user.name, user.email, "unused", user.role, user.plan, 100],
  );
  let openLink;
  for (let round = 0; round < 3; round++) {
    const id = crypto.randomUUID();
    await db.execute(
      "INSERT INTO management_batches(id,admin_id,title,sector,context,protocol_version,created_at,closed_at) VALUES(?,?,?,?,?,?,?,?)",
      [
        id,
        user.id,
        ["Operação · Julho", "Operação · Agosto", "Operação · Setembro"][round],
        "Atendimento",
        "Atendimento em jornada regular, com aumento de demanda ao final da tarde.",
        PROTOCOL_VERSION,
        ["2026-07-01", "2026-08-01", "2026-09-01"][round],
        round < 2 ? ["2026-07-31", "2026-08-31"][round] : null,
      ],
    );
    for (let i = 0; i < 12; i++) {
      const link = "lnk_" + crypto.randomBytes(24).toString("base64url"),
        sid = "ses_" + crypto.randomBytes(24).toString("base64url");
      if (round === 2 && !openLink) openLink = link;
      await db.execute(
        "INSERT INTO survey_links(id,title,sector,admin_id,batch_id,active,used,closed_by_session_id) VALUES(?,?,?,?,?,?,?,?)",
        [
          link,
          ["Operação · Julho", "Operação · Agosto", "Operação · Setembro"][
            round
          ],
          "Atendimento",
          user.id,
          id,
          round === 2,
          round < 2,
          round < 2 ? sid : null,
        ],
      );
      if (round < 2) {
        const history = DIMENSIONS.map((d, j) => ({
          kind: "rating",
          dimensionTarget: d.id,
          userAnswer:
            i < (round === 0 ? 8 : 5) + (j % 3) ? "Sempre" : "Raramente",
        }));
        await db.execute(
          "INSERT INTO sessions(id,link_id,status,profile,history,completed_at) VALUES(?,?,'completed',?,?,NOW())",
          [
            sid,
            link,
            JSON.stringify({ protocolVersion: PROTOCOL_VERSION }),
            JSON.stringify(history),
          ],
        );
      }
    }
  }
  server = spawn(
    process.execPath,
    [
      path.join(process.cwd(), "node_modules/next/dist/bin/next"),
      "start",
      "-p",
      String(port),
    ],
    {
      cwd: process.cwd(),
      env: process.env,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  server.stdout.on(
    "data",
    (c) => (serverOutput = (serverOutput + c.toString()).slice(-4000)),
  );
  server.stderr.on(
    "data",
    (c) => (serverOutput = (serverOutput + c.toString()).slice(-4000)),
  );
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(base + "/api/dimensions");
      if (r.ok) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
    if (i === 59) throw new Error("Test server failed to start");
  }
  const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
  browser = await chromium.launch({ channel: "msedge", headless: true });
  const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
    }),
    page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  debugPage = page;
  page.on("response", (r) => {
    if (r.url().includes("/api/") && r.status() >= 400)
      console.log("HTTP " + r.status() + " " + new URL(r.url()).pathname);
  });
  const token = signToken({ ...user, userId: user.id });
  await context.addInitScript(
    ({ token, user }) => {
      localStorage.setItem("equilibra_auth_token", token);
      localStorage.setItem("equilibra_auth_user", JSON.stringify(user));
      localStorage.setItem("equilibra_cookie_consent", "essential");
    },
    { token, user },
  );
  await page.goto(base + "/admin");
  await page
    .getByRole("heading", { name: "Panorama da organização" })
    .waitFor();
  await page
    .getByLabel("Campanha", { exact: true })
    .selectOption({ label: "Operação · Agosto · Atendimento" });
  fs.mkdirSync(path.join(process.cwd(), "artifacts"), { recursive: true });
  await page.getByRole("heading", { name: "Mapa de atenção" }).waitFor();
  await page.screenshot({
    path: "artifacts/equilibra-dashboard.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "artifacts/equilibra-dashboard-mobile.png",
    fullPage: true,
  });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 1,
    ),
    false,
    "mobile overflow",
  );
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole("link", { name: "Examinar relatório" }).click();
  await page
    .getByRole("heading", { name: "Relatório da rodada", exact: true })
    .waitFor();
  await page
    .getByRole("heading", { name: "Propostas de intervenção" })
    .waitFor();
  await page.screenshot({
    path: "artifacts/equilibra-relatorio.png",
    fullPage: true,
  });
  await page.pdf({
    path: "artifacts/equilibra-relatorio-exemplo.pdf",
    format: "A4",
    printBackground: true,
    margin: { top: "12mm", bottom: "12mm", left: "12mm", right: "12mm" },
  });
  await page.getByRole("button", { name: "Priorizar com IA" }).click();
  await page.getByRole("button", { name: "Adotar no plano" }).first().click();
  await page.getByRole("button", { name: "Aprovar medida" }).click();
  await page
    .getByRole("button", { name: "Atualizar andamento" })
    .first()
    .waitFor();
  await page.goto(base + "/admin/pesquisas");
  await page
    .getByRole("heading", { name: "Uma rodada, um contexto" })
    .waitFor();
  await page.getByLabel("Nome da campanha").fill("Rodada criada no navegador");
  await page.getByLabel("Setor ou grupo").fill("Operação");
  await page
    .getByLabel("Contexto das condições de trabalho", { exact: false })
    .fill(
      "Atividade de atendimento com jornada regular e cobertura compartilhada de pausas.",
    );
  await page.getByRole("button", { name: "Criar campanha e links" }).click();
  await page.getByRole("status").filter({ hasText: "links criados" }).waitFor();
  const worker = await browser.newContext({
      viewport: { width: 390, height: 844 },
      reducedMotion: "reduce",
    }),
    p = await worker.newPage();
  p.on("pageerror", (e) => errors.push(e.message));
  await p.addInitScript(() =>
    localStorage.setItem("equilibra_cookie_consent", "essential"),
  );
  await p.goto(base + "/colaborador?link=" + openLink);
  await p
    .getByRole("heading", { name: "Avaliação de Rotina e Bem-Estar" })
    .waitFor();
  await p.locator("#privacy-consent-check").click();
  await p.getByRole("button", { name: "Li e Concordo com os Termos" }).click();
  await p.getByRole("button", { name: "Iniciar Avaliação" }).click();
  await p.getByRole("button", { name: "Sempre", exact: true }).waitFor();
  await p.screenshot({
    path: "artifacts/equilibra-conversa-mobile.png",
    animations: "disabled",
    fullPage: true,
  });
  assert.equal(
    await p.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 1,
    ),
    false,
    "survey mobile overflow",
  );
  for (let i = 0; i < 7; i++) {
    await p.getByRole("button", { name: "Sempre", exact: true }).click();
    await p.getByRole("button", { name: "Enviar Resposta" }).click();
    await p.getByRole("button", { name: "Pular pergunta" }).click();
  }
  await p.getByRole("button", { name: "Pular pergunta" }).click();

  await p
    .getByRole("heading", { name: "Muito obrigado pela sua participação!" })
    .waitFor();
  assert.deepEqual(errors, [], "browser runtime errors");
  console.log(
    "UI passed: dashboard, time series, recommendation/action, mobile layout, create campaign, complete participant flow. Screenshots in artifacts/.",
  );
}
main()
  .catch(async (e) => {
    console.error(e.message);
    if (debugPage)
      console.error(
        (await debugPage.locator("body").innerText()).slice(0, 1600),
      );
    console.error(serverOutput);
    process.exitCode = 1;
  })
  .finally(async () => {
    await browser?.close();
    if (server) {
      server.kill();
      await new Promise((r) => {
        if (server.exitCode !== null) r();
        else {
          server.once("exit", r);
          setTimeout(r, 3000);
        }
      });
    }
    try {
      if (
        !/^eq_validation_[0-9a-f]{16}$/.test(testDb) ||
        process.env.DB_NAME !== testDb
      )
        throw new Error("Unsafe cleanup refused");
      await db.getPool().query("DROP DATABASE IF EXISTS " + testDb);
      await db.getPool().end();
    } catch (e) {
      console.error("Cleanup failed: " + (e.code || e.message));
      process.exitCode = 1;
    }
  });
