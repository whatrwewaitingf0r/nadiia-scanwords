const test = require('node:test');
const assert = require('node:assert/strict');
const puzzles = require('../data/puzzles.json');

// Every visible run from a clue must end at its own answer, not at an
// adjacent letter belonging to another word (e.g. МЫЛО + Т from БИНТ).
test('every forward entry has an exact-length highlighted run', () => {
  for (const puzzle of puzzles) {
    const letters = new Map();
    const owners = new Map();
    const clues = new Set();
    const blocks = new Set(puzzle.blocks.map(({row, col}) => `${row}:${col}`));
    for (const word of puzzle.words) {
      assert.ok(['across', 'down'].includes(word.direction), `${puzzle.id}: reverse entry`);
      assert.equal(word.arrow, word.direction === 'across' ? '→' : '↓');
      const [dr, dc] = word.direction === 'across' ? [0, 1] : [1, 0];
      assert.equal(word.row, word.clueCell.row + dr);
      assert.equal(word.col, word.clueCell.col + dc);
      clues.add(`${word.clueCell.row}:${word.clueCell.col}`);
      [...word.answer].forEach((letter, index) => {
        const row = word.row + dr * index, col = word.col + dc * index;
        assert.ok(row >= 0 && row < 7 && col >= 0 && col < 10, `${puzzle.id}: ${word.answer} out of bounds`);
        const key = `${row}:${col}`;
        if (letters.has(key)) {
          assert.equal(letters.get(key), letter, `${puzzle.id}: conflicting crossing ${key}`);
          assert.notEqual(owners.get(key), word.direction, `${puzzle.id}: parallel overlap ${key}`);
        }
        letters.set(key, letter);
        owners.set(key, word.direction);
      });
    }
    for (const word of puzzle.words) {
      const [dr, dc] = word.direction === 'across' ? [0, 1] : [1, 0];
      const end = `${word.row + dr * word.answer.length}:${word.col + dc * word.answer.length}`;
      assert.ok(!letters.has(end), `${puzzle.id}: ${word.clue} (${word.answer}) continues into ${letters.get(end)} at ${end}`);
    }
    for (const key of clues) assert.ok(!letters.has(key), `${puzzle.id}: clue on letter ${key}`);
    for (const key of blocks) assert.ok(!letters.has(key) && !clues.has(key), `${puzzle.id}: block overlap ${key}`);
    assert.equal(new Set([...letters.keys(), ...clues, ...blocks]).size, 70, `${puzzle.id}: uncovered cell`);
  }
});

test('the soap and vessel clues retain their original four-letter answers', () => {
  const words = puzzles.flatMap(puzzle => puzzle.words);
  assert.equal(words.find(word => word.clue === 'Пенится в воде')?.answer, 'МЫЛО');
  assert.equal(words.find(word => word.clue === 'Круглый сосуд')?.answer, 'ЧАША');
});
