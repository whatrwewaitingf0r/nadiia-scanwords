const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require('/opt/homebrew/lib/node_modules/@browserbasehq/browse-cli/node_modules/playwright');
const baseUrl = process.argv[2] || `file://${path.join(__dirname, '..', 'index.html')}`;
const output = path.join(__dirname, '..', 'output', 'v18');
fs.mkdirSync(output, { recursive: true });
(async () => {
  const browser = await chromium.launch({ headless: true });
  const scenarios = [{ name: 'iphone-se', width: 375, height: 667 },{ name: 'iphone', width: 390, height: 844 },{ name: 'tablet', width: 820, height: 1180 }];
  for (const scenario of scenarios) {
    const context = await browser.newContext({ viewport: scenario, deviceScaleFactor: 1 });
    const page = await context.newPage(); const errors=[];
    page.on('pageerror',e=>errors.push(String(e))); page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
    await page.goto(baseUrl,{waitUntil:'domcontentloaded'}); await page.waitForSelector('.grid-cell.clue');
    const initial=JSON.parse(await page.evaluate(()=>window.render_game_to_text()));
    assert.equal(initial.version,'v18'); assert.equal(initial.grid.cols,10); assert.equal(initial.grid.rows,7); assert.equal(initial.grid.clues,8); assert.equal(initial.grid.words,8); assert.ok(initial.grid.blocks>=1); assert.equal(initial.grid.letters+initial.grid.clues+initial.grid.blocks,70);
    assert.equal(await page.locator('.grid-cell').count(),70); assert.equal(await page.locator('.clue-part').count(),8); assert.equal(await page.locator('.letter-tile').count(),20);
    const sizing=await page.evaluate(()=>{const answer=document.querySelector('.grid-cell.answer'),clueText=document.querySelector('.clue-text'),board=document.querySelector('.scanword-grid').getBoundingClientRect(),area=document.querySelector('.board-area').getBoundingClientRect(),clue=document.querySelector('.clue-bar').getBoundingClientRect(),tiles=document.querySelector('.letter-tiles').getBoundingClientRect(),last=document.querySelector('.letter-tile:last-child').getBoundingClientRect(),foot=document.querySelector('.game-foot').getBoundingClientRect();return{cell:answer.getBoundingClientRect().width,cellHeight:answer.getBoundingClientRect().height,tilesTop:tiles.top,clueBottom:clue.bottom,footBottom:foot.bottom,answerFont:parseFloat(getComputedStyle(answer).fontSize),clueFont:parseFloat(getComputedStyle(clueText).fontSize),boardWidth:board.width,boardBottom:board.bottom,areaBottom:area.bottom,clueTop:clue.top,tilesBottom:tiles.bottom,lastBottom:last.bottom,innerWidth,innerHeight}});
    assert.ok(sizing.cell>=37,JSON.stringify(sizing)); assert.ok(sizing.answerFont>=20,JSON.stringify(sizing)); assert.ok(sizing.clueFont>=8,JSON.stringify(sizing)); assert.ok(sizing.boardWidth<=sizing.innerWidth+1,JSON.stringify(sizing));
    assert.ok(Math.abs(sizing.areaBottom-sizing.clueTop)<1,`gap before clue bar: ${JSON.stringify(sizing)}`); assert.ok(Math.abs(sizing.tilesTop-sizing.clueBottom)<1,`gap between clue bar and tiles: ${JSON.stringify(sizing)}`); assert.ok(Math.abs(sizing.footBottom-sizing.innerHeight)<2,`bottom gap: ${JSON.stringify(sizing)}`); assert.ok(Math.abs(sizing.boardBottom-sizing.clueTop)<1,JSON.stringify(sizing)); assert.ok(sizing.cellHeight>sizing.cell,JSON.stringify(sizing)); assert.ok(sizing.lastBottom<=sizing.innerHeight+1,JSON.stringify(sizing));
    await page.screenshot({path:path.join(output,`${scenario.name}-default.png`),fullPage:false});
    for(let puzzleIndex=0;puzzleIndex<6;puzzleIndex++){
      const clipped=await page.evaluate(()=>[...document.querySelectorAll('.clue-part')].map(part=>{const text=part.querySelector('.clue-text'),arrow=part.querySelector('.clue-arrow'),textBox=text.getBoundingClientRect(),arrowBox=arrow.getBoundingClientRect();return {clue:text.textContent,clipped:text.scrollHeight>text.clientHeight+1||text.scrollWidth>text.clientWidth+1||(part.dataset.direction==='up'?textBox.top<arrowBox.bottom+1:textBox.bottom>arrowBox.top-1)}}).filter(entry=>entry.clipped));
      assert.deepEqual(clipped,[],`${scenario.name} puzzle ${puzzleIndex+1}: ${JSON.stringify(clipped)}`);
      for(let wordIndex=0;wordIndex<8;wordIndex++){
        await page.locator('.clue-part').nth(wordIndex).click();
        const selection=await page.evaluate(()=>{
          const id=document.querySelector('.clue-part.is-active').dataset.wordId;
          const word=window.SCANWORD_PUZZLES.find(p=>p.number===JSON.parse(window.render_game_to_text()).puzzle).words.find(w=>w.id===id);
          const selected=[...document.querySelectorAll('.grid-cell')].flatMap((cell,index)=>cell.classList.contains('is-active')?[index]:[]);
          return {word,selected};
        });
        const expected=[...selection.word.answer].map((_,i)=>(selection.word.row+(selection.word.direction==='down'?i:0))*10+selection.word.col+(selection.word.direction==='across'?i:0));
        assert.deepEqual(selection.selected,expected.sort((a,b)=>a-b),`${scenario.name}: ${selection.word.clue} highlighted wrong cells`);
        if(scenario.name==='iphone'&&selection.word.clue==='Пенится в воде'){
          const colors=await page.evaluate(()=>{
            const active=document.querySelector('.grid-cell.answer.is-active');
            const inactive=document.querySelector('.grid-cell.answer:not(.is-active)');
            return [getComputedStyle(active).backgroundColor,getComputedStyle(inactive).backgroundColor];
          });
          assert.notEqual(colors[0],colors[1],'selected word must be visibly highlighted');
          await page.screenshot({path:path.join(output,'iphone-soap-selected.png'),fullPage:false});
        }
      }
      if(puzzleIndex<5){await page.locator('#menu-button').click();await page.locator('#puzzle-list button').nth(puzzleIndex+1).click()}
    }
    if(scenario.name==='iphone'||scenario.name==='iphone-se'){
      for(let puzzleIndex=6;puzzleIndex<56;puzzleIndex++){
        await page.locator('#menu-button').click();
        const card=page.locator('#puzzle-list button').nth(puzzleIndex);
        assert.match(await card.textContent(),new RegExp(`№${puzzleIndex+1} · `));
        await card.click();
        const state=JSON.parse(await page.evaluate(()=>window.render_game_to_text()));
        assert.equal(state.puzzle,puzzleIndex+1);
        assert.ok(state.grid.words>=6);
        assert.equal(state.grid.letters+state.grid.clues+state.grid.blocks,70);
        assert.equal(await page.locator('.grid-cell').count(),70);
        const clipped=await page.evaluate(()=>[...document.querySelectorAll('.clue-part')].map(part=>{const text=part.querySelector('.clue-text'),arrow=part.querySelector('.clue-arrow');return {clue:text.textContent,overflow:text.getBoundingClientRect().bottom-arrow.getBoundingClientRect().top}}).filter(entry=>entry.overflow>2));
        assert.deepEqual(clipped,[],`${scenario.name} puzzle ${puzzleIndex+1}: ${JSON.stringify(clipped)}`);
        if([6,29,55].includes(puzzleIndex)) await page.screenshot({path:path.join(output,`${scenario.name}-puzzle-${puzzleIndex+1}.png`),fullPage:false});
      }
      assert.deepEqual(errors,[]);
    }
    await page.locator('#menu-button').click();await page.locator('#puzzle-list button').first().click();

    const beforeZoom=sizing.cell; await page.locator('#zoom-in').click();
    const afterZoom=await page.locator('.grid-cell.answer').first().evaluate(el=>el.getBoundingClientRect().width); assert.ok(afterZoom>beforeZoom*1.1,{beforeZoom,afterZoom});
    await page.evaluate(()=>{const grid=document.querySelector('#scanword-grid');const fire=(type,id,x)=>grid.dispatchEvent(new PointerEvent(type,{pointerId:id,pointerType:'touch',clientX:x,clientY:100,bubbles:true,cancelable:true}));fire('pointerdown',1,100);fire('pointerdown',2,200);fire('pointermove',2,250);fire('pointerup',1,100);fire('pointerup',2,250)});
    const afterPinch=await page.locator('.grid-cell.answer').first().evaluate(el=>el.getBoundingClientRect().width); assert.ok(afterPinch>afterZoom,{afterZoom,afterPinch});
    const gridScale=await page.evaluate(()=>{const cells=[...document.querySelectorAll('.grid-cell')];const first=cells[0].getBoundingClientRect();return cells.every(cell=>Math.abs(cell.getBoundingClientRect().width-first.width)<.1&&Math.abs(cell.getBoundingClientRect().height-first.height)<.1)});assert.ok(gridScale,'zoom must scale every cell, not only the focused cell');
    const pan=await page.evaluate(()=>{const grid=document.querySelector('#scanword-grid'),board=document.querySelector('.board-area');board.scrollLeft=0;const fire=(type,x)=>grid.dispatchEvent(new PointerEvent(type,{pointerId:4,pointerType:'touch',clientX:x,clientY:100,bubbles:true,cancelable:true}));fire('pointerdown',230);fire('pointermove',120);fire('pointerup',120);return board.scrollLeft});assert.ok(pan>20,`one-finger pan failed: ${pan}`);
    await page.locator('#zoom-out').click(); assert.ok(await page.locator('.board-area').evaluate(el=>el.classList.contains('is-zoomed')));
    await page.locator('.letter-tile').first().click(); assert.equal(JSON.parse(await page.evaluate(()=>window.render_game_to_text())).filledCells,initial.filledCells+1);
    await page.locator('#theme-button').click(); assert.ok(await page.locator('body').evaluate(b=>b.classList.contains('theme-dark')));
    await page.locator('#menu-button').click(); assert.equal(await page.locator('#puzzle-list button').count(),56); await page.locator('#close-menu').click();
    await page.screenshot({path:path.join(output,`${scenario.name}-game.png`),fullPage:false});
    const stored=await page.evaluate(()=>localStorage.getItem('nadiia-scanwords-v18')); assert.ok(stored&&stored.includes('scanword-001'));
    await page.reload({waitUntil:'domcontentloaded'}); assert.ok(JSON.parse(await page.evaluate(()=>window.render_game_to_text())).filledCells>=1);
    const clueCount=await page.locator('.clue-part').count(); for(let i=0;i<clueCount;i++){await page.locator('.clue-part').nth(i).click();await page.locator('#hints-button').click();await page.locator('#hint-word').click();if(i===0)assert.equal(await page.locator('#confetti').evaluate(el=>el.style.display),'block','each completed word must burst confetti')}
    await page.waitForSelector('#complete-dialog:not([hidden])'); assert.equal(JSON.parse(await page.evaluate(()=>window.render_game_to_text())).complete,true); assert.deepEqual(errors,[]);
    await context.close();
  }
  await browser.close(); console.log('Browser smoke: v18 10×7 grid, zoom, bottom dock, persistence, and completion passed.');
})().catch(error=>{console.error(error);process.exitCode=1});
