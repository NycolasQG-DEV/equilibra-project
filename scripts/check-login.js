const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ channel: 'chrome' });
  const page = await browser.newPage();
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
  const text = await page.evaluate(() => {
    const el = document.querySelector('.auth-tab');
    return el ? el.className : 'NOT_FOUND';
  });
  console.log('auth-tab in DOM:', text);
  await page.screenshot({ path: 'public/screenshots/01-login-fresh.png' });
  await browser.close();
})();
