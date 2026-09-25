const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const puzzles = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/puzzles.json'), 'utf8'));

function cellsFor(word) {
  const [dr, dc] = word.direction === 'down' ? [1, 0] : word.direction === 'left' ? [0, -1] : [0, 1];
  return [...word.answer].map((letter, index) => ({ row: word.row + dr * index, col: word.col + dc * index, letter }));
}

function inspect(puzzle) {
  const answers = new Map();
  const clues = new Map();
  for (const word of puzzle.words) {
    const clueKey = `${word.clueCell.row}:${word.clueCell.col}`;
    assert.ok(!answers.has(clueKey), `${puzzle.id}: clue overlaps an answer at ${clueKey}`);
    assert.ok(!clues.has(clueKey), `${puzzle.id}: clue cells must be single 1x1 blocks`);
    clues.set(clueKey, word);
    const first = cellsFor(word)[0];
    assert.equal(Math.abs(first.row - word.clueCell.row) + Math.abs(first.col - word.clueCell.col), 1,
      `${puzzle.id}/${word.id}: answer must begin immediately after its arrow`);
    for (const cell of cellsFor(word)) {
      assert.ok(cell.row >= 0 && cell.row < puzzle.rows && cell.col >= 0 && cell.col < puzzle.cols,
        `${puzzle.id}/${word.id}: answer leaves the board`);
      const cellKey = `${cell.row}:${cell.col}`;
      assert.ok(!clues.has(cellKey), `${puzzle.id}: answer overlaps clue ${cellKey}`);
      if (answers.has(cellKey)) assert.equal(answers.get(cellKey), cell.letter, `${puzzle.id}: bad crossing ${cellKey}`);
      answers.set(cellKey, cell.letter);
    }
  }
  return { answers, clues, used: new Set([...answers.keys(), ...clues.keys()]) };
}

test('catalog contains ten hand-authored 10 by 7 newspaper scanwords', () => {
  assert.equal(puzzles.length, 10);
  assert.deepEqual(puzzles.map((puzzle) => puzzle.number), [1,2,3,4,5,6,7,8,9,10]);
  assert.equal(new Set(puzzles.flatMap((puzzle) => puzzle.words.map((word) => word.answer))).size,
    puzzles.flatMap((puzzle) => puzzle.words).length, 'answers must be unique across the hand-authored set');
  for (const puzzle of puzzles) {
    assert.equal(puzzle.source, 'hand-authored', puzzle.id);
    assert.equal(puzzle.cols, 10, puzzle.id);
    assert.equal(puzzle.rows, 7, puzzle.id);
    assert.ok(puzzle.words.length >= 11, `${puzzle.id}: sparse clue packing`);
    assert.ok(puzzle.words.some((word) => word.direction === 'down'), `${puzzle.id}: missing down clue`);
    assert.ok(puzzle.words.some((word) => word.direction === 'left'), `${puzzle.id}: missing left clue`);
    assert.ok(puzzle.words.some((word) => word.direction === 'across'), `${puzzle.id}: missing right clue`);
    assert.ok(puzzle.words.every((word) => word.clue.length <= 23), `${puzzle.id}: clue text is too long for one cell`);
    assert.doesNotMatch(puzzle.words.map((word) => `${word.answer}\n${word.clue}`).join('\n'), /САЛАГА|ИСЛАМАБАД|ПЕНАЛ/u);
    assert.equal(inspect(puzzle).used.size, 70, `${puzzle.id}: every cell must be clue or letter`);
  }
});

test('the failed generator and generated word-bank pipeline are gone', () => {
  assert.equal(fs.existsSync(path.join(ROOT, 'js/generator.js')), false);
  assert.equal(fs.existsSync(path.join(ROOT, 'scripts/generate-puzzles.cjs')), false);
  assert.doesNotMatch(fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8'), /generator\.js|words\.js/);
});
