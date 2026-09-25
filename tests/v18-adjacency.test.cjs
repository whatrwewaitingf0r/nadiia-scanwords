const test = require('node:test');
const assert = require('node:assert/strict');
const puzzles = require('../data/puzzles.json');

test('every shared edge of two letter cells belongs to a defined entry', () => {
  assert.equal(puzzles.length, 56);
  assert.ok(puzzles[0].words.some(word => word.answer === 'ФОНАРЬ'));
  assert.ok(puzzles[0].words.some(word => word.answer === 'СИНИЦА'));
  for (const puzzle of puzzles) {
    const cells = new Set();
    const entryEdges = new Set();
    for (const word of puzzle.words) {
      const [dr, dc] = word.direction === 'across' ? [0, 1] : [1, 0];
      assert.ok(['across', 'down'].includes(word.direction));
      for (let i = 0; i < word.answer.length; i++) {
        const r = word.row + dr * i, c = word.col + dc * i;
        cells.add(`${r}:${c}`);
        if (i) {
          const previous = `${r-dr}:${c-dc}`;
          entryEdges.add([previous, `${r}:${c}`].sort().join('|'));
        }
      }
    }
    for (const key of cells) {
      const [r, c] = key.split(':').map(Number);
      for (const neighbor of [`${r+1}:${c}`, `${r}:${c+1}`]) {
        if (cells.has(neighbor)) {
          assert.ok(entryEdges.has([key, neighbor].sort().join('|')),
            `${puzzle.id}: orphan letter adjacency ${key}–${neighbor}`);
        }
      }
    }
  }
});
