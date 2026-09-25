const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require('/opt/homebrew/lib/node_modules/@browserbasehq/browse-cli/node_modules/playwright');

const baseUrl = process.argv[2] || `file://${path.join(__dirname, '..', 'index.html')}`;
const output = path.join(__dirname, '..', 'output', 'v10-responsive');
fs.mkdirSync(output, { recursive: true });

(async () => {
  const browser = await chromium.launch({ headless: true });
  const scenarios = [
    { name: 'iphone-se', width: 375, height: 667 },
    { name: 'iphone', width: 390, height: 844 },
    { name: 'tablet-landscape', width: 1180, height: 820 },
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
    assert.equal(initial.version, 'v10');
    assert.deepEqual(initial.grid, { cols: 10, rows: 7, occupied: 70, words: 12 });
    assert.equal(await page.locator('.grid-cell').count(), 70);
    assert.equal(await page.locator('.clue-part').count(), 12);
    assert.equal(await page.locator('.letter-tile').count(), 20);
    assert.equal(await page.locator('.game-head > button').count(), 5);
    assert.equal(await page.locator('#current-clue').textContent(), initial.active.clue);

    const sizing = await page.evaluate(() => {
      const cell = document.querySelector('.grid-cell.answer').getBoundingClientRect();
      const board = document.querySelector('.scanword-grid').getBoundingClientRect();
      const area = document.querySelector('.board-area').getBoundingClientRect();
      const clue = document.querySelector('.clue-bar').getBoundingClientRect();
      const header = document.querySelector('.game-head').getBoundingClientRect();
      const tiles = document.querySelector('.letter-tiles').getBoundingClientRect();
      const lastTile = document.querySelector('.letter-tile:last-child').getBoundingClientRect();
      const tileRows = [...new Set([...document.querySelectorAll('.letter-tile')].map((tile) => Math.round(tile.getBoundingClientRect().top)))];
      const tileMinimum = innerHeight <= 700 ? 88 : 96;
      const expectedCell = Math.min(innerWidth / 10, (document.querySelector('.game-screen').clientHeight - header.height - clue.height - tileMinimum) / 7);
      return { cellWidth: cell.width, cellHeight: cell.height, boardTop: board.top, boardBottom: board.bottom,
        areaTop: area.top, areaBottom: area.bottom, clueTop: clue.top, clueBottom: clue.bottom,
        headerBottom: header.bottom, tilesTop: tiles.top, tilesBottom: tiles.bottom,
        lastTileBottom: lastTile.bottom, boardWidth: board.width, clueWidth: clue.width,
        headerWidth: header.width, tilesWidth: tiles.width, innerWidth, innerHeight, expectedCell,
        tileRows: tileRows.length };
    });
    assert.ok(Math.abs(sizing.cellWidth - sizing.cellHeight) < 0.1, JSON.stringify(sizing));
    assert.ok(Math.abs(sizing.cellWidth - sizing.expectedCell) <= 1, JSON.stringify(sizing));
    assert.ok(Math.abs(sizing.headerBottom - sizing.boardTop) < 1, `gap below thin header: ${JSON.stringify(sizing)}`);
    assert.ok(Math.abs(sizing.areaBottom - sizing.clueTop) < 1, `gap before clue bar: ${JSON.stringify(sizing)}`);
    assert.ok(Math.abs(sizing.clueBottom - sizing.tilesTop) < 1, `gap before tile rows: ${JSON.stringify(sizing)}`);
    assert.equal(sizing.tileRows, 2);
    assert.ok(Math.abs(sizing.boardWidth - sizing.clueWidth) < 1, JSON.stringify(sizing));
    assert.ok(Math.abs(sizing.boardWidth - sizing.headerWidth) < 1, JSON.stringify(sizing));
    assert.ok(Math.abs(sizing.boardWidth - sizing.tilesWidth) < 1, JSON.stringify(sizing));
    assert.ok(sizing.innerHeight - sizing.tilesBottom < 2, `tiles not flush to bottom: ${JSON.stringify(sizing)}`);
    assert.ok(sizing.lastTileBottom <= sizing.innerHeight + 1, `bottom tile clipped: ${JSON.stringify(sizing)}`);
    if (scenario.name.startsWith('iphone')) assert.ok(Math.abs(sizing.boardWidth - sizing.innerWidth) < 1, JSON.stringify(sizing));

    const fit = await page.evaluate(() => [...document.querySelectorAll('.clue-part')].map((part) => {
      const text = part.querySelector('.clue-text').getBoundingClientRect();
      const arrow = part.querySelector('.clue-arrow').getBoundingClientRect();
      const box = part.getBoundingClientRect();
      return { clue: part.innerText, left: text.left >= box.left - .5, right: text.right <= box.right + .5,
        top: text.top >= box.top - .5, bottom: text.bottom <= arrow.top + 1 };
    }));
    assert.ok(fit.every((item) => item.left && item.right && item.top && item.bottom), JSON.stringify(fit));

    const fullClueFits = await page.evaluate(() => {
      const clue = document.querySelector('#current-clue');
      clue.textContent = 'Признаки и качества объекта';
      return clue.scrollWidth <= clue.clientWidth + 1 && clue.scrollHeight <= clue.clientHeight + 1;
    });
    assert.equal(fullClueFits, true, 'current clue must render fully without truncation');
    await page.locator('.clue-part').first().click();
    await page.screenshot({ path: path.join(output, `${scenario.name}-light.png`), fullPage: false });

    await page.locator('.letter-tile').first().click();
    const afterLetter = JSON.parse(await page.evaluate(() => window.render_game_to_text()));
    assert.equal(afterLetter.filledCells, initial.filledCells + 1);
    await page.locator('#delete-button').click();
    assert.equal(JSON.parse(await page.evaluate(() => window.render_game_to_text())).filledCells, initial.filledCells);
    await page.locator('.letter-tile').nth(1).click();

    await page.locator('#hints-button').click();
    await page.locator('#hint-extras').click();
    assert.equal(await page.locator('.letter-tile').count(), 20);
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
    assert.equal(await page.locator('#puzzle-list button').count(), 10);
    await page.locator('#close-menu').click();
    await page.screenshot({ path: path.join(output, `${scenario.name}-game.png`), fullPage: false });

    if (scenario.name === 'iphone-se') {
      for (let index = 0; index < 10; index += 1) {
        await page.locator('#menu-button').click();
        await page.locator('#puzzle-list button').nth(index).click();
        assert.equal(await page.locator('.grid-cell').count(), 70, `puzzle ${index + 1}`);
        const allCluesFit = await page.evaluate(() => [...document.querySelectorAll('.clue-part')].every((part) => {
          const text = part.querySelector('.clue-text').getBoundingClientRect();
          const arrow = part.querySelector('.clue-arrow').getBoundingClientRect();
          const box = part.getBoundingClientRect();
          return text.left >= box.left - .5 && text.right <= box.right + .5 && text.top >= box.top - .5 && text.bottom <= arrow.top + 1;
        }));
        assert.equal(allCluesFit, true, `puzzle ${index + 1}: a clue is clipped on iPhone SE`);
      }
    }

    const stored = await page.evaluate(() => localStorage.getItem('nadiia-scanwords-v10'));
    assert.ok(stored && stored.includes('scanword-001'));
    await page.reload({ waitUntil: 'domcontentloaded' });
    assert.ok(JSON.parse(await page.evaluate(() => window.render_game_to_text())).filledCells >= 1);
    assert.deepEqual(errors, []);
    await context.close();
  }
  await browser.close();
  console.log('Browser smoke: v10 hand-authored composition passed on iPhone SE, iPhone, and landscape tablet.');
})().catch((error) => { console.error(error); process.exitCode = 1; });
