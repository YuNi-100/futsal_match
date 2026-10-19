const {chromium}=require('playwright');const path=require('node:path');const assert=require('node:assert/strict');const root=path.resolve(__dirname,'..','public');
(async()=>{const browser=await chromium.launch({headless:true,channel:'msedge'});try{
 const page=await browser.newPage();let saved=null,videoFail=false;const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',async route=>{const req=route.request(),u=new URL(req.url());if(u.hostname!=='wgh.test')return route.fulfill({body:''});
 if(u.pathname==='/auth/me')return route.fulfill({json:{user:{user_id:1,name:'테스트',role:'admin'},csrf_token:'csrf'}});
 if(u.pathname==='/api/players')return route.fulfill({json:{success:true,data:[{player_id:1,player_name:'선수',back_number:7,position:'ALA',appearances:1,goals:2,assists:0}]}});
 if(u.pathname==='/api/youtube-videos')return route.fulfill({status:videoFail?503:200,json:{success:!videoFail,data:[{video_id:7,title:'미연결 영상',match_date:'2026-10-15',match_id:null,youtube_id:'abcdefghijk'},{video_id:8,title:'다른 경기 영상',match_date:'2026-10-01',match_id:3,youtube_id:'12345678901'}]}});
 if(u.pathname==='/api/matches'){
  if(req.method()==='POST'){saved=req.postDataJSON();return route.fulfill({status:201,json:{success:true,data:{match_id:99}}});}
  return route.fulfill({json:{success:true,data:[]}});}
 if(u.pathname.startsWith('/api/'))return route.fulfill({json:{success:true,data:[]}});
 return route.fulfill({path:path.join(root,u.pathname==='/'?'index.html':u.pathname.slice(1))});});
 await page.goto('http://wgh.test/matches.html');await page.waitForSelector('html.wgh-admin');
 await page.locator('[data-wgh-create="match"]').click();await page.waitForSelector('dialog[open]');
 await page.waitForFunction(()=>document.querySelector('#registerVideo')?.options.length===3);
 assert.equal(await page.locator('#registerVideo option[value="8"]').evaluate(e=>e.disabled),true);
 await page.selectOption('#registerVideo','7');await page.fill('#registerOpponent','영상 연결 경기');
 await page.locator('dialog .match-player-checkbox').check();await page.fill('dialog [data-record=goals]','2');
 await page.locator('dialog [type=submit]').click();await page.waitForFunction(()=>!document.querySelector('dialog[open]'));
 assert.equal(saved.video_id,7);assert.equal(saved.players[0].goals,2);
 await page.goto('http://wgh.test/');await page.waitForSelector('html.wgh-admin');
 await page.locator('#addMatchButton').click();await page.waitForFunction(()=>document.querySelector('#registerVideo')?.options.length===3);
 await page.locator('dialog [data-register-close]').first().click();
 videoFail=true;
 await page.locator('#addMatchButton').click();
 await page.waitForFunction(()=>document.querySelector('#registerVideo')?.textContent.includes('영상 조회 실패'));
 await page.fill('#registerOpponent','연결 없이 등록');await page.locator('dialog [type=submit]').click();await page.waitForFunction(()=>!document.querySelector('dialog[open]'));
 assert.equal(saved.video_id,null);
 await page.goto('http://wgh.test/video-register.html');await page.waitForSelector('html.wgh-admin');
 assert.equal(await page.locator('main section.video-panel').first().getAttribute('aria-labelledby'),'uploadTitle');
 const order=await page.locator('main section.video-panel').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('aria-labelledby')));
 assert.deepEqual(order,['uploadTitle','videoLinkTitle','analysisTitle']);
 assert.equal(await page.locator('#unlinkVideoMatch').isVisible(),true);
 await page.screenshot({path:'C:/Users/EZ/.codex/.chatgpt-projects/g-p-6ac594379aec8191a402e9b21ce9cc51/video-primary-register.png',fullPage:true});
 assert.deepEqual(errors,[]);console.log('PASS: primary card order, shared/home match video choice, linked video disabled, payload+players, optional lookup failure, unlink control');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1});
