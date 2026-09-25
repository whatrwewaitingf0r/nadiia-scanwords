const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const puzzles = require('../data/puzzles.json');

test('v17 appends fifty original puzzles without touching the approved six', () => {
  assert.equal(puzzles.length, 56);
  assert.deepEqual(puzzles.map(p => p.number), Array.from({length: 56}, (_, i) => i + 1));
  const original = JSON.stringify(puzzles.slice(0, 6));
  assert.equal(crypto.createHash('sha256').update(original).digest('hex'), '9c81b4774643a68486db99a9a8dd5cd1705c55ea98ffb4e6c713f51ac60dea83');
  assert.equal(new Set(puzzles.flatMap(p => p.words.map(w => w.answer))).size,
    puzzles.flatMap(p => p.words).length);
  assert.equal(new Set(puzzles.flatMap(p => p.words.map(w => w.clue))).size,
    puzzles.flatMap(p => p.words).length);
  const levels = puzzles.slice(6).flatMap(p => p.words.map(w => w.difficulty));
  for (const [level, min, max] of [['E', .25, .35], ['M', .45, .55], ['H', .15, .25]]) {
    const proportion = levels.filter(value => value === level).length / levels.length;
    assert.ok(proportion >= min && proportion <= max, `${level}: ${proportion}`);
  }
  for (const puzzle of puzzles.slice(6)) {
    assert.equal(puzzle.rows, 7);
    assert.equal(puzzle.cols, 10);
    assert.ok(puzzle.words.length >= 8, puzzle.id);
    assert.ok(puzzle.category);
    assert.ok(puzzle.words.filter(w => w.topic === puzzle.category).length >= 3, puzzle.id);
    const cells = new Map();
    const clues = new Set();
    let crossings = 0;
    for (const word of puzzle.words) {
      assert.ok(['across', 'down'].includes(word.direction));
      assert.equal(word.arrow, word.direction === 'across' ? '→' : '↓');
      assert.match(word.answer, /^[А-ЯЁ]{4,10}$/u);
      assert.ok(word.clue.length <= 32, word.clue);
      const [dr, dc] = word.direction === 'across' ? [0, 1] : [1, 0];
      assert.equal(word.row, word.clueCell.row + dr);
      assert.equal(word.col, word.clueCell.col + dc);
      const clueKey = `${word.clueCell.row}:${word.clueCell.col}`;
      assert.ok(!clues.has(clueKey));
      clues.add(clueKey);
      [...word.answer].forEach((letter, i) => {
        const r = word.row + dr * i, c = word.col + dc * i;
        assert.ok(r >= 0 && r < 7 && c >= 0 && c < 10);
        const key = `${r}:${c}`;
        if (cells.has(key)) {
          assert.equal(cells.get(key).letter, letter, `${puzzle.id} ${key}`);
          assert.notEqual(cells.get(key).direction, word.direction);
          crossings++;
        } else cells.set(key, {letter, direction: word.direction});
      });
    }
    assert.ok(crossings >= 2, `${puzzle.id}: only ${crossings} crossings`);
    for (const key of clues) assert.ok(!cells.has(key));
    for (const word of puzzle.words) {
      const [dr, dc] = word.direction === 'across' ? [0, 1] : [1, 0];
      assert.ok(!cells.has(`${word.row + dr * word.answer.length}:${word.col + dc * word.answer.length}`), `${puzzle.id}: ${word.answer} continues`);
    }
    const blocks = new Set(puzzle.blocks.map(({row, col}) => `${row}:${col}`));
    for (const key of blocks) assert.ok(!cells.has(key) && !clues.has(key));
    assert.equal(new Set([...cells.keys(), ...clues, ...blocks]).size, 70);
  }
});
