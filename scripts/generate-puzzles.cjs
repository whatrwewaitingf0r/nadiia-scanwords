const fs = require('node:fs');
const path = require('node:path');
const { createPuzzle } = require('../js/generator.js');
const root = path.join(__dirname, '..');
const words = JSON.parse(fs.readFileSync(path.join(root, 'data', 'words.json'), 'utf8'));
const categories = ['Наблюдения','Культура','Природа','История','Язык','Путешествия','Искусство'];
const usedAnswers = new Set(); const usedClues = new Set();
const puzzles = Array.from({ length: 7 }, (_, index) => {
  const available = words.filter((word) => !usedAnswers.has(word.answer) && !usedClues.has(word.clue));
  const puzzle = createPuzzle(available, `nadiia-v9-${index + 1}`, index + 1);
  puzzle.words.forEach((word) => { usedAnswers.add(word.answer); usedClues.add(word.clue); });
  puzzle.category = categories[index]; return puzzle;
});
fs.writeFileSync(path.join(root, 'data', 'puzzles.json'), `${JSON.stringify(puzzles, null, 2)}\n`);
fs.writeFileSync(path.join(root, 'data', 'puzzles.js'), `window.SCANWORD_PUZZLES = ${JSON.stringify(puzzles)};\n`);
fs.writeFileSync(path.join(root, 'data', 'words.js'), `window.SCANWORD_WORDS = ${JSON.stringify(words)};\n`);
console.log(`Создано ${puzzles.length} сканвордов v9: 7×10, ${usedAnswers.size} уникальных ответов.`);
