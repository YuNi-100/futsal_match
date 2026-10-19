const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const path=require('node:path');
const root=path.resolve(__dirname,'..','public');
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 try{
  const page=await browser.newPage({viewport:{width:1366,height:900}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const records=Array.from({length:7},(_,i)=>({match_id:7-i,match_date:`2026-10-${20-i}`,opponent:`상대팀 ${7-i}`,our_score:2,opponent_score:1,result:'win',location:'풋살장'}));
  let empty=false;
  await page.route('**/*',async route=>{
   const url=new URL(route.request().url());
   if(url.hostname!=='wgh.test')return route.fulfill({body:''});
   if(url.pathname==='/auth/me')return route.fulfill({json:{user:null,csrf_token:null}});
   if(url.pathname==='/api/matches')return route.fulfill({json:{success:true,data:empty?[]:records}});
   if(url.pathname==='/api/matches/7')return route.fulfill({json:{success:true,data:{...records[0],memo:'메모',start_time:null,end_time:null,players:[],videos:[]}}});
   if(url.pathname.startsWith('/api/'))return route.fulfill({json:{success:true,data:[]}});
   return route.fulfill({path:path.join(root,url.pathname==='/'?'index.html':url.pathname.slice(1))});
  });
  await page.goto('http://wgh.test/');
  await page.waitForSelector('.match-detail-link');
  assert.equal(await page.locator('#matchList .match-card').count(),5);
  await page.locator('#viewAllButton').click();
  await page.waitForSelector('#allMatchList .match-card');
  assert.equal(new URL(page.url()).pathname,'/matches.html');
  assert.equal(await page.locator('#allMatchList .match-card').count(),7);
  assert.match(await page.locator('.side-menu .active').textContent(),/경기 기록/);
  await page.locator('.match-detail-link').first().click();
  await page.waitForSelector('#matchDetail:not([hidden])');
  assert.equal(new URL(page.url()).searchParams.get('match_id'),'7');
  assert.match(await page.locator('.side-menu .active').textContent(),/경기 기록/);
  await page.locator('.detail-back').click();
  await page.waitForSelector('#allMatchList .match-card');
  assert.equal(new URL(page.url()).pathname,'/matches.html');
  await page.screenshot({path:'C:/Users/EZ/.codex/.chatgpt-projects/g-p-6ac594379aec8191a402e9b21ce9cc51/matches-page.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});
  assert.equal(await page.locator('#allMatchList .match-card').count(),7);
  await page.goto('http://wgh.test/');
  await page.locator('.side-menu a[href="/matches.html"]').click();
  await page.waitForSelector('#allMatchList .match-card');
  empty=true;
  await page.reload();
  await page.waitForFunction(()=>document.querySelector('#matchesStatus').textContent.includes('아직 등록된'));
  assert.equal(await page.locator('#allMatchList .match-card').count(),0);
  assert.deepEqual(errors,[]);
  console.log('PASS: home 5 / full list 7 / menu links / selected detail / active menu / back / mobile / empty state');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
