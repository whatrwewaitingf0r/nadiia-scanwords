const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require('/opt/homebrew/lib/node_modules/@browserbasehq/browse-cli/node_modules/playwright');
const baseUrl = process.argv[2] || `file://${path.join(__dirname, '..', 'index.html')}`;
const output = path.join(__dirname, '..', 'output', 'v9-large-type');
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
    assert.equal(initial.version,'v9'); assert.deepEqual(initial.grid,{cols:7,rows:10,occupied:70,words:12});
    assert.equal(await page.locator('.grid-cell').count(),70); assert.equal(await page.locator('.clue-part').count(),12); assert.equal(await page.locator('.letter-tile').count(),20);
    const sizing=await page.evaluate(()=>{const answer=document.querySelector('.grid-cell.answer'),clueText=document.querySelector('.clue-text'),board=document.querySelector('.scanword-grid').getBoundingClientRect(),area=document.querySelector('.board-area').getBoundingClientRect(),clue=document.querySelector('.clue-bar').getBoundingClientRect(),tiles=document.querySelector('.letter-tiles').getBoundingClientRect(),last=document.querySelector('.letter-tile:last-child').getBoundingClientRect();return{cell:answer.getBoundingClientRect().width,answerFont:parseFloat(getComputedStyle(answer).fontSize),clueFont:parseFloat(getComputedStyle(clueText).fontSize),boardWidth:board.width,boardBottom:board.bottom,areaBottom:area.bottom,clueTop:clue.top,tilesBottom:tiles.bottom,lastBottom:last.bottom,innerWidth,innerHeight}});
    assert.ok(sizing.cell>=43,JSON.stringify(sizing)); assert.ok(sizing.answerFont>=22,JSON.stringify(sizing)); assert.ok(sizing.clueFont>=14,JSON.stringify(sizing)); assert.ok(sizing.boardWidth<=sizing.innerWidth+1,JSON.stringify(sizing));
    assert.ok(Math.abs(sizing.areaBottom-sizing.clueTop)<1,`gap before clue bar: ${JSON.stringify(sizing)}`); assert.ok(Math.abs(sizing.tilesBottom-sizing.innerHeight)<2,`bottom beige gap: ${JSON.stringify(sizing)}`); assert.ok(sizing.lastBottom<=sizing.innerHeight+1,JSON.stringify(sizing));
    await page.screenshot({path:path.join(output,`${scenario.name}-default.png`),fullPage:false});
    const beforeZoom=sizing.cell; await page.locator('#zoom-in').click();
    const afterZoom=await page.locator('.grid-cell.answer').first().evaluate(el=>el.getBoundingClientRect().width); assert.ok(afterZoom>beforeZoom*1.1,{beforeZoom,afterZoom});
    await page.evaluate(()=>{const grid=document.querySelector('#scanword-grid');const fire=(type,id,x)=>grid.dispatchEvent(new PointerEvent(type,{pointerId:id,pointerType:'touch',clientX:x,clientY:100,bubbles:true,cancelable:true}));fire('pointerdown',1,100);fire('pointerdown',2,200);fire('pointermove',2,250);fire('pointerup',1,100);fire('pointerup',2,250)});
    const afterPinch=await page.locator('.grid-cell.answer').first().evaluate(el=>el.getBoundingClientRect().width); assert.ok(afterPinch>afterZoom,{afterZoom,afterPinch});
    await page.locator('#zoom-out').click(); assert.ok(await page.locator('.board-area').evaluate(el=>el.classList.contains('is-zoomed')));
    await page.locator('.letter-tile').first().click(); assert.equal(JSON.parse(await page.evaluate(()=>window.render_game_to_text())).filledCells,initial.filledCells+1);
    await page.locator('#theme-button').click(); assert.ok(await page.locator('body').evaluate(b=>b.classList.contains('theme-dark')));
    await page.locator('#menu-button').click(); assert.equal(await page.locator('#puzzle-list button').count(),7); await page.locator('#close-menu').click();
    await page.screenshot({path:path.join(output,`${scenario.name}-game.png`),fullPage:false});
    const stored=await page.evaluate(()=>localStorage.getItem('nadiia-scanwords-v9')); assert.ok(stored&&stored.includes('scanword-001'));
    await page.reload({waitUntil:'domcontentloaded'}); assert.ok(JSON.parse(await page.evaluate(()=>window.render_game_to_text())).filledCells>=1);
    const clueCount=await page.locator('.clue-part').count(); for(let i=0;i<clueCount;i++){await page.locator('.clue-part').nth(i).click();await page.locator('#hints-button').click();await page.locator('#hint-word').click()}
    await page.waitForSelector('#complete-dialog:not([hidden])'); assert.equal(JSON.parse(await page.evaluate(()=>window.render_game_to_text())).complete,true); assert.deepEqual(errors,[]);
    await context.close();
  }
  await browser.close(); console.log('Browser smoke: v9 large-type 7×10 grid, zoom, bottom dock, persistence, and completion passed.');
})().catch(error=>{console.error(error);process.exitCode=1});
