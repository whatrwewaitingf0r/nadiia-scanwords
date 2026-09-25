const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('page is direct-file and iPhone ready', () => {
  const html = read('index.html');
  const css = read('styles.css');
  assert.match(html, /viewport-fit=cover/);
  assert.doesNotMatch(html, /type=["']module["']/);
  assert.match(html, /data\/puzzles\.js/);
  assert.match(css, /safe-area-inset-bottom/);
  assert.match(css, /height:\s*100dvh/);
  assert.match(css, /grid-template-rows:\s*repeat\(var\(--board-rows\),/);
  assert.ok(html.indexOf('class="clue-bar"') < html.indexOf('id="letter-tiles"'), 'two tile rows must follow the current clue directly');
  assert.match(css, /-webkit-text-size-adjust:\s*100%/);
  assert.match(css, /min-width:\s*44px/);
  assert.match(css, /grid-template-rows:\s*repeat\(2,minmax\(44px,1fr\)\)/);
});

test('Russian gameplay labels and offline assets are present', () => {
  const html = read('index.html');
  const app = read('js/app.js');
  assert.match(html, />Подсказки</);
  assert.match(html, /aria-label="Тема"/);
  assert.match(app, /localStorage/);
  assert.match(app, /render_game_to_text/);
  assert.doesNotMatch(`${html}${app}`, /MBEX/i);
});
