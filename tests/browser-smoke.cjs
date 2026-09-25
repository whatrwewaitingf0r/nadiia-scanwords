const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require('/opt/homebrew/lib/node_modules/@browserbasehq/browse-cli/node_modules/playwright');

const baseUrl = process.argv[2] || `file://${path.join(__dirname, '..', 'index.html')}`;
const output = path.join(__dirname, '..', 'output', 'mobile-v6');
fs.mkdirSync(output, { recursive: true });

(async () => {
  const browser = await chromium.launch({ headless: true });
  const scenarios = [
    { name: 'iphone-se', width: 375, height: 667, visibleCols: 10, visibleRows: 7 },
    { name: 'ipad-landscape', width: 1366, height: 1024, visibleCols: 10, visibleRows: 7 },
  ];

  for (const scenario of scenarios) {
    const context = await browser.newContext({ viewport: scenario, deviceScaleFactor: 1 });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(String(error)));
    page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.puzzle-card');
    assert.equal(await page.locator('.puzzle-card').count(), 90);
    await page.screenshot({ path: path.join(output, `${scenario.name}-catalog.png`), fullPage: true });

    await page.locator('.puzzle-card').first().click();
    await page.waitForSelector('.grid-cell.clue');
    const stateBefore = JSON.parse(await page.evaluate(() => window.render_game_to_text()));
    assert.equal(stateBefore.mode, 'playing');
    assert.equal(stateBefore.grid.cols, scenario.visibleCols);
    assert.equal(stateBefore.grid.rows, scenario.visibleRows);
    assert.equal(stateBefore.grid.occupied, 70);
    assert.equal(await page.locator('.grid-cell').count(), 70);
    const expectedClues = await page.evaluate(() => window.SCANWORD_PUZZLES[0].words.length);
    assert.equal(await page.locator('.grid-cell.clue').count(), expectedClues);
    assert.equal(await page.locator('.grid-cell.answer').count(), 70 - expectedClues);
    assert.equal(await page.locator('.grid-cell.blank').count(), 0);
    const activeLength = await page.evaluate(() => window.SCANWORD_PUZZLES[0].words[0].answer.length);
    assert.equal(await page.locator('.grid-cell.answer.is-active').count(), activeLength);

    const sizing = await page.evaluate(() => {
      const cell = document.querySelector('.grid-cell.answer').getBoundingClientRect();
      const dock = document.querySelector('.play-panel').getBoundingClientRect();
      const board = document.querySelector('.scanword-grid').getBoundingClientRect();
      const header = document.querySelector('.game-head').getBoundingClientRect();
      return { cellWidth: cell.width, cellHeight: cell.height, dockBottom: dock.bottom, boardBottom: board.bottom, boardTop: board.top, headerBottom: header.bottom, dockTop: dock.top, boardWidth: board.width, innerWidth, innerHeight };
    });
    assert.ok(Math.abs(sizing.cellWidth - sizing.cellHeight) < 0.1, JSON.stringify(sizing));
    assert.ok(sizing.cellWidth >= 37, JSON.stringify(sizing));
    assert.ok(sizing.boardWidth <= sizing.innerWidth + 1, JSON.stringify(sizing));
    assert.ok(sizing.dockBottom <= sizing.innerHeight + 1, JSON.stringify(sizing));
    assert.ok(sizing.boardBottom <= sizing.dockTop + 1, JSON.stringify(sizing));
    assert.ok(sizing.boardTop - sizing.headerBottom < 2, `playfield left unused height: ${JSON.stringify(sizing)}`);

    const tileCount = await page.locator('.letter-tile').count();
    assert.equal(tileCount, 20);
    await page.locator('.letter-tile').first().click();
    const stateAfter = JSON.parse(await page.evaluate(() => window.render_game_to_text()));
    assert.equal(stateAfter.filledCells, stateBefore.filledCells + 1);
    await page.locator('#hint-extras').click();
    assert.equal(await page.locator('.letter-tile').count(), activeLength);

    const leftWord = await page.evaluate(() => window.SCANWORD_PUZZLES[0].words.find((word) => word.direction === 'left').id);
    const downWord = await page.evaluate(() => window.SCANWORD_PUZZLES[0].words.find((word) => word.direction === 'down').id);
    await page.locator(`.grid-cell.clue[data-word-id="${leftWord}"]`).click();
    assert.equal(await page.locator('#direction-badge').textContent(), '←');
    await page.locator(`.grid-cell.clue[data-word-id="${downWord}"]`).click();
    assert.equal(await page.locator('#direction-badge').textContent(), '↓');
    await page.screenshot({ path: path.join(output, `${scenario.name}-game.png`), fullPage: false });

    const stored = await page.evaluate(() => localStorage.getItem('nadiia-scanwords-v6'));
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
    assert.equal(JSON.parse(await page.evaluate(() => localStorage.getItem('nadiia-scanwords-v6')))['scanword-001'].completed, true);
    assert.deepEqual(errors, []);
    await context.close();
  }
  await browser.close();
  console.log('Browser smoke: packed 10×7 playfield passed on iPhone SE and iPad landscape.');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
