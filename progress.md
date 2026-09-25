Original prompt: Build a new original Russian scanword web app from scratch with 40+ JSON puzzles, an endless generator, in-grid clues/arrows, word-line highlighting, Russian tile input and hints, localStorage/offline support, and iPhone/iPad responsive e-ink-friendly UI.

## Plan

- [x] Define and test the deterministic scanword generator and puzzle schema.
- [x] Generate 48 original catalog puzzles from a Russian 4–12 letter word bank.
- [x] Implement the offline catalog/game UI and Russian input/hints/progress.
- [x] Add iPhone/iPad responsive CSS and PWA/offline metadata.
- [x] Run unit, data-integrity, browser interaction, and visual mobile checks.

## Decisions

- Static HTML/CSS/JS with no runtime dependencies so `index.html` works via `file://`.
- Keep canonical data as JSON; generate small JS wrappers for direct-file loading.
- Build grids deterministically from a curated original clue/answer bank. Words cross where possible; clue cells contain their own arrow and text.

## Проверка

- `npm test`: 6/6 — генератор, 48 JSON-сеток, словарь, mobile/offline-markup.
- `node tests/browser-smoke.cjs http://127.0.0.1:8765/index.html`: iPhone SE и iPad — каталог, выбор слова, плитки, три подсказки, экранная клавиатура, сохранение после перезагрузки и завершение сетки.
- `node tests/browser-smoke.cjs`: тот же сценарий напрямую через `file://`.
- `node tests/offline-smoke.cjs http://127.0.0.1:8765/index.html`: каталог и игра загружаются при отключённой сети из service worker cache.
- Визуально проверены `output/mobile/iphone-se-*.png` и `output/mobile/ipad-*.png`: панель не перекрывает поле, клетки не меньше 44 px, сетка прокручивается, подсказки читаемы.

## Осталось

- Обязательных TODO нет. Для установки на экран iPhone с гарантированным офлайн-кэшем нужен первый запуск с HTTPS, как описано в README.
