const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');

// Each authored row is either [four letters, four letters] or one long answer.
// A grey clue starts each answer. The only unused cells are explicit grey blocks.
const boards = [
  { category: 'Первый номер', rows: [
    [['МАЯК','Огонь в море'],['ЛУНА','Спутник']],
    [['ГОРИЗОНТ','Край неба']],
    [['АИСТ','Длинноклюв'],['РЕКА','Вода в русле']],
    [['СКРИПКА','Смычковая']],
    [['КИНО','Экранное арт'],['РОЗА','Шипы и бутон']],
    [['КАЛЕНДАРЬ','Даты года']],
    [['СНЕЖИНКА','Звёздочка льда']],
  ]},
  { category: 'Природа', rows: [
    [['ВОЛК','Лесной хищник'],['ГРАЧ','Вестник весны']],
    [['ЧЕРЕПАХА','Панцирный']],
    [['ЁЖИК','Колючий'],['ЗМЕЯ','Чешуйчатая']],
    [['ЛЕТО','После весны'],['МОРЕ','Солёный простор']],
    [['РОМАШКА','Белый цветок']],
    [['ОДУВАНЧИК','Жёлтый сорняк']],
    [['ЛАСТОЧКА','Хвост вилкой']],
  ]},
  { category: 'Дом и город', rows: [
    [['ОКНО','Стекло в стене'],['ПАРК','Городской сад']],
    [['КАРАНДАШ','Графитный']],
    [['РУКА','От плеча'],['СТОЛ','Обеденная мебель']],
    [['УТРО','После рассвета'],['ХЛЕБ','Каравай']],
    [['ПОДУШКА','Под голову']],
    [['БУДИЛЬНИК','Звонит утром']],
    [['КАРУСЕЛЬ','Круговой аттракцион']],
  ]},
  { category: 'Путешествия', rows: [
    [['ШАРФ','Вокруг шеи'],['ЯХТА','Парусная']],
    [['ТРОПИНКА','Лесная дорожка']],
    [['НОТА','Музыкальный знак'],['ЛИСА','Рыжая плутовка']],
    [['КОЗА','Даёт молоко'],['ЛАПА','Кошачья нога']],
    [['БИНОКЛЬ','Два окуляра']],
    [['ТЕРМОМЕТР','Меряет жар']],
    [['МАНДАРИН','Мелкий цитрус']],
  ]},
  { category: 'Вещи и вкусы', rows: [
    [['ЗИМА','После осени'],['КЕДР','Ливанское дерево']],
    [['АПЕЛЬСИН','Крупный цитрус']],
    [['ТИГР','Полосатый кот'],['ПЛЕД','На диване']],
    [['УТКА','Крякает'],['ТУЧА','К дождю']],
    [['КОРЗИНА','Плетёная тара']],
    [['СМОРОДИНА','Кустовая ягода']],
    [['ГВОЗДИКА','Цветок-пряность']],
  ]},
  { category: 'Разное', rows: [
    [['ВАЗА','Для букета'],['КОФЕ','Бодрит утром']],
    [['БАКЛАЖАН','Синенький']],
    [['МЫЛО','Пенное'],['ПЕРО','На крыле']],
    [['РЫБА','С жабрами'],['СЛОН','С хоботом']],
    [['МЕЛОДИЯ','Звучит в песне']],
    [['ФЕЙЕРВЕРК','Залпы в небе']],
    [['ПЕТРУШКА','Пряная зелень']],
  ]},
];

const reverseRows = [[1,4,6],[0,3,5],[2,4,6],[1,3,6],[0,2,5],[1,4,5]];
const puzzles = boards.map((board, index) => {
  const words = [], blocks = [];
  board.rows.forEach((entries, row) => {
    const reversed = reverseRows[index].includes(row);
    let col = reversed ? 9 : 0;
    entries.forEach(([answer, clue]) => {
      const clueCol = col;
      col += reversed ? -1 : 1;
      words.push({ id: `w${words.length + 1}`, answer, clue, row, col,
        direction: reversed ? 'left' : 'across', clueCell: { row, col: clueCol }, arrow: reversed ? '←' : '→' });
      col += (reversed ? -1 : 1) * [...answer].length;
    });
    if (reversed) {
      while (col >= 0) blocks.push({ row, col: col-- });
      if (col !== -1) throw new Error(`Row ${row} is too long`);
    } else {
      while (col < 10) blocks.push({ row, col: col++ });
      if (col !== 10) throw new Error(`Row ${row} is too long`);
    }
  });
  return { id: `scanword-${String(index + 1).padStart(3, '0')}`, number: index + 1,
    title: `Сканворд №${index + 1}`, category: board.category, rows: 7, cols: 10, words, blocks };
});
fs.writeFileSync(path.join(root, 'data', 'puzzles.json'), JSON.stringify(puzzles, null, 2) + '\n');
fs.writeFileSync(path.join(root, 'data', 'puzzles.js'), `window.SCANWORD_PUZZLES = ${JSON.stringify(puzzles)};\n`);
console.log(`Создано ${puzzles.length} рукописных сеток 10×7.`);
