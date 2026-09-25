const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const puzzles = JSON.parse(read('data/puzzles.json'));

test('six handcrafted 10 by 7 boards have no unused white cells', () => {
  assert.equal(puzzles.length, 6);
  const allAnswers = new Set();
  for (const puzzle of puzzles) {
    assert.equal(puzzle.cols, 10);
    assert.equal(puzzle.rows, 7);
    assert.equal(puzzle.words.length, 10);
    const letters = new Map();
    const clues = new Set();
    for (const word of puzzle.words) {
      assert.ok(word.clue.length <= 30, word.clue);
      assert.ok(!allAnswers.has(word.answer), word.answer);
      allAnswers.add(word.answer);
      const ck = `${word.clueCell.row}:${word.clueCell.col}`;
      clues.add(ck);
      const [dr, dc] = word.direction === 'down' ? [1, 0] : word.direction === 'left' ? [0, -1] : [0, 1];
      [...word.answer].forEach((letter, index) => {
        const row = word.row + dr * index, col = word.col + dc * index;
        assert.ok(row >= 0 && row < 7 && col >= 0 && col < 10);
        const key = `${row}:${col}`;
        assert.ok(!letters.has(key) || letters.get(key) === letter, key);
        letters.set(key, letter);
      });
    }
    for (const key of clues) assert.ok(!letters.has(key), key);
    assert.equal(letters.size, 56);
    assert.equal(clues.size, 10);
    assert.equal(puzzle.blocks.length, 4);
    for (const block of puzzle.blocks) {
      const key = `${block.row}:${block.col}`;
      assert.ok(!letters.has(key) && !clues.has(key));
    }
    assert.equal(letters.size + clues.size + puzzle.blocks.length, 70);
  }
});

test('v12 screen has edge-to-edge board and solid keyboard well', () => {
  const html = read('index.html'), css = read('styles.css'), app = read('js/app.js');
  assert.match(html, /content="v12"/);
  assert.match(css, /--board-cols:\s*10/);
  assert.match(css, /--board-rows:\s*7/);
  assert.match(css, /\.board-area\{[^}]*align-items:flex-start/s);
  assert.match(css, /\.keyboard-well\{[^}]*background:var\(--well\)/s);
  assert.match(app, /element\.classList\.add\('block'\)/);
  assert.match(app, /Math\.min\(availableWidth\/cols,availableHeight\/rows\)/);
});
