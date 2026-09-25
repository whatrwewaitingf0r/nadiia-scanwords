const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require('/opt/homebrew/lib/node_modules/@browserbasehq/browse-cli/node_modules/playwright');

const baseUrl = process.argv[2] || `file://${path.join(__dirname, '..', 'index.html')}`;
const output = path.join(__dirname, '..', 'output', 'v8-responsive');
fs.mkdirSync(output, { recursive: true });

(async () => {
  const browser = await chromium.launch({ headless: true });
  const scenarios = [
    { name: 'iphone', width: 390, height: 844 },
    { name: 'tablet', width: 820, height: 1180 },
  ];

  for (const scenario of scenarios) {
    const context = await browser.newContext({ viewport: scenario, deviceScaleFactor: 1 });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(String(error)));
    page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.grid-cell.clue');

    const initial = JSON.parse(await page.evaluate(() => window.render_game_to_text()));
    assert.equal(initial.mode, 'playing');
    assert.equal(initial.version, 'v8');
    assert.deepEqual(initial.grid, { cols: 10, rows: 14, occupied: 140, words: 25 });
    assert.equal(await page.locator('.grid-cell').count(), 140);
    assert.ok(await page.locator('.clue-part').count() >= 24);
    assert.equal(await page.locator('.letter-tile').count(), 20);
    assert.equal(await page.locator('.game-head > button').count(), 5);
    assert.equal(await page.locator('#current-clue').textContent(), initial.active.clue);

    const sizing = await page.evaluate(() => {
      const cell = document.querySelector('.grid-cell.answer').getBoundingClientRect();
      const board = document.querySelector('.scanword-grid').getBoundingClientRect();
      const areaElement = document.querySelector('.board-area');
      const area = areaElement.getBoundingClientRect();
      const clue = document.querySelector('.clue-bar').getBoundingClientRect();
      const header = document.querySelector('.game-head').getBoundingClientRect();
      const tiles = document.querySelector('.letter-tiles').getBoundingClientRect();
      const lastTile = document.querySelector('.letter-tile:last-child').getBoundingClientRect();
      const foot = document.querySelector('.game-foot').getBoundingClientRect();
      const tileRows = [...new Set([...document.querySelectorAll('.letter-tile')].map((tile) => Math.round(tile.getBoundingClientRect().top)))];
      const availableWidth = areaElement.clientWidth;
      const availableHeight = Math.max(14 * 24, areaElement.clientHeight);
      return { cellWidth: cell.width, cellHeight: cell.height, boardBottom: board.bottom, areaBottom: area.bottom, clueTop: clue.top, headerBottom: header.bottom, areaTop: area.top, boardWidth: board.width, clueWidth: clue.width, tilesBottom: tiles.bottom, lastTileBottom: lastTile.bottom, innerWidth, innerHeight, expectedCell: Math.min(availableWidth / 10, availableHeight / 14), tileRows: tileRows.length };
    });
    assert.ok(Math.abs(sizing.cellWidth - sizing.cellHeight) < 0.1, JSON.stringify(sizing));
    assert.ok(Math.abs(sizing.cellWidth - sizing.expectedCell) <= 1, JSON.stringify(sizing));
    assert.ok(Math.abs(sizing.areaBottom - sizing.clueTop) < 1, `beige gap before clue bar: ${JSON.stringify(sizing)}`);
    assert.ok(sizing.areaTop - sizing.headerBottom < 2, `gap below thin header: ${JSON.stringify(sizing)}`);
    assert.equal(sizing.tileRows, 2);
    assert.ok(sizing.boardWidth <= sizing.innerWidth + 1, JSON.stringify(sizing));
    assert.ok(sizing.innerHeight - sizing.tilesBottom < 2, `bottom dead zone: ${JSON.stringify(sizing)}`);
    assert.ok(sizing.lastTileBottom <= sizing.innerHeight + 1, `bottom tile clipped: ${JSON.stringify(sizing)}`);
    if (scenario.name === 'tablet') assert.ok(Math.abs(sizing.boardWidth - sizing.clueWidth) < 12, JSON.stringify(sizing));
    await page.screenshot({ path: path.join(output, `${scenario.name}-light.png`), fullPage: false });

    await page.locator('.letter-tile').first().click();
    const afterLetter = JSON.parse(await page.evaluate(() => window.render_game_to_text()));
    assert.equal(afterLetter.filledCells, initial.filledCells + 1);

    await page.locator('#hints-button').click();
    await page.locator('#hint-extras').click();
    assert.equal(await page.locator('.letter-tile').count(), 20, 'hint must preserve the two complete tile rows');
    assert.ok(await page.locator('.letter-tile:disabled').count() > 0);

    const directions = await page.evaluate(() => Object.fromEntries(['left','down','across'].map((direction) => [direction, window.SCANWORD_PUZZLES[0].words.find((word) => word.direction === direction).id])));
    for (const [direction, id] of Object.entries(directions)) {
      await page.locator(`.clue-part[data-word-id="${id}"]`).click();
      const text = JSON.parse(await page.evaluate(() => window.render_game_to_text()));
      assert.equal(text.active.direction, direction === 'left' ? '←' : direction === 'down' ? '↓' : '→');
    }

    await page.locator('#theme-button').click();
    assert.ok(await page.locator('body').evaluate((body) => body.classList.contains('theme-dark')));
    await page.locator('#menu-button').click();
    assert.equal(await page.locator('#puzzle-list button').count(), 7);
    await page.locator('#close-menu').click();
    await page.screenshot({ path: path.join(output, `${scenario.name}-game.png`), fullPage: false });

    const stored = await page.evaluate(() => localStorage.getItem('nadiia-scanwords-v8'));
    assert.ok(stored && stored.includes('scanword-001'));
    await page.reload({ waitUntil: 'domcontentloaded' });
    assert.ok(JSON.parse(await page.evaluate(() => window.render_game_to_text())).filledCells >= 1);

    const clueCount = await page.locator('.clue-part').count();
    for (let index = 0; index < clueCount; index += 1) {
      await page.locator('.clue-part').nth(index).click();
      await page.locator('#hints-button').click();
      await page.locator('#hint-word').click();
    }
    await page.waitForSelector('#complete-dialog:not([hidden])');
    assert.equal(JSON.parse(await page.evaluate(() => window.render_game_to_text())).complete, true);
    assert.equal(JSON.parse(await page.evaluate(() => localStorage.getItem('nadiia-scanwords-v8')))['scanword-001'].completed, true);
    assert.deepEqual(errors, []);
    await context.close();
  }
  await browser.close();
  console.log('Browser smoke: v8 dense composition passed on iPhone and tablet portrait.');
})().catch((error) => { console.error(error); process.exitCode = 1; });
