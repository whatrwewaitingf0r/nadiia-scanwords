const fs = require('node:fs');
const path = require('node:path');
const { createPuzzle } = require('../js/generator.js');

const root = path.join(__dirname, '..');
const dictionary = JSON.parse(fs.readFileSync(path.join(root, 'data/words.json'), 'utf8'));
const layouts = JSON.parse(fs.readFileSync(path.join(root, 'data/layouts-v14.json'), 'utf8'));

// Original short newspaper clues. graycell.ru supplied style inspiration only;
// neither its puzzles nor commercial clue packs supplied text or answers.
const shortClues = {
  'КОПЬЁ':'Острое древко', 'ГЛИНА':'Лепят горшки', 'ФОНАРЬ':'Светит на улице',
  'РАДУГА':'Дуга после дождя', 'СИНИЦА':'Жёлтогрудая птица', 'СЕКРЕТ':'Не для чужих ушей',
  'КАИР':'Город на Ниле', 'ЛЕТО':'Время жары', 'ТОРТ':'Кремовые коржи',
  'КРАН':'Поднимает груз', 'ГРИБ':'Шляпка на ножке', 'СКАТ':'Плоская рыба',
  'ПРЯНИК':'Медовая выпечка', 'АРФА':'Струны и рама', 'БРОД':'Переход через реку',
  'НОТА':'Знак мелодии', 'КОРЕНЬ':'Подземная часть', 'ТИШИНА':'Ни звука',
  'БАЙКАЛ':'Озеро с нерпой', 'РЮКЗАК':'Сумка за спиной', 'БОРЩ':'Свекольный суп',
  'ЯДРО':'Середина плода', 'ХРАМ':'Дом молитвы', 'СОВА':'Ночная птица',
  'ПРАГА':'Влтава: столица', 'СОЛНЦЕ':'Дневное светило', 'СНЕГ':'Белые хлопья',
  'МАЯК':'Огонь для судов', 'ПЕРО':'На птичьем крыле', 'БРАК':'Семейный союз',
  'АТЛАС':'Сборник карт', 'ЩУКА':'Зубастая рыба', 'БОКС':'Бой на ринге',
  'СОЮЗ':'Вместе ради цели', 'БИНОКЛЬ':'Два окуляра', 'СОЛОВЕЙ':'Лесной певец',
  'ВРАЧ':'Лечит людей', 'ЕЖОНОК':'Детёныш ежа', 'СТИХ':'Строка поэта',
  'ОПЕРА':'Спектакль, где поют', 'ЛАПА':'Нога зверя', 'СТУЛ':'Сиденье со спинкой',
  'ОВОД':'Кусающая муха', 'ЛИФТ':'Кабина в шахте', 'КАНТ':'Узкая кайма',
  'ЛЕСНОЙ':'Из чащи', 'МЕТЕЛЬ':'Ветер со снегом', 'КЕНГУРУ':'Сумка и прыжки',
  'ВАРЕЖКА':'Греет ладонь', 'ШАЛАШ':'Укрытие из веток', 'ГОГОЛЬ':'Автор «Шинели»',
  'ГОЛУБЬ':'Городская птица', 'ТЕНТ':'Плотный навес', 'СЛЕД':'Отпечаток ноги',
  'МЫЛО':'Пенится в воде', 'ЮМОР':'Чувство смешного', 'ЧАША':'Круглый сосуд',
  'ПРУД':'Малый водоём', 'БИНТ':'Лента для ран', 'ГОРНЫЙ':'Из высоких мест',
  'ВИРУС':'Зараза без клетки', 'ХЛЕБ':'Пекут из муки', 'МЕТР':'Мера длины',
  'ЖЕМЧУГ':'Дар раковины', 'ВИШНЯ':'Красная ягода', 'ЗАВОД':'Фабричное место',
  'ЛУНА':'Спутник Земли', 'ДВОР':'Участок возле дома', 'НЕВА':'Река Петербурга',
  'НЕРВ':'Пучок волокон', 'ЗОНТИК':'Защита от дождя', 'ТРАМВАЙ':'Вагон на рельсах',
};
const replacements = {
  'СПОР':'КАИР', 'СМЕЛЫЙ':'БАЙКАЛ', 'МИСКА':'ПРАГА',
  'ПЧЕЛА':'ОПЕРА', 'ПИСЬМО':'ГОГОЛЬ', 'ВИНА':'НЕВА',
};
const categories = ['Первый номер', 'Природа', 'Дом и город', 'Путешествия', 'Вещи и вкусы', 'Разное'];
const directions = { down: 'across', up: 'left', across: 'down', left: 'up' };
const arrows = { across: '→', left: '←', down: '↓', up: '↑' };

let available = dictionary.filter(entry => entry.clue.length <= 30);
const puzzles = categories.map((category, index) => {
  const portrait = createPuzzle(available, 'nadiia-v14', index + 1);
  const words = portrait.words.map((word, wordIndex) => {
    const answer = replacements[word.answer] || word.answer;
    const clue = shortClues[answer];
    if (!clue) throw new Error(`Missing original short clue for ${answer}`);
    if ([...answer].length !== [...word.answer].length) throw new Error(`Length changed for ${answer}`);
    const [direction, row, col] = layouts[index][wordIndex];
    if (['across', 'left'].includes(direction) !== ['across', 'left'].includes(directions[word.direction])) {
      throw new Error(`Layout changed the axis for ${answer}`);
    }
    const [dr, dc] = direction === 'down' ? [1, 0] : direction === 'up' ? [-1, 0] : direction === 'left' ? [0, -1] : [0, 1];
    return { id: word.id, answer, clue, row, col,
      direction, clueCell: { row: row - dr, col: col - dc },
      arrow: arrows[direction] };
  });
  const used = new Set(portrait.words.map(word => word.answer));
  available = available.filter(entry => !used.has(entry.answer));
  const occupied = new Set();
  for (const word of words) {
    occupied.add(`${word.clueCell.row}:${word.clueCell.col}`);
    const [dr, dc] = word.direction === 'down' ? [1, 0] : word.direction === 'up' ? [-1, 0] : word.direction === 'left' ? [0, -1] : [0, 1];
    [...word.answer].forEach((_, letterIndex) => occupied.add(`${word.row + dr * letterIndex}:${word.col + dc * letterIndex}`));
  }
  const blocks = [];
  for (let row = 0; row < 7; row += 1) for (let col = 0; col < 10; col += 1) {
    if (!occupied.has(`${row}:${col}`)) blocks.push({ row, col });
  }
  return { id: portrait.id, number: index + 1, title: portrait.title, category,
    source: 'original in-house definitions', rows: 7, cols: 10, words, blocks };
});

fs.writeFileSync(path.join(root, 'data/puzzles.json'), JSON.stringify(puzzles, null, 2) + '\n');
fs.writeFileSync(path.join(root, 'data/puzzles.js'), `window.SCANWORD_PUZZLES = ${JSON.stringify(puzzles)};\n`);
console.log(`Создано ${puzzles.length} авторских сеток 10×7 с пересечениями.`);
