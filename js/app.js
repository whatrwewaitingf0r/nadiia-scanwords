(function(){
'use strict';
const STORE='nadiia-scanwords-v15';
const puzzles=window.SCANWORD_PUZZLES||[];
const EXTRA=[...'АЕИОУЫЭЮЯБВГДЖЗЙКЛМНПРСТФХЦЧШЩ'];
const $=selector=>document.querySelector(selector);
const els={game:$('#game-screen'),grid:$('#scanword-grid'),board:$('.board-area'),tiles:$('#letter-tiles'),clue:$('#current-clue'),label:$('#puzzle-label'),progress:$('#progress-bar'),feedback:$('#feedback'),dialog:$('#complete-dialog'),drawer:$('#drawer'),hints:$('#hints-sheet'),input:$('#native-input'),list:$('#puzzle-list')};
let saved=readSaved(),state=null,toastTimer=0;
function readSaved(){try{return JSON.parse(localStorage.getItem(STORE)||'{}')}catch{return {}}}
function persist(){try{localStorage.setItem(STORE,JSON.stringify(saved))}catch{}}
function key(row,col){return `${row}:${col}`}
function delta(word){return word.direction==='down'?[1,0]:[0,1]}
function wordCells(word){const [dr,dc]=delta(word);return [...word.answer].map((letter,index)=>({key:key(word.row+dr*index,word.col+dc*index),letter,index}))}
function solution(puzzle){const map={};puzzle.words.forEach(word=>wordCells(word).forEach(cell=>{map[cell.key]||={letter:cell.letter,wordIds:[]};map[cell.key].wordIds.push(word.id)}));return map}
function arrowFor(word){return word.direction==='down'?'↓':'→'}
function activeWord(){return state.puzzle.words.find(word=>word.id===state.activeWordId)}
function wordDone(word){return wordCells(word).every(cell=>state.cells[cell.key]===cell.letter)}
function puzzleDone(){return state&&Object.entries(state.solution).every(([cellKey,value])=>state.cells[cellKey]===value.letter)}
function saveGame(){if(!state)return;saved[state.puzzle.id]={cells:state.cells,completed:puzzleDone(),updatedAt:Date.now()};persist()}
function resizeBoard(){
 if(!state)return;
 const {cols,rows}=state.puzzle;
 const availableWidth=els.board.clientWidth;
 const availableHeight=els.board.clientHeight;
 const cellWidth=availableWidth/cols*state.zoom;
 const cellHeight=availableHeight/rows*state.zoom;
 document.documentElement.style.setProperty('--cell',`${cellWidth}px`);
 document.documentElement.style.setProperty('--cell-w',`${cellWidth}px`);
 document.documentElement.style.setProperty('--cell-h',`${cellHeight}px`);
 document.documentElement.style.setProperty('--board-cols',cols);
 document.documentElement.style.setProperty('--board-rows',rows);
 els.grid.style.width=`${cellWidth*cols}px`;
 els.grid.style.height=`${cellHeight*rows}px`;
}
function setZoom(value,announce=true){
 if(!state)return;
 state.zoom=Math.max(1,Math.min(2.2,Math.round(value*100)/100));
 els.board.classList.toggle('is-zoomed',state.zoom>1.01);
 resizeBoard();
 if(state.zoom<=1.01){els.board.scrollLeft=0;els.board.scrollTop=0}
 if(announce)toast(state.zoom>1.01?`Поле: ${Math.round(state.zoom*100)}%. Можно двигать пальцем.`:'Поле целиком на экране.');
}
function openPuzzle(puzzle){const prior=saved[puzzle.id]||{};state={puzzle,solution:solution(puzzle),cells:{...(prior.cells||{})},activeWordId:puzzle.words[0].id,focus:0,solved:new Set(puzzle.words.filter(word=>wordCells(word).every(cell=>prior.cells?.[cell.key]===cell.letter)).map(word=>word.id)),tileOrder:{},extrasMuted:false,zoom:1};els.dialog.hidden=true;els.board.classList.remove('is-zoomed');selectWord(puzzle.words[0].id,true);renderPuzzleList();requestAnimationFrame(resizeBoard)}
function renderBoard(){const clues=new Map();state.puzzle.words.forEach(word=>{const cellKey=key(word.clueCell.row,word.clueCell.col);if(!clues.has(cellKey))clues.set(cellKey,[]);clues.get(cellKey).push(word)});const active=activeWord(),activeCells=wordCells(active),activeKeys=new Set(activeCells.map(cell=>cell.key)),focusKey=activeCells[state.focus]?.key,blocks=new Set((state.puzzle.blocks||[]).map(block=>key(block.row,block.col))),fragment=document.createDocumentFragment();for(let row=0;row<state.puzzle.rows;row+=1)for(let col=0;col<state.puzzle.cols;col+=1){const cellKey=key(row,col),cellClues=clues.get(cellKey),sol=state.solution[cellKey];if(!cellClues&&!sol&&!blocks.has(cellKey))throw new Error(`Неописанная клетка ${cellKey}`);const element=document.createElement(cellClues||blocks.has(cellKey)?'div':'button');element.className='grid-cell';if(blocks.has(cellKey)){element.classList.add('block');element.setAttribute('aria-hidden','true')}else if(cellClues){element.classList.add('clue');element.dataset.wordCount=cellClues.length;cellClues.forEach(word=>{const part=document.createElement('button');part.className=`clue-part${word.id===state.activeWordId?' is-active':''}`;part.dataset.wordId=word.id;part.dataset.direction=word.direction;part.innerHTML=`<span class="clue-text">${word.clue}</span><b class="clue-arrow">${arrowFor(word)}</b>`;part.setAttribute('aria-label',`${word.clue}, ${arrowFor(word)}, ${word.answer.length} букв`);part.onclick=()=>selectWord(word.id);element.append(part)})}else{element.classList.add('answer');element.textContent=state.cells[cellKey]||'';if(activeKeys.has(cellKey))element.classList.add('is-active');if(focusKey===cellKey)element.classList.add('is-focus');if(sol.wordIds.every(id=>state.solved.has(id)))element.classList.add('is-solved');element.onclick=()=>selectCell(cellKey)}fragment.append(element)}els.grid.replaceChildren(fragment)}
function selectWord(id,initial=false){state.activeWordId=id;const cells=wordCells(activeWord()),firstEmpty=cells.findIndex(cell=>!state.cells[cell.key]);state.focus=firstEmpty<0?0:firstEmpty;state.extrasMuted=false;render();if(!initial)els.grid.querySelector('.is-focus')?.focus({preventScroll:true})}
function selectCell(cellKey){const ids=state.solution[cellKey].wordIds;state.activeWordId=ids.length>1&&ids.includes(state.activeWordId)?ids[(ids.indexOf(state.activeWordId)+1)%ids.length]:ids[0];state.focus=wordCells(activeWord()).findIndex(cell=>cell.key===cellKey);state.extrasMuted=false;render()}
function random(seed){let hash=2166136261;for(const char of seed)hash=Math.imul(hash^char.charCodeAt(0),16777619);return()=>((hash=Math.imul(hash^(hash>>>15),2246822507))>>>0)/4294967296}
function tileSet(word){if(state.tileOrder[word.id])return state.tileOrder[word.id];const rand=random(state.puzzle.id+word.id),all=[...word.answer].map((letter,index)=>({letter,extra:false,id:'a'+index}));while(all.length<20)all.push({letter:EXTRA[Math.floor(rand()*EXTRA.length)],extra:true,id:'e'+all.length});for(let index=all.length-1;index>0;index-=1){const swap=Math.floor(rand()*(index+1));[all[index],all[swap]]=[all[swap],all[index]]}return state.tileOrder[word.id]=all}
function renderTiles(){const tiles=tileSet(activeWord());els.tiles.replaceChildren(...tiles.map(tile=>{const button=document.createElement('button');button.className=`letter-tile${tile.extra?' is-extra':''}${state.extrasMuted&&tile.extra?' is-muted':''}`;button.textContent=tile.letter;button.disabled=state.extrasMuted&&tile.extra;button.onclick=()=>enter(tile.letter);return button}))}
function nextEmpty(cells,start){for(let count=0;count<cells.length;count+=1){const index=(start+count)%cells.length;if(!state.cells[cells[index].key])return index}return Math.min(start,cells.length-1)}
function enter(letter){if(!/^[А-ЯЁ]$/u.test(letter))return;const cells=wordCells(activeWord()),index=state.focus;state.cells[cells[index].key]=letter;state.focus=nextEmpty(cells,index+1);afterEdit()}
function erase(){const cells=wordCells(activeWord());let index=state.focus;if(!state.cells[cells[index].key]&&index>0)index-=1;delete state.cells[cells[index].key];state.focus=index;state.solved=new Set(state.puzzle.words.filter(wordDone).map(word=>word.id));saveGame();render()}
function reveal(){const cells=wordCells(activeWord()),index=cells.findIndex(cell=>state.cells[cell.key]!==cell.letter);if(index<0)return;state.cells[cells[index].key]=cells[index].letter;state.focus=nextEmpty(cells,index+1);afterEdit();toast('Открыта одна буква — без штрафа.')}
function revealWord(){wordCells(activeWord()).forEach(cell=>{state.cells[cell.key]=cell.letter});afterEdit();toast('Слово открыто — можно идти дальше.')}
function afterEdit(){const solved=new Set(state.puzzle.words.filter(wordDone).map(word=>word.id));const newly=state.puzzle.words.filter(word=>solved.has(word.id)&&!state.solved.has(word.id));state.solved=solved;saveGame();render();if(newly.length){toast('Верно! Отличное слово ✦');newly.forEach(launchWordConfetti)}if(puzzleDone())setTimeout(finish,220)}
const confettiParticles=[];let confettiFrame=0;
function burstConfetti(x,y,count,power){const canvas=$('#confetti');canvas.style.display='block';for(let i=0;i<count;i++){const angle=Math.random()*Math.PI*2,speed=(2+Math.random()*5)*power;confettiParticles.push({x,y,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed-2,life:0,max:48+Math.random()*32,size:3+Math.random()*5,hue:Math.random()*360})}if(!confettiFrame){const ctx=canvas.getContext('2d');const draw=()=>{canvas.width=innerWidth;canvas.height=innerHeight;ctx.clearRect(0,0,canvas.width,canvas.height);for(let i=confettiParticles.length-1;i>=0;i--){const p=confettiParticles[i];p.x+=p.vx;p.y+=p.vy;p.vy+=.14;p.vx*=.99;p.life++;ctx.globalAlpha=Math.max(0,1-p.life/p.max);ctx.fillStyle=`hsl(${p.hue} 85% 52%)`;ctx.fillRect(p.x,p.y,p.size,p.size*1.55);if(p.life>=p.max)confettiParticles.splice(i,1)}ctx.globalAlpha=1;if(confettiParticles.length)confettiFrame=requestAnimationFrame(draw);else{confettiFrame=0;canvas.style.display='none'}};confettiFrame=requestAnimationFrame(draw)}}
function launchWordConfetti(word){const cells=wordCells(word),middle=cells[Math.floor(cells.length/2)],node=els.grid.querySelectorAll('.grid-cell')[Number(middle.key.split(':')[0])*state.puzzle.cols+Number(middle.key.split(':')[1])],box=node.getBoundingClientRect();burstConfetti(box.left+box.width/2,box.top+box.height/2,45,1)}
function launchPuzzleConfetti(){burstConfetti(innerWidth/2,innerHeight*.38,220,1.7)}
function toast(message){els.feedback.textContent=message;els.feedback.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>els.feedback.classList.remove('show'),1700)}
function finish(){if(!els.dialog.hidden)return;saveGame();launchPuzzleConfetti();els.dialog.hidden=false}
function render(){renderBoard();renderTiles();const word=activeWord(),total=Object.keys(state.solution).length,done=Object.entries(state.solution).filter(([cellKey,value])=>state.cells[cellKey]===value.letter).length;els.clue.textContent=word.clue;els.label.textContent=`№${state.puzzle.number} · ${Math.round(done/total*100)}% · v15`;els.progress.style.width=`${done/total*100}%`;resizeBoard()}
function renderPuzzleList(){els.list.replaceChildren(...puzzles.map(puzzle=>{const button=document.createElement('button');button.classList.toggle('is-active',state?.puzzle.id===puzzle.id);button.textContent=`№${puzzle.number} · ${puzzle.category}${saved[puzzle.id]?.completed?' · готово':''}`;button.onclick=()=>{openPuzzle(puzzle);closeDrawer(els.drawer)};return button}))}
function openDrawer(drawer){drawer.classList.add('open');drawer.setAttribute('aria-hidden','false')}
function closeDrawer(drawer){drawer.classList.remove('open');drawer.setAttribute('aria-hidden','true')}
function moveWord(delta){const index=state.puzzle.words.findIndex(word=>word.id===state.activeWordId);selectWord(state.puzzle.words[(index+delta+state.puzzle.words.length)%state.puzzle.words.length].id)}
$('#previous-word').onclick=()=>moveWord(-1);$('#next-word').onclick=()=>moveWord(1);$('#delete-button').onclick=erase;$('#keyboard-toggle').onclick=()=>{els.input.value='';els.input.focus()};$('#hint-letter').onclick=()=>{reveal();closeDrawer(els.hints)};$('#hint-word').onclick=()=>{revealWord();closeDrawer(els.hints)};$('#hint-extras').onclick=()=>{state.extrasMuted=true;renderTiles();toast('Лишние буквы приглушены.');closeDrawer(els.hints)};$('#menu-button').onclick=()=>openDrawer(els.drawer);$('#hints-button').onclick=()=>openDrawer(els.hints);$('#close-menu').onclick=()=>closeDrawer(els.drawer);$('#close-hints').onclick=()=>closeDrawer(els.hints);[els.drawer,els.hints].forEach(drawer=>drawer.onclick=event=>{if(event.target===drawer)closeDrawer(drawer)});$('#zoom-out').onclick=()=>setZoom(state.zoom-.15);$('#zoom-in').onclick=()=>setZoom(state.zoom+.15);$('#theme-button').onclick=()=>document.body.classList.toggle('theme-dark');$('#back-button').onclick=()=>{const index=puzzles.findIndex(puzzle=>puzzle.id===state.puzzle.id);openPuzzle(puzzles[(index-1+puzzles.length)%puzzles.length])};$('#next-button').onclick=()=>{const index=puzzles.findIndex(puzzle=>puzzle.id===state.puzzle.id);openPuzzle(puzzles[(index+1)%puzzles.length])};$('#catalog-button').onclick=()=>{els.dialog.hidden=true;openDrawer(els.drawer)};els.input.oninput=event=>{const letter=event.target.value.toUpperCase().match(/[А-ЯЁ]/gu)?.at(-1);if(letter)enter(letter);event.target.value=''};document.addEventListener('keydown',event=>{if(!state)return;const pressed=event.key.toUpperCase();if(/^[А-ЯЁ]$/u.test(pressed)){event.preventDefault();enter(pressed)}if(event.key==='Backspace'){event.preventDefault();erase()}if(event.key==='ArrowLeft'){event.preventDefault();state.focus=Math.max(0,state.focus-1);render()}if(event.key==='ArrowRight'){event.preventDefault();state.focus=Math.min(activeWord().answer.length-1,state.focus+1);render()}});addEventListener('resize',resizeBoard);
const pointers=new Map();let pinchStart=null,panMoved=false;
function pointerDistance(){const points=[...pointers.values()];return points.length<2?0:Math.hypot(points[0].x-points[1].x,points[0].y-points[1].y)}
els.grid.addEventListener('pointerdown',event=>{if(event.pointerType!=='touch')return;pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});if(pointers.size===1)panMoved=false;if(pointers.size===2){pinchStart={distance:pointerDistance(),zoom:state.zoom};panMoved=true}});
els.grid.addEventListener('pointermove',event=>{const previous=pointers.get(event.pointerId);if(!previous)return;pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});if(pinchStart&&pointers.size>=2){event.preventDefault();const distance=pointerDistance();if(pinchStart.distance>0)setZoom(pinchStart.zoom*distance/pinchStart.distance,false)}else if(state.zoom>1.01){const dx=event.clientX-previous.x,dy=event.clientY-previous.y;if(Math.abs(dx)+Math.abs(dy)>1){event.preventDefault();els.board.scrollLeft-=dx;els.board.scrollTop-=dy;panMoved=true}}});
els.grid.addEventListener('click',event=>{if(panMoved){event.preventDefault();event.stopPropagation();panMoved=false}},true);
function endPointer(event){pointers.delete(event.pointerId);if(pointers.size<2)pinchStart=null}
els.grid.addEventListener('pointerup',endPointer);els.grid.addEventListener('pointercancel',endPointer);

window.render_game_to_text=()=>JSON.stringify({mode:els.dialog.hidden?'playing':'complete',version:'v15',puzzle:state.puzzle.number,category:state.puzzle.category,grid:{cols:state.puzzle.cols,rows:state.puzzle.rows,letters:Object.keys(state.solution).length,clues:state.puzzle.words.length,blocks:state.puzzle.blocks.length,words:state.puzzle.words.length,zoom:state.zoom,scrollLeft:els.board.scrollLeft,scrollTop:els.board.scrollTop},active:{clue:activeWord().clue,direction:arrowFor(activeWord()),length:activeWord().answer.length},filledCells:Object.keys(state.cells).length,totalCells:Object.keys(state.solution).length,complete:puzzleDone()});window.advanceTime=()=>{if(state)render()};
if(!puzzles.length)throw new Error('Нет сканвордов');openPuzzle(puzzles[0]);if('serviceWorker'in navigator&&location.protocol!=='file:')navigator.serviceWorker.register('./sw.js?v=15').catch(()=>{});
})();
