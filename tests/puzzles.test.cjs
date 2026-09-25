const test = require('node:test');
const assert = require('node:assert/strict');
const puzzles = require('../data/puzzles.json');

test('v15 keeps six unique, compact newspaper puzzles', () => {
  assert.equal(puzzles.length, 6);
  assert.deepEqual(puzzles.map(puzzle => puzzle.number), [1, 2, 3, 4, 5, 6]);
  const answers = puzzles.flatMap(puzzle => puzzle.words.map(word => word.answer));
  const clues = puzzles.flatMap(puzzle => puzzle.words.map(word => word.clue));
  assert.equal(new Set(answers).size, answers.length);
  assert.equal(new Set(clues).size, clues.length);
  for (const puzzle of puzzles) {
    assert.equal(puzzle.words.length, 12);
    assert.ok(puzzle.blocks.length >= 1);
    assert.ok(puzzle.words.every(word => word.clue.length <= 30));
  }
});
