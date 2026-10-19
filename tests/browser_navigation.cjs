const {chromium}=require('playwright');const path=require('node:path');const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..','public');
(async()=>{const browser=await chromium.launch({headless:true,channel:'msedge'});try{
 const page=await browser.newPage({viewport:{width:1366,height:900}});const errors=[];page.on('pageerror',e=>errors.push(e.message));let schedules=[],fail=false;
 await page.route('**/*',async route=>{const u=new URL(route.request().url());if(u.hostname!=='wgh.test')return route.fulfill({body:''});
 if(u.pathname==='/auth/me')return route.fulfill({json:{user:null,csrf_token:null}});
 if(u.pathname==='/api/schedules')return route.fulfill({status:fail?500:200,json:{success:!fail,data:schedules}});
 if(u.pathname.startsWith('/api/players/'))return route.fulfill({json:{success:true,data:{player_id:1,player_name:'선수',back_number:1,position:'ALA',appearances:0,goals:0,assists:0,matches:[]}}});
 if(u.pathname.startsWith('/api/matches/'))return route.fulfill({json:{success:true,data:{match_id:1,match_date:'2026-10-19',opponent:'상대팀',our_score:1,opponent_score:0,result:'win',players:[],videos:[]}}});
 if(u.pathname.startsWith('/api/'))return route.fulfill({json:{success:true,data:[]}});
 return route.fulfill({path:path.join(root,u.pathname==='/'?'index.html':u.pathname.slice(1))});});
 const expected=[['홈','/index.html'],['경기 기록','/matches.html'],['선수 정보','/players.html'],['다음 경기','/schedules.html'],['팀 소개','/index.html#team'],['경기 영상','/video.html']];
 for(const [url,active]of [['/','홈'],['/matches.html','경기 기록'],['/match.html?match_id=1','경기 기록'],['/players.html','선수 정보'],['/player.html?player_id=1','선수 정보'],['/video.html','경기 영상'],['/schedules.html','다음 경기']]){
  await page.goto('http://wgh.test'+url);await page.waitForSelector('.side-menu a[href="/schedules.html"]');
  const actual=await page.locator('.side-menu a').evaluateAll(links=>links.map(a=>[a.querySelector('span:last-child').textContent,a.getAttribute('href')]));assert.deepEqual(actual,expected);
  assert.equal(await page.locator('.side-menu .active span:last-child').textContent(),active);
 }
 await page.getByRole('link',{name:'팀 소개',exact:false}).click();
 await page.waitForFunction(()=>location.pathname==='/index.html'&&location.hash==='#team');
 assert.equal(await page.locator('#team').count(),1);assert.equal(await page.locator('#stats').count(),1);assert.match(await page.locator('#players').textContent(),/선수 기록/);
 assert.equal(await page.locator('.side-menu .active span:last-child').textContent(),'팀 소개');
 await page.locator('.side-menu a[href="/index.html"]').click();await page.waitForFunction(()=>!location.hash);
 assert.equal(await page.locator('.side-menu .active span:last-child').textContent(),'홈');
 schedules=[{schedule_id:2,match_date:'2026-10-23',start_time:null,end_time:null,opponent:'늦은 경기',location:null,memo:null},{schedule_id:1,match_date:'2026-10-22',start_time:'20:00:00',end_time:'24:00:00',opponent:'은평',location:'풋살장',memo:'<img src=x onerror="throw Error(123)">'}];
 await page.locator('.side-menu a[href="/schedules.html"]').click();await page.waitForSelector('.schedule-page-card');
 assert.equal(await page.locator('.schedule-page-card').count(),2);assert.match(await page.locator('.schedule-page-card').first().textContent(),/20:00 ~ 24:00/);
 assert.match(await page.locator('.schedule-page-card').first().textContent(),/은평/);assert.equal(await page.locator('.schedule-page-memo img').count(),0);
 await page.screenshot({path:'C:/Users/EZ/.codex/.chatgpt-projects/g-p-6ac594379aec8191a402e9b21ce9cc51/schedules-preview.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});assert.equal(await page.locator('.schedule-page-card').first().isVisible(),true);
 schedules=[];await page.reload();await page.waitForFunction(()=>document.querySelector('#schedulePageStatus').textContent.includes('登録')||document.querySelector('#schedulePageStatus').textContent.includes('등록된 다음'));
 fail=true;await page.reload();await page.waitForFunction(()=>document.querySelector('#schedulePageStatus').textContent.includes('불러오지 못했습니다'));
 assert.deepEqual(errors,[]);console.log('PASS: 7 pages consistent menus, exact routes, active states, team/home anchors, home stats/players retained, schedules order/time/null, safe text, mobile, empty/error');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1});
