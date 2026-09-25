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
  await page.waitForSelector('.grid-cell.clue');
  assert.equal(await page.locator('.grid-cell').count(), 70);
  assert.equal(await page.locator('.letter-tile').count(), 20);
  assert.equal(await page.locator('.clue-part').count(), 12);
  await context.setOffline(false);
  await browser.close();
  console.log('Offline smoke: v16 game shell and puzzle data passed.');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
