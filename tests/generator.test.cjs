const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');

test('generator exports deterministic playable scanwords', () => {
  const { createPuzzle } = require('../js/generator.js');
  const words = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/words.json'), 'utf8'));
  const first = createPuzzle(words, 20260925, 1);
  const again = createPuzzle(words, 20260925, 1);

  assert.deepEqual(first, again);
  assert.ok(first.words.length >= 8, 'a puzzle needs at least eight answers');
  assert.ok(first.words.some((word) => word.direction === 'across'));
  assert.ok(first.words.some((word) => word.direction === 'down'));
  assert.ok(first.words.some((word) => word.crossings.length > 0), 'words should cross');
});

test('generated word coordinates, clues and crossings are internally valid', () => {
  const { createPuzzle } = require('../js/generator.js');
  const words = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/words.json'), 'utf8'));
  const puzzle = createPuzzle(words, 19, 19);
  const occupied = new Map();

  for (const word of puzzle.words) {
    assert.match(word.answer, /^[А-ЯЁ]{4,12}$/u);
    assert.ok(word.clue.length >= 4);
    assert.ok(['across', 'down'].includes(word.direction));
    assert.ok(word.clueCell.row >= 0 && word.clueCell.col >= 0);
    assert.equal(word.arrow, word.direction === 'across' ? '→' : '↓');

    [...word.answer].forEach((letter, index) => {
      const row = word.row + (word.direction === 'down' ? index : 0);
      const col = word.col + (word.direction === 'across' ? index : 0);
      assert.ok(row < puzzle.rows && col < puzzle.cols);
      const key = `${row}:${col}`;
      if (occupied.has(key)) assert.equal(occupied.get(key), letter, `conflict at ${key}`);
      occupied.set(key, letter);
    });
  }
});

test('catalog contains at least 40 unique numbered JSON puzzles', () => {
  const puzzles = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/puzzles.json'), 'utf8'));
  assert.ok(puzzles.length >= 40);
  assert.deepEqual(puzzles.map((p) => p.number), puzzles.map((_, i) => i + 1));
  assert.equal(new Set(puzzles.map((p) => JSON.stringify(p.words))).size, puzzles.length);
  for (const puzzle of puzzles) {
    assert.ok(puzzle.words.length >= 8);
    assert.ok(puzzle.words.some((word) => word.direction === 'across'));
    assert.ok(puzzle.words.some((word) => word.direction === 'down'));
    const answers = new Map();
    const clues = new Set();
    for (const word of puzzle.words) {
      const clueKey = `${word.clueCell.row}:${word.clueCell.col}`;
      assert.ok(!clues.has(clueKey), `${puzzle.id}: duplicate clue ${clueKey}`);
      assert.ok(!answers.has(clueKey), `${puzzle.id}: clue overlaps answer ${clueKey}`);
      clues.add(clueKey);
      [...word.answer].forEach((letter, index) => {
        const row = word.row + (word.direction === 'down' ? index : 0);
        const col = word.col + (word.direction === 'across' ? index : 0);
        const key = `${row}:${col}`;
        assert.ok(row >= 0 && row < puzzle.rows && col >= 0 && col < puzzle.cols, `${puzzle.id}: ${key} out of bounds`);
        assert.ok(!clues.has(key), `${puzzle.id}: answer overlaps clue ${key}`);
        if (answers.has(key)) assert.equal(answers.get(key), letter, `${puzzle.id}: conflicting crossing ${key}`);
        answers.set(key, letter);
      });
    }
  }
});

test('source dictionary contains unique Russian words of requested length', () => {
  const words = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/words.json'), 'utf8'));
  assert.ok(words.length >= 100);
  assert.equal(new Set(words.map((word) => word.answer)).size, words.length);
  for (const word of words) assert.match(word.answer, /^[А-ЯЁ]{4,12}$/u);
});
