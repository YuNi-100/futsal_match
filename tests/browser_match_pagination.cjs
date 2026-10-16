const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const path=require('node:path');
const root=path.resolve(__dirname,'..','public');
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 try{
  const page=await browser.newPage({viewport:{width:1366,height:900}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  let count=23;
  await page.route('**/*',async route=>{
   const u=new URL(route.request().url());
   if(u.hostname!=='wgh.test')return route.fulfill({body:''});
   if(u.pathname==='/auth/me')return route.fulfill({json:{user:null,csrf_token:null}});
   if(u.pathname==='/api/matches')return route.fulfill({json:{success:true,data:Array.from({length:count},(_,i)=>({match_id:count-i,match_date:`2026-10-${String(count-i).padStart(2,'0')}`,opponent:`상대팀 ${count-i}`,our_score:12,opponent_score:3,result:'win',location:'풋살장'}))}});
   if(u.pathname.startsWith('/api/'))return route.fulfill({json:{success:true,data:[]}});
   return route.fulfill({path:path.join(root,u.pathname==='/'?'index.html':u.pathname.slice(1))});
  });
  await page.goto('http://wgh.test/matches.html');
  await page.waitForSelector('#allMatchList .match-card');
  assert.equal(await page.locator('.match-card').count(),10);
  assert.equal(await page.locator('.matches-page-link[aria-current]').textContent(),'1');
  assert.equal(await page.locator('.matches-page-link[aria-disabled]').textContent(),'이전');
  assert.equal(await page.locator('.match-score').first().evaluate(e=>getComputedStyle(e).borderLeftWidth),'1px');
  assert.ok(await page.locator('.match-card').first().evaluate(e=>e.getBoundingClientRect().height)<65);
  await page.screenshot({path:'C:/Users/EZ/.codex/.chatgpt-projects/g-p-6ac594379aec8191a402e9b21ce9cc51/matches-compact.png',fullPage:true});
  await page.getByRole('link',{name:'2',exact:true}).click();
  assert.equal(await page.locator('.match-card').count(),10);
  assert.match(await page.locator('.match-detail-link').first().getAttribute('href'),/match_id=13$/);
  await page.getByRole('link',{name:'다음',exact:true}).click();
  assert.equal(await page.locator('.match-card').count(),3);
  assert.equal(await page.locator('.matches-page-link[aria-disabled]').textContent(),'다음');
  await page.goBack();
  assert.equal(await page.locator('.match-card').count(),10);
  assert.equal(await page.locator('.matches-page-link[aria-current]').textContent(),'2');
  await page.reload();
  await page.waitForSelector('.match-card');
  assert.equal(await page.locator('.matches-page-link[aria-current]').textContent(),'2');
  for(const n of [10,11,0]){
   count=n;
   await page.goto('http://wgh.test/matches.html');
   await page.waitForFunction(n=>document.querySelector('#matchCount').textContent===`전체 ${n}경기`,n);
   assert.equal(await page.locator('.match-card').count(),Math.min(n,10));
   assert.equal(await page.locator('#matchPagination').isVisible(),n>10);
  }
  count=23;
  await page.goto('http://wgh.test/matches.html?page=999');
  await page.waitForSelector('.match-card');
  assert.equal(new URL(page.url()).searchParams.get('page'),'3');
  await page.setViewportSize({width:390,height:844});
  assert.equal(await page.locator('.match-location').first().isVisible(),true);
  await page.goto('http://wgh.test/');
  await page.waitForSelector('.match-card');
  assert.equal(await page.locator('#matchList .match-card').count(),5);
  assert.deepEqual(errors,[]);
  console.log('PASS: compact list, separators, 10/10/3 pagination, previous/next, history/reload, 0/10/11 boundaries, page clamp, mobile, home unchanged');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
