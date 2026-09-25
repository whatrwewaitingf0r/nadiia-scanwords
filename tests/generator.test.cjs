const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.join(__dirname, '..');
const words = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/words.json'), 'utf8'));
const puzzles = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/puzzles.json'), 'utf8'));
function cellsFor(word) {
  const delta = word.direction === 'down' ? [1, 0] : word.direction === 'up' ? [-1, 0] : word.direction === 'left' ? [0, -1] : [0, 1];
  return [...word.answer].map((letter, index) => ({row: word.row + delta[0] * index,col: word.col + delta[1] * index,letter}));
}
function inspect(puzzle) {
  const answers = new Map(); const clues = new Set();
  for (const word of puzzle.words) {
    const clueKey = `${word.clueCell.row}:${word.clueCell.col}`;
    assert.ok(!clues.has(clueKey), `${puzzle.id}: duplicate clue ${clueKey}`);
    assert.ok(!answers.has(clueKey), `${puzzle.id}: clue overlaps answer ${clueKey}`);
    clues.add(clueKey);
    const first = cellsFor(word)[0];
    assert.equal(Math.abs(first.row-word.clueCell.row)+Math.abs(first.col-word.clueCell.col),1);
    for (const cell of cellsFor(word)) {
      assert.ok(cell.row>=0&&cell.row<puzzle.rows&&cell.col>=0&&cell.col<puzzle.cols, `${puzzle.id}: out of bounds`);
      const key=`${cell.row}:${cell.col}`;
      if(answers.has(key)) assert.equal(answers.get(key),cell.letter,`${puzzle.id}: conflicting crossing`);
      answers.set(key,cell.letter);
    }
  }
  return new Set([...answers.keys(),...clues]);
}
test('generator exports deterministic large-cell 7 by 10 scanwords',()=>{
  const {createPuzzle}=require('../js/generator.js');
  const first=createPuzzle(words,'nadiia-v9',1),again=createPuzzle(words,'nadiia-v9',1);
  assert.deepEqual(first,again); assert.equal(first.cols,7); assert.equal(first.rows,10);
  assert.equal(first.words.length,12); assert.ok(first.words.some(w=>w.direction==='across')); assert.ok(first.words.some(w=>w.direction==='down'));
  assert.equal(inspect(first).size,70,'every cell must be a real clue or answer');
});
test('catalog keeps six handcrafted 10 by 7 boards',()=>{
  assert.equal(puzzles.length,6);
  const answers=puzzles.flatMap(p=>p.words.map(w=>w.answer));
  const clues=puzzles.flatMap(p=>p.words.map(w=>w.clue));
  assert.equal(new Set(answers).size,answers.length);
  assert.equal(new Set(clues).size,clues.length);
  for(const puzzle of puzzles){assert.equal(puzzle.cols,10);assert.equal(puzzle.rows,7);assert.equal(puzzle.words.length,10);assert.equal(inspect(puzzle).size,66);assert.equal(puzzle.blocks.length,4);}
});
test('dictionary remains original Russian material',()=>{
  assert.ok(words.length>=300);assert.equal(new Set(words.map(w=>w.answer)).size,words.length);
  for(const word of words)assert.match(word.answer,/^[А-ЯЁ]{4,12}$/u);
});
