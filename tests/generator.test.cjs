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
  const clues = new Map();
  let crossingCells = 0;
  for (const word of puzzle.words) {
    const clueKey = `${word.clueCell.row}:${word.clueCell.col}`;
    assert.ok(!answers.has(clueKey), `${puzzle.id}: clue overlaps answer ${clueKey}`);
    clues.set(clueKey, (clues.get(clueKey) || 0) + 1);
    assert.ok(clues.get(clueKey) <= 2, `${puzzle.id}: at most two newspaper clues may share ${clueKey}`);
    const first = cellsFor(word)[0];
    const distance = Math.abs(first.row - word.clueCell.row) + Math.abs(first.col - word.clueCell.col);
    assert.equal(distance, 1, `${puzzle.id}/${word.id}: answer must start in the next cell`);
    for (const cell of cellsFor(word)) {
      assert.ok(cell.row >= 0 && cell.row < puzzle.rows && cell.col >= 0 && cell.col < puzzle.cols, `${puzzle.id}: out of bounds`);
      const key = `${cell.row}:${cell.col}`;
      if (answers.has(key)) {
        assert.equal(answers.get(key).letter, cell.letter, `${puzzle.id}: conflicting crossing at ${key}`);
        answers.get(key).uses += 1;
      } else answers.set(key, { letter: cell.letter, uses: 1 });
    }
  }
  crossingCells = [...answers.values()].filter((cell) => cell.uses > 1).length;
  const used = new Set([...answers.keys(), ...clues.keys()]);
  return {
    answers,
    clues,
    crossingCells,
    occupancy: used.size / (puzzle.rows * puzzle.cols),
    clueRows: new Set([...clues.keys()].map((value) => value.split(':')[0])).size,
    clueCols: new Set([...clues.keys()].map((value) => value.split(':')[1])).size,
  };
}

test('generator exports deterministic newspaper-style 10 by 14 scanwords', () => {
  const { createPuzzle } = require('../js/generator.js');
  const first = createPuzzle(words, 'packed-v8', 1);
  const again = createPuzzle(words, 'packed-v8', 1);
  assert.deepEqual(first, again);
  assert.equal(first.cols, 10);
  assert.equal(first.rows, 14);
  assert.ok(first.words.length >= 24);
  assert.ok(first.words.some((word) => word.direction === 'across'));
  assert.ok(first.words.some((word) => word.direction === 'left'));
  assert.ok(first.words.some((word) => word.direction === 'down'));
  const report = inspect(first);
  assert.equal(report.occupancy, 1, 'every rendered cell must be a real clue or answer letter');
  assert.ok(report.crossingCells >= 4, 'the packed grid must contain real crossings');
  assert.ok(report.clueRows >= 10, 'clues must be scattered through the tall newspaper grid');
  assert.ok(report.clueCols >= 7, 'clues must be scattered across the grid');
});

test('catalog keeps numbered zero-blank puzzles with globally unique answers and scattered clue cells', () => {
  assert.ok(puzzles.length >= 7);
  assert.deepEqual(puzzles.map((p) => p.number), Array.from({ length: puzzles.length }, (_, i) => i + 1));
  assert.equal(new Set(puzzles.map((p) => JSON.stringify(p.words))).size, puzzles.length);
  const answers = puzzles.flatMap((puzzle) => puzzle.words.map((word) => word.answer));
  const clues = puzzles.flatMap((puzzle) => puzzle.words.map((word) => word.clue));
  assert.equal(new Set(answers).size, answers.length, 'answers must not repeat between puzzles');
  assert.equal(new Set(clues).size, clues.length, 'clues must not repeat between puzzles');
  for (const puzzle of puzzles) {
    assert.equal(puzzle.cols, 10, puzzle.id);
    assert.equal(puzzle.rows, 14, puzzle.id);
    assert.ok(puzzle.words.length >= 24, `${puzzle.id}: too few words`);
    assert.ok(puzzle.words.every((word) => ['across', 'left', 'down'].includes(word.direction)), puzzle.id);
    const report = inspect(puzzle);
    assert.equal(report.occupancy, 1, `${puzzle.id}: contains a fake or unused cell`);
    assert.ok(report.crossingCells >= 4, `${puzzle.id}: needs real crossings`);
    assert.ok(report.clueRows >= 10, `${puzzle.id}: clues are bunched into rows`);
    assert.ok(report.clueCols >= 7, `${puzzle.id}: clues are bunched into columns`);
  }
});

test('source dictionary has enough unique classic scanword material for dense packing', () => {
  assert.ok(words.length >= 300);
  assert.ok(words.filter((word) => [...word.answer].length === 4).length >= 90);
  assert.ok(words.filter((word) => [...word.answer].length === 5).length >= 80);
  assert.equal(new Set(words.map((word) => word.answer)).size, words.length);
  for (const word of words) assert.match(word.answer, /^[А-ЯЁ]{4,12}$/u);
  assert.ok(words.every((word) => word.clue.length >= 5 && word.clue.length <= 60), 'clues must be short enough for a newspaper cell');
  assert.equal(words.find((word) => word.answer === 'ПЕЧАТЬ').clue, 'Оттиск удостоверительного штампа');
  assert.equal(words.find((word) => word.answer === 'ЕЖОНОК').clue, 'Детёныш ежа');
  assert.doesNotMatch(words.map((word) => word.clue).join('\n'), /гостя|хозяйк|разговаривающ|проверяющ|пишут ясную|вместо руки/i);
});
