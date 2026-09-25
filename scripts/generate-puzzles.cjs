const fs = require('node:fs');
const path = require('node:path');
const { createPuzzle } = require('../js/generator.js');

const root = path.join(__dirname, '..');
const wordsPath = path.join(root, 'data', 'words.json');
const words = JSON.parse(fs.readFileSync(wordsPath, 'utf8'));
const categories = ['Наблюдения','Культура','Природа','История','Язык','Путешествия','Искусство'];
const usedAnswers = new Set();
const puzzles = Array.from({ length: 7 }, (_, index) => {
  const available = words.filter((word) => !usedAnswers.has(word.answer));
  const puzzle = createPuzzle(available, `nadiia-v7-${index + 1}`, index + 1);
  puzzle.words.forEach((word) => usedAnswers.add(word.answer));
  puzzle.category = categories[index % categories.length];
  return puzzle;
});

fs.writeFileSync(path.join(root, 'data', 'puzzles.json'), `${JSON.stringify(puzzles, null, 2)}\n`);
fs.writeFileSync(path.join(root, 'data', 'puzzles.js'), `window.SCANWORD_PUZZLES = ${JSON.stringify(puzzles)};\n`);
fs.writeFileSync(path.join(root, 'data', 'words.js'), `window.SCANWORD_WORDS = ${JSON.stringify(words)};\n`);
console.log(`Создано ${puzzles.length} сканвордов v7: 10×7, ${usedAnswers.size} уникальных ответов.`);
