const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const words = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/words.json'), 'utf8'));
const puzzles = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/puzzles.json'), 'utf8'));

function cellsFor(word) {
  const delta = word.direction === 'down' ? [1, 0] : word.direction === 'left' ? [0, -1] : [0, 1];
  return [...word.answer].map((letter, index) => ({
    row: word.row + delta[0] * index,
    col: word.col + delta[1] * index,
    letter,
  }));
}

function inspect(puzzle) {
  const answers = new Map();
  const clues = new Set();
  for (const word of puzzle.words) {
    const clueKey = `${word.clueCell.row}:${word.clueCell.col}`;
    assert.ok(!clues.has(clueKey), `${puzzle.id}: duplicate clue ${clueKey}`);
    assert.ok(!answers.has(clueKey), `${puzzle.id}: clue overlaps answer ${clueKey}`);
    clues.add(clueKey);
    const first = cellsFor(word)[0];
    const distance = Math.abs(first.row - word.clueCell.row) + Math.abs(first.col - word.clueCell.col);
    assert.equal(distance, 1, `${puzzle.id}/${word.id}: answer must start in the next cell`);
    for (const cell of cellsFor(word)) {
      assert.ok(cell.row >= 0 && cell.row < puzzle.rows && cell.col >= 0 && cell.col < puzzle.cols, `${puzzle.id}: out of bounds`);
      const key = `${cell.row}:${cell.col}`;
      if (answers.has(key)) assert.equal(answers.get(key), cell.letter, `${puzzle.id}: conflicting crossing at ${key}`);
      answers.set(key, cell.letter);
    }
  }
  const used = new Set([...answers.keys(), ...clues]);
  return { answers, clues, occupancy: used.size / (puzzle.rows * puzzle.cols) };
}

test('generator exports deterministic packed 10 by 7 scanwords', () => {
  const { createPuzzle } = require('../js/generator.js');
  const first = createPuzzle(words, 'packed-v5', 1);
  const again = createPuzzle(words, 'packed-v5', 1);
  assert.deepEqual(first, again);
  assert.equal(first.cols, 10);
  assert.equal(first.rows, 7);
  assert.ok(first.words.some((word) => word.direction === 'across'));
  assert.ok(first.words.some((word) => word.direction === 'left'));
  assert.ok(first.words.some((word) => word.direction === 'down'));
  assert.ok(inspect(first).occupancy >= 0.85);
});

test('catalog keeps 90 numbered high-fill puzzles with clue-in-cell geometry', () => {
  assert.equal(puzzles.length, 90);
  assert.deepEqual(puzzles.map((p) => p.number), Array.from({ length: 90 }, (_, i) => i + 1));
  assert.equal(new Set(puzzles.map((p) => JSON.stringify(p.words))).size, 90);
  for (const puzzle of puzzles) {
    assert.equal(puzzle.cols, 10, puzzle.id);
    assert.equal(puzzle.rows, 7, puzzle.id);
    assert.ok(puzzle.words.every((word) => ['across', 'left', 'down'].includes(word.direction)), puzzle.id);
    assert.ok(inspect(puzzle).occupancy >= 0.85, `${puzzle.id}: sparse board`);
  }
});

test('source dictionary stays original-looking Russian material and includes short words for packing', () => {
  assert.ok(words.length >= 150);
  assert.ok(words.filter((word) => [...word.answer].length === 4).length >= 20);
  assert.equal(new Set(words.map((word) => word.answer)).size, words.length);
  for (const word of words) assert.match(word.answer, /^[А-ЯЁ]{4,12}$/u);
});
