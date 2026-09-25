(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.ScanwordGenerator = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const ROWS = 10;
  const COLS = 7;
  // v9 transposes seven proven exact-cover newspaper layouts. The narrow
  // seven-column shape gives every cell room for accessible type on a phone.
  const BASE_TEMPLATES = [
    [['across',5,6,4],['down',5,1,3],['down',6,0,2],['down',6,0,0],['down',6,0,1],['left',6,0,9],['across',4,1,5],['down',4,1,4],['across',4,4,5],['left',4,5,9],['left',4,3,9],['across',4,2,5]],
    [['across',6,0,3],['down',4,0,1],['down',4,0,0],['down',4,0,2],['left',6,1,9],['left',6,3,9],['across',6,4,3],['across',6,2,3],['left',4,6,4],['across',4,6,5],['left',4,5,9],['across',4,5,0]],
    [['left',5,6,9],['down',6,0,0],['down',4,2,1],['down',4,2,3],['down',4,2,2],['left',4,5,8],['down',5,0,9],['across',4,3,4],['left',4,2,8],['across',4,4,4],['across',7,0,1],['left',7,1,8]],
    [['down',4,0,9],['across',6,5,3],['down',4,2,1],['down',5,1,0],['down',4,2,2],['across',4,4,3],['down',4,0,8],['left',4,3,7],['left',4,2,7],['left',6,6,9],['across',6,1,1],['across',7,0,0]],
    [['left',7,0,7],['down',5,0,8],['down',6,0,9],['across',6,6,2],['down',4,2,0],['down',4,2,1],['left',4,5,6],['down',4,1,7],['left',4,4,6],['left',4,2,6],['across',4,3,2],['across',6,1,0]],
    [['across',5,6,4],['down',4,2,2],['down',4,2,3],['down',6,0,0],['down',5,1,1],['left',5,5,9],['left',4,2,8],['down',4,0,9],['across',4,3,4],['left',4,4,8],['left',6,1,8],['across',7,0,1]],
    [['down',4,0,0],['left',4,6,4],['left',4,6,9],['left',7,5,7],['down',5,0,9],['down',4,1,8],['across',5,3,2],['down',4,0,1],['across',5,2,2],['left',5,1,7],['across',5,4,2],['left',6,0,8]],
  ];
  const DIRECTION = { across: 'down', left: 'up', down: 'across' };

  function hashSeed(value) { let hash=2166136261; for(const char of String(value)){hash^=char.charCodeAt(0);hash=Math.imul(hash,16777619)} return hash>>>0; }
  function randomFactory(seed) { let state=hashSeed(seed)||1; return function(){state+=0x6d2b79f5;let value=state;value=Math.imul(value^(value>>>15),value|1);value^=value+Math.imul(value^(value>>>7),value|61);return((value^(value>>>14))>>>0)/4294967296}; }
  function shuffled(items,random){const result=items.slice();for(let i=result.length-1;i>0;i-=1){const swap=Math.floor(random()*(i+1));[result[i],result[swap]]=[result[swap],result[i]]}return result}
  function makeWord(entry,id,direction,clueRow,clueCol){const starts={across:[clueRow,clueCol+1],left:[clueRow,clueCol-1],down:[clueRow+1,clueCol],up:[clueRow-1,clueCol]};const[row,col]=starts[direction];return{id:`w${id}`,answer:entry.answer,clue:entry.clue,row,col,direction,clueCell:{row:clueRow,col:clueCol},arrow:direction==='down'?'↓':direction==='up'?'↑':direction==='left'?'←':'→',crossings:[]}}
  function createPuzzle(sourceWords,seed,number){
    const random=randomFactory(`${seed}:${number}`);
    const template=BASE_TEMPLATES[(number-1)%BASE_TEMPLATES.length].map(([direction,length,row,col])=>[DIRECTION[direction],length,col,row]);
    const pools=new Map();
    for(const[,length]of template){if(pools.has(length))continue;const compact=sourceWords.filter(entry=>[...entry.answer].length===length&&entry.clue&&entry.clue.length<=32);const needed=template.filter(tile=>tile[1]===length).length;if(compact.length<needed)throw new Error(`Для сетки нужны ${needed} коротких подсказок к словам из ${length} букв`);pools.set(length,shuffled(compact,random))}
    const offsets=new Map();
    const words=template.map(([direction,length,clueRow,clueCol],index)=>{const offset=offsets.get(length)||0;offsets.set(length,offset+1);return makeWord(pools.get(length)[offset],index+1,direction,clueRow,clueCol)});
    return{id:`scanword-${String(number).padStart(3,'0')}`,number,title:`Сканворд №${number}`,seed:String(seed),rows:ROWS,cols:COLS,words};
  }
  return { createPuzzle, randomFactory };
});
