const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
async function main() {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    for (const mode of ['delayed', 'blocked', 'invalid']) {
      const page = await browser.newPage();
      const errors = []; page.on('pageerror', error => errors.push(error.message));
      await page.addInitScript(() => localStorage.setItem('equilibra_cookie_consent', 'essential'));
      await page.route('https://cdn.jsdelivr.net/**', async route => {
        if (mode === 'blocked') return route.abort();
        await new Promise(resolve => setTimeout(resolve, 500));
        const lenis = route.request().url().includes('/lenis@');
        return route.fulfill({ contentType: 'application/javascript', body: lenis
          ? mode === 'invalid' ? 'window.Lenis = {};' : 'window.Lenis = class { constructor(){ window.__lenisCreated = (window.__lenisCreated || 0) + 1; } raf(){} destroy(){} scrollTo(el){el.scrollIntoView();} };'
          : 'window.anime = Object.assign(function(){}, {stagger: function(){return 0;}});' });
      });
      await page.goto((process.env.PRODUCT_TEST_URL || 'http://localhost:3000') + '/', { waitUntil: 'networkidle' });
      assert.equal(await page.locator('.hero-title').evaluate(el => getComputedStyle(el).opacity), '1');
      await page.getByRole('button', { name: /^Começar cadastro/ }).click();
      assert.equal(await page.locator('#auth-section').evaluate(el => getComputedStyle(el).opacity), '1');
      if (mode === 'delayed') assert.equal(await page.evaluate(() => window.__lenisCreated), 1);
      assert.deepEqual(errors, [], `${mode}: unexpected browser errors`);
      await page.close();
    }
    console.log('Home: delayed, blocked and invalid CDN loads keep content and signup usable without runtime errors.');
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
