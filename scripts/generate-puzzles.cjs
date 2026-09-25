const fs = require('node:fs');
const path = require('node:path');
const { createPuzzle } = require('../js/generator.js');

const root = path.join(__dirname, '..');
const wordsPath = path.join(root, 'data', 'words.json');
const words = JSON.parse(fs.readFileSync(wordsPath, 'utf8'));
const puzzles = Array.from({ length: 48 }, (_, index) => createPuzzle(words, `nadiia-${index + 1}-2026`, index + 1));

fs.writeFileSync(path.join(root, 'data', 'puzzles.json'), `${JSON.stringify(puzzles, null, 2)}\n`);
fs.writeFileSync(path.join(root, 'data', 'puzzles.js'), `window.SCANWORD_PUZZLES = ${JSON.stringify(puzzles)};\n`);
fs.writeFileSync(path.join(root, 'data', 'words.js'), `window.SCANWORD_WORDS = ${JSON.stringify(words)};\n`);
console.log(`Создано ${puzzles.length} сканвордов из ${words.length} слов.`);

