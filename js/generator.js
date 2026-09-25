(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.ScanwordGenerator = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const SIZE = 15;
  const MAX_WORDS = 11;

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

  function key(row, col) {
    return `${row}:${col}`;
  }

  function cellsFor(answer, row, col, direction) {
    return [...answer].map((letter, index) => ({
      row: row + (direction === 'down' ? index : 0),
      col: col + (direction === 'across' ? index : 0),
      letter,
      index,
    }));
  }

  function clueCellFor(row, col, direction) {
    return direction === 'across'
      ? { row, col: col - 1 }
      : { row: row - 1, col };
  }

  function inside(row, col) {
    return row >= 0 && col >= 0 && row < SIZE && col < SIZE;
  }

  function canPlace(board, clues, answer, row, col, direction, requireCrossing) {
    const cells = cellsFor(answer, row, col, direction);
    const clueCell = clueCellFor(row, col, direction);
    if (!inside(clueCell.row, clueCell.col) || clues.has(key(clueCell.row, clueCell.col)) || board.has(key(clueCell.row, clueCell.col))) return null;
    if (cells.some((cell) => !inside(cell.row, cell.col) || clues.has(key(cell.row, cell.col)))) return null;

    const before = direction === 'across' ? { row, col: col - 1 } : { row: row - 1, col };
    const after = direction === 'across'
      ? { row, col: col + answer.length }
      : { row: row + answer.length, col };
    if (inside(after.row, after.col) && board.has(key(after.row, after.col))) return null;
    if (!inside(before.row, before.col)) return null;

    let crossings = 0;
    for (const cell of cells) {
      const current = board.get(key(cell.row, cell.col));
      if (current) {
        if (current.letter !== cell.letter || current.directions.has(direction)) return null;
        crossings += 1;
        continue;
      }

      const neighbors = direction === 'across'
        ? [{ row: cell.row - 1, col: cell.col }, { row: cell.row + 1, col: cell.col }]
        : [{ row: cell.row, col: cell.col - 1 }, { row: cell.row, col: cell.col + 1 }];
      if (neighbors.some((neighbor) => inside(neighbor.row, neighbor.col) && board.has(key(neighbor.row, neighbor.col)))) return null;
    }
    if (requireCrossing && crossings === 0) return null;
    return { cells, clueCell, crossings };
  }

  function putWord(board, clues, entry, placement, id, direction) {
    const word = {
      id: `w${id}`,
      answer: entry.answer,
      clue: entry.clue,
      row: placement.cells[0].row,
      col: placement.cells[0].col,
      direction,
      clueCell: placement.clueCell,
      arrow: direction === 'across' ? '→' : '↓',
      crossings: [],
    };
    clues.set(key(placement.clueCell.row, placement.clueCell.col), word.id);
    for (const cell of placement.cells) {
      const cellKey = key(cell.row, cell.col);
      const current = board.get(cellKey);
      if (current) {
        word.crossings.push({ row: cell.row, col: cell.col });
        current.wordIds.forEach((otherId) => {
          const other = board.words.find((item) => item.id === otherId);
          if (other && !other.crossings.some((crossing) => crossing.row === cell.row && crossing.col === cell.col)) {
            other.crossings.push({ row: cell.row, col: cell.col });
          }
        });
        current.directions.add(direction);
        current.wordIds.add(word.id);
      } else {
        board.set(cellKey, { letter: cell.letter, directions: new Set([direction]), wordIds: new Set([word.id]) });
      }
    }
    board.words.push(word);
    return word;
  }

  function placementOptions(board, clues, entry, direction) {
    const options = [];
    for (const [cellKey, occupied] of board.entries()) {
      if (cellKey === 'words') continue;
      const [crossRow, crossCol] = cellKey.split(':').map(Number);
      [...entry.answer].forEach((letter, index) => {
        if (letter !== occupied.letter) return;
        const row = crossRow - (direction === 'down' ? index : 0);
        const col = crossCol - (direction === 'across' ? index : 0);
        const checked = canPlace(board, clues, entry.answer, row, col, direction, true);
        if (checked) {
          const distance = Math.abs(row + entry.answer.length / 2 - SIZE / 2) + Math.abs(col - SIZE / 2);
          options.push({ ...checked, direction, score: checked.crossings * 100 - distance });
        }
      });
    }
    return options;
  }

  function buildAttempt(sourceWords, seed, number) {
    const random = randomFactory(seed);
    const candidates = shuffled(
      sourceWords.filter((entry) => /^[А-ЯЁ]{4,12}$/u.test(entry.answer) && entry.clue),
      random,
    );
    const board = new Map();
    board.words = [];
    const clues = new Map();
    const first = candidates.shift();
    const startCol = Math.max(1, Math.floor((SIZE - first.answer.length) / 2));
    const firstPlacement = canPlace(board, clues, first.answer, Math.floor(SIZE / 2), startCol, 'across', false);
    putWord(board, clues, first, firstPlacement, 1, 'across');

    let passes = 0;
    while (board.words.length < MAX_WORDS && passes < 4) {
      let added = false;
      for (const entry of candidates) {
        if (board.words.some((word) => word.answer === entry.answer)) continue;
        const directions = board.words.filter((word) => word.direction === 'across').length <= board.words.filter((word) => word.direction === 'down').length
          ? ['across', 'down']
          : ['down', 'across'];
        const options = directions.flatMap((direction) => placementOptions(board, clues, entry, direction));
        if (!options.length) continue;
        options.sort((a, b) => b.score - a.score || random() - 0.5);
        const chosen = options[0];
        putWord(board, clues, entry, chosen, board.words.length + 1, chosen.direction);
        added = true;
        if (board.words.length >= MAX_WORDS) break;
      }
      if (!added) break;
      passes += 1;
    }

    return {
      id: `scanword-${String(number).padStart(3, '0')}`,
      number,
      title: `Сканворд №${String(number).padStart(3, '0')}`,
      seed,
      rows: SIZE,
      cols: SIZE,
      words: board.words,
    };
  }

  function createPuzzle(sourceWords, seed, number) {
    let best = null;
    for (let attempt = 0; attempt < 12; attempt += 1) {
      const puzzle = buildAttempt(sourceWords, `${seed}:${attempt}`, number);
      if (!best || puzzle.words.length > best.words.length) best = puzzle;
      if (puzzle.words.length >= 8 && puzzle.words.some((word) => word.direction === 'down')) return puzzle;
    }
    if (!best || best.words.length < 8) throw new Error(`Не удалось собрать сетку ${number}: ${best ? best.words.length : 0} слов`);
    return best;
  }

  return { createPuzzle, randomFactory };
});

