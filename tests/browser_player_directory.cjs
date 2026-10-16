const {chromium}=require('playwright');const path=require('node:path');const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..','public');
(async()=>{const browser=await chromium.launch({headless:true,channel:'msedge'});try{
 const page=await browser.newPage({viewport:{width:1366,height:900}});const errors=[];page.on('pageerror',e=>errors.push(e.message));let empty=false,fail=false;
 const player={player_id:7,player_name:'정선수',back_number:7,position:'ALA',appearances:2,goals:3,assists:1};
 await page.route('**/*',async route=>{const u=new URL(route.request().url());if(u.hostname!=='wgh.test')return route.fulfill({body:''});
 if(u.pathname==='/auth/me')return route.fulfill({json:{user:null,csrf_token:null}});
 if(u.pathname==='/api/players')return route.fulfill({status:fail?500:200,json:{success:!fail,data:empty?[]:[player]}});
 if(u.pathname==='/api/players/7')return route.fulfill({json:{success:true,data:{...player,joined_at:null,matches:[]}}});
 if(u.pathname.startsWith('/api/'))return route.fulfill({json:{success:true,data:[]}});
 return route.fulfill({path:path.join(root,u.pathname==='/'?'index.html':u.pathname.slice(1))});});
 await page.goto('http://wgh.test/');await page.waitForSelector('#playerList a.player-item');
 assert.match(await page.locator('#players').textContent(),/선수 기록/);
 await page.locator('.side-menu a[href="players.html"]').click();await page.waitForSelector('#playerDirectory a');
 assert.equal(new URL(page.url()).pathname,'/players.html');assert.match(await page.locator('.side-menu .active').textContent(),/선수 정보/);
 await page.locator('#playerDirectory .player-stats').click();await page.waitForSelector('#playerDetail:not([hidden])');
 assert.equal(new URL(page.url()).searchParams.get('player_id'),'7');assert.match(await page.locator('.side-menu .active').textContent(),/선수 정보/);
 await page.locator('#playerBack').click();await page.waitForSelector('#playerDirectory a');assert.equal(new URL(page.url()).pathname,'/players.html');
 await page.setViewportSize({width:390,height:844});assert.equal(await page.locator('#playerDirectory a').isVisible(),true);
 await page.goto('http://wgh.test/player.html?player_id=7&match_id=6');await page.waitForSelector('#playerDetail:not([hidden])');assert.equal(await page.locator('#playerBack').getAttribute('href'),'/match.html?match_id=6');
 for(const url of ['/matches.html','/match.html?match_id=6','/video.html']){await page.goto('http://wgh.test'+url);assert.equal(await page.locator('.side-menu a[href="players.html"]').textContent(),'♙선수 정보');}
 empty=true;await page.goto('http://wgh.test/players.html');await page.waitForFunction(()=>document.querySelector('#playersStatus').textContent.includes('등록된 선수가 없습니다'));
 fail=true;await page.reload();await page.waitForFunction(()=>document.querySelector('#playersStatus').textContent.includes('불러오지 못했습니다'));
 assert.deepEqual(errors,[]);console.log('PASS: home retained, sidebar directory, full card profile, active menu, list/match return, mobile, empty/error states');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1});
