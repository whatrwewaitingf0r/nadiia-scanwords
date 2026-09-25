(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.ScanwordGenerator = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const ROWS = 7;
  const COLS = 10;

  function hashSeed(value) {
    let hash = 2166136261;
    for (const char of String(value)) {
      hash ^= char.charCodeAt(0);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function randomFactory(seed) {
    let state = hashSeed(seed) || 1;
    return function random() {
      state += 0x6d2b79f5;
      let value = state;
      value = Math.imul(value ^ (value >>> 15), value | 1);
      value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
      return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
  }

  function shuffled(items, random) {
    const result = items.slice();
    for (let index = result.length - 1; index > 0; index -= 1) {
      const swap = Math.floor(random() * (index + 1));
      [result[index], result[swap]] = [result[swap], result[index]];
    }
    return result;
  }

  function makeWord(entry, id, row, col, direction, clueRow, clueCol) {
    return {
      id: `w${id}`,
      answer: entry.answer,
      clue: entry.clue,
      row,
      col,
      direction,
      clueCell: { row: clueRow, col: clueCol },
      arrow: direction === 'down' ? '↓' : direction === 'left' ? '←' : '→',
      crossings: [],
    };
  }

  function createPuzzle(sourceWords, seed, number) {
    const random = randomFactory(`${seed}:${number}`);
    const long = shuffled(sourceWords.filter((entry) => [...entry.answer].length === 9 && entry.clue), random);
    const short = shuffled(sourceWords.filter((entry) => [...entry.answer].length === 4 && entry.clue), random);
    if (long.length < 2 || short.length < COLS) throw new Error('Для плотной сетки нужны два слова из 9 букв и десять слов из 4 букв');

    const words = [
      makeWord(long[0], 1, 0, 1, 'across', 0, 0),
      makeWord(long[1], 2, 1, 8, 'left', 1, 9),
      ...short.slice(0, COLS).map((entry, index) => makeWord(entry, index + 3, 3, index, 'down', 2, index)),
    ];

    return {
      id: `scanword-${String(number).padStart(3, '0')}`,
      number,
      title: `Сканворд №${number}`,
      seed: String(seed),
      rows: ROWS,
      cols: COLS,
      words,
    };
  }

  return { createPuzzle, randomFactory };
});
