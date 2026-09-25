const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const read = name => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');

test('v16 gives all vertical slack to the board, not a keyboard well', () => {
  const html = read('index.html'), css = read('styles.css'), app = read('js/app.js');
  assert.match(html, /content="v16"/);
  assert.doesNotMatch(html, /keyboard-well/);
  assert.ok(html.indexOf('class="clue-bar"') < html.indexOf('id="letter-tiles"'));
  assert.ok(html.indexOf('id="letter-tiles"') < html.indexOf('class="game-foot"'));
  assert.match(css, /\.board-area\{[^}]*flex:1 1 0/s);
  assert.match(css, /--cell-w:/);
  assert.match(css, /--cell-h:/);
  assert.doesNotMatch(css.match(/\.clue-text\{[^}]*\}/)?.[0] || '', /-webkit-line-clamp/);
  assert.match(app, /availableHeight\/rows/);
});
