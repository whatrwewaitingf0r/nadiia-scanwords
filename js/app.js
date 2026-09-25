(function () {
  'use strict';

  const STORAGE_KEY = 'slovolinii-progress-v1';
  const EXTRA_LETTERS = [...'АЕИОУНКЛМРСТВПЯ'];
  const KEYBOARD_ROWS = ['ЙЦУКЕНГШЩЗХЪ', 'ФЫВАПРОЛДЖЭ', 'ЯЧСМИТЬБЮ'];
  const puzzles = window.SCANWORD_PUZZLES || [];
  const wordBank = window.SCANWORD_WORDS || [];
  const generator = window.ScanwordGenerator;

  const elements = {
    catalog: document.querySelector('#catalog-screen'),
    game: document.querySelector('#game-screen'),
    catalogList: document.querySelector('#puzzle-catalog'),
    catalogProgress: document.querySelector('#catalog-progress'),
    title: document.querySelector('#game-title'),
    grid: document.querySelector('#scanword-grid'),
    tiles: document.querySelector('#letter-tiles'),
    direction: document.querySelector('#direction-badge'),
    activeLength: document.querySelector('#active-length'),
    percent: document.querySelector('#puzzle-percent'),
    dialog: document.querySelector('#complete-dialog'),
    keyboard: document.querySelector('#russian-keyboard'),
    keyboardToggle: document.querySelector('#keyboard-toggle'),
    hintExtras: document.querySelector('#hint-extras'),
  };

  let saved = readProgress();
  let state = null;

  function readProgress() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
    } catch (_) {
      return {};
    }
  }

  function writeProgress() {
    if (!state) return;
    saved[state.puzzle.id] = {
      cells: state.cells,
      revealed: [...state.revealed],
      completed: isPuzzleComplete(),
      updatedAt: Date.now(),
    };
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(saved)); } catch (_) { /* private mode */ }
  }

  function cellKey(row, col) { return `${row}:${col}`; }

  function solutionCells(puzzle) {
    const map = {};
    puzzle.words.forEach((word) => {
      [...word.answer].forEach((letter, index) => {
        const row = word.row + (word.direction === 'down' ? index : 0);
        const col = word.col + (word.direction === 'across' ? index : 0);
        const key = cellKey(row, col);
        map[key] ||= { letter, wordIds: [] };
        map[key].wordIds.push(word.id);
      });
    });
    return map;
  }

  function wordCells(word) {
    return [...word.answer].map((letter, index) => ({
      key: cellKey(
        word.row + (word.direction === 'down' ? index : 0),
        word.col + (word.direction === 'across' ? index : 0),
      ),
      letter,
      index,
    }));
  }

  function getActiveWord() {
    return state && state.puzzle.words.find((word) => word.id === state.activeWordId);
  }

  function progressFor(puzzle) {
    const stored = saved[puzzle.id];
    if (!stored) return 0;
    const solution = solutionCells(puzzle);
    const correct = Object.entries(solution).filter(([key, value]) => stored.cells && stored.cells[key] === value.letter).length;
    return Math.round((correct / Object.keys(solution).length) * 100);
  }

  function renderCatalog() {
    const completed = puzzles.filter((puzzle) => saved[puzzle.id] && saved[puzzle.id].completed).length;
    elements.catalogProgress.textContent = `${completed} из ${puzzles.length}`;
    elements.catalogList.replaceChildren(...puzzles.map((puzzle) => {
      const percent = progressFor(puzzle);
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `puzzle-card${percent === 100 ? ' is-complete' : ''}`;
      button.setAttribute('aria-label', `${puzzle.title}, выполнено ${percent}%`);
      button.innerHTML = `
        <span class="puzzle-number">№${String(puzzle.number).padStart(3, '0')}</span>
        <span class="puzzle-meta"><strong>${percent === 100 ? 'Разгадан' : percent ? 'Продолжить' : 'Новый'}</strong><span>${puzzle.words.length} слов</span><span class="mini-progress"><i style="--done:${percent}%"></i></span></span>
        ${percent === 100 ? '<span class="done-mark" aria-hidden="true">✓</span>' : ''}`;
      button.addEventListener('click', () => openPuzzle(puzzle));
      return button;
    }));
  }

  function openPuzzle(puzzle) {
    const stored = saved[puzzle.id] || {};
    state = {
      puzzle,
      solution: solutionCells(puzzle),
      cells: stored.cells || {},
      revealed: new Set(stored.revealed || []),
      activeWordId: puzzle.words[0].id,
      focusIndex: 0,
      extrasRemoved: false,
      tileOrder: {},
    };
    elements.title.textContent = puzzle.title;
    elements.catalog.hidden = true;
    elements.game.hidden = false;
    elements.dialog.hidden = true;
    selectWord(state.activeWordId, true);
    requestAnimationFrame(() => elements.grid.querySelector('.is-active')?.scrollIntoView({ block: 'center', inline: 'center' }));
  }

  function closePuzzle() {
    writeProgress();
    state = null;
    elements.game.hidden = true;
    elements.catalog.hidden = false;
    elements.dialog.hidden = true;
    renderCatalog();
    window.scrollTo(0, 0);
  }

  function renderBoard() {
    const clueMap = new Map(state.puzzle.words.map((word) => [cellKey(word.clueCell.row, word.clueCell.col), word]));
    const active = getActiveWord();
    const activeKeys = new Set(active ? wordCells(active).map((cell) => cell.key) : []);
    const fragment = document.createDocumentFragment();

    for (let row = 0; row < state.puzzle.rows; row += 1) {
      for (let col = 0; col < state.puzzle.cols; col += 1) {
        const key = cellKey(row, col);
        const clue = clueMap.get(key);
        const solution = state.solution[key];
        const button = document.createElement(clue || solution ? 'button' : 'div');
        button.className = 'grid-cell';
        button.setAttribute('role', 'gridcell');
        if (clue) {
          button.type = 'button';
          button.classList.add('clue');
          if (clue.id === state.activeWordId) button.classList.add('is-active');
          button.setAttribute('aria-label', `${clue.clue}, ${clue.direction === 'across' ? 'по горизонтали' : 'по вертикали'}`);
          button.innerHTML = `<span class="clue-arrow" aria-hidden="true">${clue.arrow}</span><span class="clue-text">${clue.clue}</span>`;
          button.addEventListener('click', () => selectWord(clue.id));
        } else if (solution) {
          button.type = 'button';
          button.classList.add('answer');
          const value = state.cells[key] || '';
          button.textContent = value;
          if (activeKeys.has(key)) button.classList.add('is-active');
          if (active && activeKeys.has(key) && wordCells(active)[state.focusIndex]?.key === key) button.classList.add('is-focus');
          if (state.revealed.has(key)) button.classList.add('is-revealed');
          if (value && value !== solution.letter) button.classList.add('is-wrong');
          button.setAttribute('aria-label', value ? `Буква ${value}` : 'Пустая клетка');
          button.addEventListener('click', () => selectCell(key));
        } else {
          button.classList.add('blank');
          button.setAttribute('aria-hidden', 'true');
        }
        fragment.append(button);
      }
    }
    elements.grid.replaceChildren(fragment);
  }

  function selectCell(key) {
    const wordIds = state.solution[key].wordIds;
    let nextId = wordIds[0];
    if (wordIds.length > 1 && wordIds.includes(state.activeWordId)) nextId = wordIds[(wordIds.indexOf(state.activeWordId) + 1) % wordIds.length];
    state.activeWordId = nextId;
    const word = getActiveWord();
    state.focusIndex = wordCells(word).findIndex((cell) => cell.key === key);
    state.extrasRemoved = false;
    render();
  }

  function selectWord(wordId, initial) {
    state.activeWordId = wordId;
    const cells = wordCells(getActiveWord());
    state.focusIndex = Math.max(0, cells.findIndex((cell) => !state.cells[cell.key]));
    state.extrasRemoved = false;
    render();
    if (!initial) elements.grid.querySelector('.is-focus')?.focus({ preventScroll: true });
  }

  function shuffledTiles(word) {
    const cacheKey = `${state.puzzle.seed}:${word.id}`;
    if (!state.tileOrder[cacheKey]) {
      const random = generator.randomFactory(cacheKey);
      const answerTiles = [...word.answer].map((letter, index) => ({ id: `a${index}`, letter, extra: false }));
      const extras = Array.from({ length: 2 }, (_, index) => ({
        id: `e${index}`,
        letter: EXTRA_LETTERS[Math.floor(random() * EXTRA_LETTERS.length)],
        extra: true,
      }));
      const all = answerTiles.concat(extras);
      for (let index = all.length - 1; index > 0; index -= 1) {
        const swap = Math.floor(random() * (index + 1));
        [all[index], all[swap]] = [all[swap], all[index]];
      }
      state.tileOrder[cacheKey] = all;
    }
    return state.tileOrder[cacheKey];
  }

  function renderTiles() {
    const word = getActiveWord();
    if (!word) {
      elements.tiles.textContent = 'Выберите подсказку в сетке';
      return;
    }
    const tiles = shuffledTiles(word).filter((tile) => !state.extrasRemoved || !tile.extra);
    elements.tiles.replaceChildren(...tiles.map((tile) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `letter-tile${tile.extra ? ' is-extra' : ''}`;
      button.textContent = tile.letter;
      button.setAttribute('aria-label', `Буква ${tile.letter}`);
      button.addEventListener('click', () => enterLetter(tile.letter));
      return button;
    }));
    elements.hintExtras.disabled = state.extrasRemoved;
  }

  function nextEditableIndex(cells, start) {
    for (let offset = 0; offset < cells.length; offset += 1) {
      const index = (start + offset) % cells.length;
      if (!state.revealed.has(cells[index].key) && !state.cells[cells[index].key]) return index;
    }
    return Math.min(start, cells.length - 1);
  }

  function enterLetter(letter) {
    const word = getActiveWord();
    if (!word || !/^[А-ЯЁ]$/u.test(letter)) return;
    const cells = wordCells(word);
    let index = state.focusIndex;
    if (state.revealed.has(cells[index].key)) index = nextEditableIndex(cells, index + 1);
    if (!state.revealed.has(cells[index].key)) state.cells[cells[index].key] = letter;
    state.focusIndex = nextEditableIndex(cells, index + 1);
    writeProgress();
    render();
    checkCompletion();
  }

  function deleteLetter() {
    const word = getActiveWord();
    if (!word) return;
    const cells = wordCells(word);
    let index = state.focusIndex;
    if (!state.cells[cells[index].key] && index > 0) index -= 1;
    if (!state.revealed.has(cells[index].key)) delete state.cells[cells[index].key];
    state.focusIndex = index;
    writeProgress();
    render();
  }

  function revealLetter() {
    const word = getActiveWord();
    if (!word) return;
    const cells = wordCells(word);
    let index = cells.findIndex((cell, cellIndex) => cellIndex >= state.focusIndex && state.cells[cell.key] !== cell.letter);
    if (index < 0) index = cells.findIndex((cell) => state.cells[cell.key] !== cell.letter);
    if (index < 0) return;
    state.cells[cells[index].key] = cells[index].letter;
    state.revealed.add(cells[index].key);
    state.focusIndex = nextEditableIndex(cells, index + 1);
    writeProgress();
    render();
    checkCompletion();
  }

  function revealWord() {
    const word = getActiveWord();
    if (!word) return;
    wordCells(word).forEach((cell) => {
      state.cells[cell.key] = cell.letter;
      state.revealed.add(cell.key);
    });
    writeProgress();
    render();
    checkCompletion();
  }

  function isPuzzleComplete() {
    return Boolean(state) && Object.entries(state.solution).every(([key, value]) => state.cells[key] === value.letter);
  }

  function checkCompletion() {
    if (!isPuzzleComplete()) return;
    writeProgress();
    window.setTimeout(() => { elements.dialog.hidden = false; }, 180);
  }

  function renderStatus() {
    const word = getActiveWord();
    elements.direction.textContent = word ? word.arrow : '•';
    elements.activeLength.textContent = word ? `${word.clue} · ${word.answer.length} букв` : 'Выберите слово';
    const total = Object.keys(state.solution).length;
    const correct = Object.entries(state.solution).filter(([key, value]) => state.cells[key] === value.letter).length;
    elements.percent.textContent = `${Math.round((correct / total) * 100)}%`;
  }

  function render() {
    renderBoard();
    renderTiles();
    renderStatus();
  }

  function resetPuzzle() {
    if (!window.confirm('Очистить все введённые буквы в этой сетке?')) return;
    state.cells = {};
    state.revealed.clear();
    state.extrasRemoved = false;
    delete saved[state.puzzle.id];
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(saved)); } catch (_) { /* private mode */ }
    render();
  }

  function openEndless() {
    const number = 1000 + Math.floor(Date.now() / 86400000);
    const seed = `endless-${Date.now()}-${Math.random()}`;
    const puzzle = generator.createPuzzle(wordBank, seed, number);
    puzzle.id = `endless-${Date.now()}`;
    puzzle.title = 'Свежая сетка';
    openPuzzle(puzzle);
  }

  function openNext() {
    const currentIndex = puzzles.findIndex((puzzle) => puzzle.id === state.puzzle.id);
    elements.dialog.hidden = true;
    if (currentIndex >= 0 && currentIndex < puzzles.length - 1) openPuzzle(puzzles[currentIndex + 1]);
    else closePuzzle();
  }

  function buildKeyboard() {
    const fragment = document.createDocumentFragment();
    KEYBOARD_ROWS.forEach((letters, rowIndex) => {
      const row = document.createElement('div');
      row.className = 'keyboard-row';
      [...letters].forEach((letter) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'key-button';
        button.textContent = letter;
        button.addEventListener('click', () => enterLetter(letter));
        row.append(button);
      });
      if (rowIndex === KEYBOARD_ROWS.length - 1) {
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'key-button key-wide';
        remove.textContent = '⌫';
        remove.setAttribute('aria-label', 'Удалить букву');
        remove.addEventListener('click', deleteLetter);
        row.append(remove);
      }
      fragment.append(row);
    });
    elements.keyboard.replaceChildren(fragment);
  }

  document.querySelector('#back-button').addEventListener('click', closePuzzle);
  document.querySelector('#catalog-button').addEventListener('click', closePuzzle);
  document.querySelector('#next-button').addEventListener('click', openNext);
  document.querySelector('#reset-button').addEventListener('click', resetPuzzle);
  document.querySelector('#endless-button').addEventListener('click', openEndless);
  document.querySelector('#hint-letter').addEventListener('click', revealLetter);
  document.querySelector('#hint-word').addEventListener('click', revealWord);
  elements.hintExtras.addEventListener('click', () => { state.extrasRemoved = true; renderTiles(); });
  elements.keyboardToggle.addEventListener('click', () => {
    const open = elements.keyboard.hidden;
    elements.keyboard.hidden = !open;
    elements.keyboardToggle.setAttribute('aria-expanded', String(open));
  });
  document.addEventListener('keydown', (event) => {
    if (!state || elements.game.hidden) return;
    const key = event.key.toUpperCase();
    if (/^[А-ЯЁ]$/u.test(key)) { event.preventDefault(); enterLetter(key); }
    if (event.key === 'Backspace' || event.key === 'Delete') { event.preventDefault(); deleteLetter(); }
    if (event.key === 'Escape' && !elements.dialog.hidden) elements.dialog.hidden = true;
  });

  window.render_game_to_text = function renderGameToText() {
    if (!state) return JSON.stringify({ mode: 'catalog', puzzles: puzzles.length });
    const word = getActiveWord();
    return JSON.stringify({
      mode: elements.dialog.hidden ? 'playing' : 'complete',
      coordinateSystem: 'row and col start at 0; rows grow down, columns grow right',
      puzzle: state.puzzle.number,
      activeWord: word ? { id: word.id, direction: word.direction, length: word.answer.length, clue: word.clue } : null,
      focusIndex: state.focusIndex,
      filledCells: Object.keys(state.cells).length,
      totalCells: Object.keys(state.solution).length,
      complete: isPuzzleComplete(),
    });
  };
  window.advanceTime = function advanceTime() { renderCatalog(); if (state) render(); };

  buildKeyboard();
  renderCatalog();
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
})();

