(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.ScanwordGenerator = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const ROWS = 7;
  const COLS = 10;

  // [direction, answer length, clue row, clue column]. Each template is an
  // exact cover: all 70 cells are either a genuine clue or an answer letter.
  const TEMPLATES = [
    [
      ['across',5,6,4],['down',5,1,3],['down',6,0,2],['down',6,0,0],
      ['down',6,0,1],['left',6,0,9],['across',4,1,5],['down',4,1,4],
      ['across',4,4,5],['left',4,5,9],['left',4,3,9],['across',4,2,5],
    ],
    [
      ['across',6,0,3],['down',4,0,1],['down',4,0,0],['down',4,0,2],
      ['left',6,1,9],['left',6,3,9],['across',6,4,3],['across',6,2,3],
      ['left',4,6,4],['across',4,6,5],['left',4,5,9],['across',4,5,0],
    ],
    [
      ['left',5,6,9],['down',6,0,0],['down',4,2,1],['down',4,2,3],
      ['down',4,2,2],['left',4,5,8],['down',5,0,9],['across',4,3,4],
      ['left',4,2,8],['across',4,4,4],['across',7,0,1],['left',7,1,8],
    ],
    [
      ['down',4,0,9],['across',6,5,3],['down',4,2,1],['down',5,1,0],
      ['down',4,2,2],['across',4,4,3],['down',4,0,8],['left',4,3,7],
      ['left',4,2,7],['left',6,6,9],['across',6,1,1],['across',7,0,0],
    ],
    [
      ['down',6,0,9],['across',6,0,2],['down',6,0,0],['down',5,0,1],
      ['left',5,1,7],['down',4,1,8],['across',5,5,2],['across',5,3,2],
      ['left',5,4,7],['left',5,2,7],['across',7,6,1],
    ],
    [
      ['left',7,0,7],['down',5,0,8],['down',6,0,9],['across',6,6,2],
      ['down',4,2,0],['down',4,2,1],['left',4,5,6],['down',4,1,7],
      ['left',4,4,6],['left',4,2,6],['across',4,3,2],['across',6,1,0],
    ],
    [
      ['across',5,6,4],['down',4,2,2],['down',4,2,3],['down',6,0,0],
      ['down',5,1,1],['left',5,5,9],['left',4,2,8],['down',4,0,9],
      ['across',4,3,4],['left',4,4,8],['left',6,1,8],['across',7,0,1],
    ],
    [
      ['down',6,0,0],['across',8,0,1],['across',6,6,3],['down',4,2,1],
      ['down',4,2,2],['left',5,2,8],['down',4,1,9],['across',5,4,3],
      ['across',5,3,3],['left',5,5,8],['left',7,1,8],
    ],
    [
      ['down',6,0,0],['across',5,6,4],['down',4,2,3],['down',4,2,2],
      ['down',5,1,1],['left',5,5,9],['across',5,4,4],['left',5,2,9],
      ['left',5,3,9],['across',7,1,2],['across',8,0,1],
    ],
    [
      ['down',4,0,0],['left',4,6,4],['left',4,6,9],['left',7,5,7],
      ['down',5,0,9],['down',4,1,8],['across',5,3,2],['down',4,0,1],
      ['across',5,2,2],['left',5,1,7],['across',5,4,2],['left',6,0,8],
    ],
    [
      ['left',7,0,9],['down',6,0,0],['down',4,0,1],['across',5,1,2],
      ['down',5,1,8],['down',5,1,9],['left',4,3,6],['down',4,2,7],
      ['across',4,2,2],['across',4,4,2],['left',5,5,6],['across',5,6,1],
    ],
    [
      ['left',6,6,6],['down',5,1,7],['down',6,0,9],['down',6,0,8],
      ['across',5,5,1],['down',5,0,0],['left',5,3,6],['across',5,1,1],
      ['left',5,2,6],['across',5,4,1],['left',6,0,7],
    ],
  ];

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

  function makeWord(entry, id, direction, clueRow, clueCol) {
    const starts = {
      across: [clueRow, clueCol + 1],
      left: [clueRow, clueCol - 1],
      down: [clueRow + 1, clueCol],
    };
    const [row, col] = starts[direction];
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
    const template = TEMPLATES[(number - 1) % TEMPLATES.length];
    const pools = new Map();
    for (const [, length] of template) {
      if (pools.has(length)) continue;
      const entries = sourceWords.filter((entry) => [...entry.answer].length === length && entry.clue);
      const needed = template.filter((tile) => tile[1] === length).length;
      if (entries.length < needed) throw new Error(`Для сетки нужны ${needed} слов из ${length} букв`);
      pools.set(length, shuffled(entries, random));
    }
    const offsets = new Map();
    const words = template.map(([direction, length, clueRow, clueCol], index) => {
      const offset = offsets.get(length) || 0;
      offsets.set(length, offset + 1);
      return makeWord(pools.get(length)[offset], index + 1, direction, clueRow, clueCol);
    });

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
