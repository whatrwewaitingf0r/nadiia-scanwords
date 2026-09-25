const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const puzzles = require('../data/puzzles.json');

test('v18 answers always run forward from the clue cell', () => {
  for (const puzzle of puzzles) {
    assert.equal(puzzle.cols, 10);
    assert.equal(puzzle.rows, 7);
    for (const word of puzzle.words) {
      assert.ok(['across', 'down'].includes(word.direction), `${puzzle.id} ${word.answer}: reverse direction`);
      assert.equal(word.arrow, word.direction === 'across' ? '→' : '↓');
      const [dr, dc] = word.direction === 'across' ? [0, 1] : [1, 0];
      assert.equal(word.row, word.clueCell.row + dr);
      assert.equal(word.col, word.clueCell.col + dc);
    }
  }
});

test('v18 release assets and confetti for words and puzzle', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const app = fs.readFileSync(path.join(root, 'js/app.js'), 'utf8');
  assert.match(html, /content="v18"/);
  assert.doesNotMatch(html, /<script src="js\/generator\.js/, 'legacy reverse-fill generator must not load in v18');
  assert.match(app, /launchWordConfetti/);
  assert.match(app, /launchPuzzleConfetti/);
});
