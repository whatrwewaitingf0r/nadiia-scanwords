const assert = require('node:assert/strict');
const { chromium } = require('/opt/homebrew/lib/node_modules/@browserbasehq/browse-cli/node_modules/playwright');

const url = process.argv[2] || 'http://127.0.0.1:8765/index.html';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 375, height: 667 } });
  const page = await context.newPage();
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
  await context.setOffline(true);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.puzzle-card');
  assert.equal(await page.locator('.puzzle-card').count(), 48);
  await page.locator('.puzzle-card').first().click();
  assert.ok(await page.locator('.grid-cell.clue').count() >= 8);
  await context.setOffline(false);
  await browser.close();
  console.log('Offline smoke: service worker catalog and game passed.');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

