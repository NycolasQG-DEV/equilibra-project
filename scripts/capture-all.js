const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

(async () => {
  const screenshotDir = path.join(__dirname, '..', 'public', 'screenshots');

  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    locale: 'pt-BR',
  });
  const page = await context.newPage();

  console.log('1. Navegando para http://localhost:3000...');
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });

  // Criar uma nova conta
  const tabs = await page.$$('button');
  for (const t of tabs) {
    const text = await t.innerText();
    if (text.includes('Criar Conta')) {
      await t.click();
      break;
    }
  }
  await page.waitForTimeout(400);

  const testEmail = `diretoria_${Date.now()}@equilibra.com.br`;
  await page.fill('input[placeholder="Nome do responsável SST / RH"]', 'Dra. Mariana Arantes');
  await page.fill('input[placeholder="Razão social ou nome fantasia"]', 'Inovação & Saúde Ocupacional');
  await page.fill('input[type="email"]', testEmail);
  await page.fill('input[placeholder="Mínimo de 10 caracteres"]', 'SenhaForte1234!');
  await page.click('button[type="submit"]');

  await page.waitForTimeout(2000);

  // Pular onboarding se aparecer
  const skipBtn = await page.getByText(/Configurar depois/i);
  if (skipBtn && await skipBtn.count() > 0) {
    await skipBtn.click();
    await page.waitForTimeout(1500);
  }

  // Helper para clicar no sidebar nav
  async function navTo(text, screenName) {
    console.log(`Navegando para ${text}...`);
    const link = page.locator(`.shell-nav-link:has-text("${text}")`);
    if (await link.count() > 0) {
      await link.first().click();
    }
    await page.waitForTimeout(1200);
    await page.screenshot({ path: path.join(screenshotDir, `${screenName}.png`) });
  }

  await navTo('Hoje', '03-hoje');
  await navTo('Pesquisas', '04-pesquisas');
  await navTo('Evidências', '05-evidencias');
  await navTo('Diagnóstico', '06-resultados');
  await navTo('Riscos NR-1', '07-riscos');
  await navTo('Plano de Ação', '08-acoes');
  await navTo('Organização', '09-organizacao');
  await navTo('Configurações', '10-configuracoes');

  console.log('✅ TODAS AS TELAS FORAM CAPTURADAS COM SUCESSO!');
  await browser.close();
})();
