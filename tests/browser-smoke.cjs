const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require('/opt/homebrew/lib/node_modules/@browserbasehq/browse-cli/node_modules/playwright');

const baseUrl = process.argv[2] || `file://${path.join(__dirname, '..', 'index.html')}`;
const output = path.join(__dirname, '..', 'output', 'mobile');
fs.mkdirSync(output, { recursive: true });

(async () => {
  const browser = await chromium.launch({ headless: true });
  const scenarios = [
    { name: 'iphone-se', width: 375, height: 667 },
    { name: 'ipad', width: 1024, height: 1366 },
  ];

  for (const scenario of scenarios) {
    const page = await browser.newPage({ viewport: scenario, deviceScaleFactor: 1 });
    const errors = [];
    page.on('pageerror', (error) => errors.push(String(error)));
    page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.puzzle-card');
    assert.equal(await page.locator('.puzzle-card').count(), 48);
    await page.screenshot({ path: path.join(output, `${scenario.name}-catalog.png`), fullPage: true });

    await page.locator('.puzzle-card').first().click();
    await page.waitForSelector('.grid-cell.clue');
    const stateBefore = JSON.parse(await page.evaluate(() => window.render_game_to_text()));
    assert.equal(stateBefore.mode, 'playing');
    assert.ok(await page.locator('.grid-cell.answer.is-active').count() >= 4);

    const sizing = await page.evaluate(() => {
      const cell = document.querySelector('.grid-cell.answer').getBoundingClientRect();
      const dock = document.querySelector('.input-dock').getBoundingClientRect();
      const board = document.querySelector('.board-shell').getBoundingClientRect();
      return { cellWidth: cell.width, cellHeight: cell.height, dockBottom: dock.bottom, boardBottom: board.bottom, dockTop: dock.top, innerHeight };
    });
    assert.ok(sizing.cellWidth >= 44 && sizing.cellHeight >= 44, JSON.stringify(sizing));
    assert.ok(sizing.dockBottom <= sizing.innerHeight + 1, JSON.stringify(sizing));
    assert.ok(sizing.boardBottom <= sizing.dockTop + 1, JSON.stringify(sizing));

    const tileCount = await page.locator('.letter-tile').count();
    await page.locator('.letter-tile').first().click();
    const stateAfter = JSON.parse(await page.evaluate(() => window.render_game_to_text()));
    assert.equal(stateAfter.filledCells, stateBefore.filledCells + 1);
    await page.locator('#hint-extras').click();
    assert.equal(await page.locator('.letter-tile').count(), tileCount - 2);
    await page.locator('#hint-letter').click();
    await page.locator('#keyboard-toggle').click();
    assert.ok(await page.locator('.key-button').count() >= 33);
    await page.screenshot({ path: path.join(output, `${scenario.name}-game.png`), fullPage: false });

    const stored = await page.evaluate(() => localStorage.getItem('slovolinii-progress-v1'));
    assert.ok(stored && stored.includes('scanword-001'));
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.locator('.puzzle-card').first().click();
    const restoredState = JSON.parse(await page.evaluate(() => window.render_game_to_text()));
    assert.ok(restoredState.filledCells >= 1, 'entered letters should survive reload');
    const clueCount = await page.locator('.grid-cell.clue').count();
    for (let index = 0; index < clueCount; index += 1) {
      await page.locator('.grid-cell.clue').nth(index).click();
      await page.locator('#hint-word').click();
    }
    await page.waitForSelector('#complete-dialog:not([hidden])');
    const completedState = JSON.parse(await page.evaluate(() => window.render_game_to_text()));
    assert.equal(completedState.complete, true);
    assert.equal(JSON.parse(await page.evaluate(() => localStorage.getItem('slovolinii-progress-v1')))['scanword-001'].completed, true);
    assert.deepEqual(errors, []);
    await page.close();
  }
  await browser.close();
  console.log('Browser smoke: iPhone SE and iPad passed.');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
