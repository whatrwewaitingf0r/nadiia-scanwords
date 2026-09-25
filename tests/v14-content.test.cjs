const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const puzzles = JSON.parse(fs.readFileSync(path.join(root, 'data/puzzles.json'), 'utf8'));
const steps = { across: [0, 1], left: [0, -1], down: [1, 0], up: [-1, 0] };

test('v14 keeps six fully described landscape boards with horizontal and vertical answers', () => {
  assert.equal(puzzles.length, 6);
  const seenAnswers = new Set();
  const seenClues = new Set();
  for (const puzzle of puzzles) {
    assert.equal(puzzle.cols, 10);
    assert.equal(puzzle.rows, 7);
    assert.ok(puzzle.words.some(word => ['across', 'left'].includes(word.direction)), `${puzzle.id}: no horizontal answer`);
    assert.ok(puzzle.words.some(word => ['down', 'up'].includes(word.direction)), `${puzzle.id}: no vertical answer`);
    const clues = new Set();
    const letters = new Map();
    const owners = new Map();
    for (const word of puzzle.words) {
      assert.ok(!seenAnswers.has(word.answer), `repeated answer ${word.answer}`);
      assert.ok(!seenClues.has(word.clue), `repeated clue ${word.clue}`);
      seenAnswers.add(word.answer);
      seenClues.add(word.clue);
      assert.match(word.answer, /^[А-ЯЁ]{4,12}$/u);
      assert.ok(word.clue.length <= 32, `clue too long: ${word.clue}`);
      assert.ok(word.clue.trim().split(/\s+/u).length >= 2 && word.clue.trim().split(/\s+/u).length <= 6, `not a short newspaper clue: ${word.clue}`);
      assert.equal(word.arrow, { across: '→', left: '←', down: '↓', up: '↑' }[word.direction]);
      const clueKey = `${word.clueCell.row}:${word.clueCell.col}`;
      clues.add(clueKey);
      const [dr, dc] = steps[word.direction];
      assert.equal(word.row, word.clueCell.row + dr);
      assert.equal(word.col, word.clueCell.col + dc);
      [...word.answer].forEach((letter, index) => {
        const row = word.row + dr * index;
        const col = word.col + dc * index;
        assert.ok(row >= 0 && row < 7 && col >= 0 && col < 10, `${puzzle.id}: out of bounds`);
        const key = `${row}:${col}`;
        if (letters.has(key)) assert.equal(letters.get(key), letter, `${puzzle.id}: bad crossing ${key}`);
        if (owners.has(key)) {
          const other = owners.get(key);
          assert.notEqual(['across', 'left'].includes(other), ['across', 'left'].includes(word.direction), `${puzzle.id}: parallel overlap ${key}`);
        }
        owners.set(key, word.direction);
        letters.set(key, letter);
      });
    }
    const crossings = puzzle.words.reduce((count, word) => count + [...word.answer].filter((_, index) => {
      const [dr, dc] = steps[word.direction];
      const key = `${word.row + dr * index}:${word.col + dc * index}`;
      return puzzle.words.some(other => other !== word && [...other.answer].some((__, otherIndex) => {
        const [odr, odc] = steps[other.direction];
        return key === `${other.row + odr * otherIndex}:${other.col + odc * otherIndex}`;
      }));
    }).length, 0) / 2;
    assert.ok(crossings >= 2, `${puzzle.id}: needs shared across/down letters`);
    assert.equal(clues.size, puzzle.words.length, `${puzzle.id}: every clue occupies one distinct cell`);
    for (const clue of clues) assert.ok(!letters.has(clue), `${puzzle.id}: clue overlaps answer ${clue}`);
    const blocks = new Set((puzzle.blocks || []).map(block => `${block.row}:${block.col}`));
    for (const block of blocks) assert.ok(!letters.has(block) && !clues.has(block), `${puzzle.id}: block overlaps used cell ${block}`);
    assert.equal(new Set([...letters.keys(), ...clues, ...blocks]).size, 70, `${puzzle.id}: undescribed cell`);
  }
});

test('v14 is published without changing the v13 sizing geometry', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
  const app = fs.readFileSync(path.join(root, 'js/app.js'), 'utf8');
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.webmanifest'), 'utf8'));
  assert.match(html, /content="v14"/);
  assert.doesNotMatch(html, /\?v=13/);
  assert.match(html, /styles\.css\?v=14/);
  assert.match(html, /data\/puzzles\.js\?v=14/);
  assert.match(html, /js\/app\.js\?v=14/);
  assert.match(app, /sw\.js\?v=14/);
  assert.equal(manifest.start_url, './?v=14');
  assert.match(css, /--board-cols:\s*10/);
  assert.match(css, /--board-rows:\s*7/);
  assert.match(css, /--cell-h:/);
  assert.match(html, /class="board-area"[\s\S]*?<\/section>\s*<section class="clue-bar"/);
});
