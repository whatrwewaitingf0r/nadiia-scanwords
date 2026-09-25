import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

assert.match(html, /content="v3"/, 'build must be marked v3');
assert.match(html, /id="scanwordGrid"/, 'scanword grid must exist');
assert.match(html, /id="letterTiles"/, 'letter tile area must exist');
assert.match(html, /grid-template-columns:\s*repeat\(14,/, 'grid must have fourteen packed columns');
assert.match(html, /grid-template-columns:\s*repeat\(10,\s*1fr\)/, 'tiles must form two full ten-column rows');
assert.match(html, /id="nativeKeyboard"/, 'native keyboard control must exist');
assert.match(html, /id="keyboardInput"[^>]*inputmode="text"/, 'keyboard control must focus a text input');
assert.match(html, /id="confetti"/, 'completion confetti layer must exist');
assert.match(html, /window\.render_game_to_text/, 'game must expose readable state');
assert.match(html, /window\.advanceTime/, 'game must expose deterministic stepping');
assert.doesNotMatch(html, /mbex|7600/i, 'published artifact must not reference copied source material');
assert.match(html, /'Пословицы и устойчивые выражения'/, 'catalog must use the requested proverbs category label');
assert.match(html, /'Смесь \/ классика сканворда'/, 'catalog must use the requested classic category label');

const tileLetters = html.match(/const TILE_ALPHABET\s*=\s*\[([^\]]+)\]/s)?.[1] ?? '';
assert.ok((tileLetters.match(/'/g) ?? []).length >= 40, 'tile alphabet must contain at least 20 letters');

console.log('scanword acceptance checks passed');
