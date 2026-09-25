const fs = require('node:fs');
const path = require('node:path');
const { createPuzzle } = require('../js/generator.js');

const root = path.join(__dirname, '..');
const wordsPath = path.join(root, 'data', 'words.json');
const words = JSON.parse(fs.readFileSync(wordsPath, 'utf8'));
const categories = ['Разминка','Биология','Культуры стран','Общие знания','География','История','Литература','Искусство','Наука','Еда и кухни мира'];
const puzzles = Array.from({ length: 90 }, (_, index) => { const puzzle=createPuzzle(words, `nadiia-v4-${index + 1}`, index + 1); puzzle.category=categories[index % categories.length]; puzzle.title=`Сканворд №${index+1}`; return puzzle; });

fs.writeFileSync(path.join(root, 'data', 'puzzles.json'), `${JSON.stringify(puzzles, null, 2)}\n`);
fs.writeFileSync(path.join(root, 'data', 'puzzles.js'), `window.SCANWORD_PUZZLES = ${JSON.stringify(puzzles)};\n`);
fs.writeFileSync(path.join(root, 'data', 'words.js'), `window.SCANWORD_WORDS = ${JSON.stringify(words)};\n`);
console.log(`Создано ${puzzles.length} сканвордов из ${words.length} слов.`);

