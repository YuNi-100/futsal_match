const {chromium}=require('playwright');const path=require('node:path');const assert=require('node:assert/strict');const root=path.resolve(__dirname,'..','public');
(async()=>{const browser=await chromium.launch({headless:true,channel:'msedge'});try{
 for(const role of ['guest','user','admin']){
  const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));let saved=null;
  const videos=[{video_id:1,title:'기존 영상',match_date:'2026-10-15',match_id:6,youtube_id:'abcdefghijk'}];
  const matches=[{match_id:6,match_date:'2026-10-15',opponent:'은평FC',our_score:3,opponent_score:2},{match_id:3,match_date:'2026-10-01',opponent:'다른 팀',our_score:1,opponent_score:0}];
  await page.route('**/*',async route=>{const req=route.request(),u=new URL(req.url());if(u.hostname!=='wgh.test')return route.fulfill({body:''});
   if(u.pathname==='/auth/me')return route.fulfill({json:{user:role==='guest'?null:{user_id:1,name:'테스트',role},csrf_token:'csrf'}});
   if(u.pathname==='/api/matches')return route.fulfill({json:{success:true,data:matches}});
   if(u.pathname==='/api/youtube-videos/1/match'){
    assert.equal(req.method(),'PATCH');assert.equal(req.headers()['x-csrf-token'],'csrf');saved=req.postDataJSON();videos[0].match_id=saved.match_id;return route.fulfill({json:{success:true,data:{video_id:1,match_id:saved.match_id}}});}
   if(u.pathname==='/api/youtube-videos'){
    if(req.method()==='POST'){saved=req.postDataJSON();assert.equal(req.headers()['x-csrf-token'],'csrf');return route.fulfill({status:201,json:{success:true}});}
    return route.fulfill({json:{success:true,data:videos}});}
   return route.fulfill({path:path.join(root,u.pathname==='/'?'index.html':u.pathname.slice(1))});});
  await page.goto('http://wgh.test/video.html');await page.waitForFunction(()=>document.querySelector('#linkVideoSelect').options.length===2&&document.querySelector('#videoMatchSelect').options.length===3);
  assert.equal(await page.locator('#videoLinkForm').isVisible(),role==='admin');assert.equal(await page.locator('#youtubeRegisterForm').isVisible(),role==='admin');
  if(role==='admin'){
   await page.selectOption('#linkVideoSelect','1');assert.equal(await page.locator('#linkMatchSelect').inputValue(),'6');
   await page.selectOption('#linkMatchSelect','3');await page.locator('#saveVideoMatch').click();await page.waitForFunction(()=>document.querySelector('#videoLinkStatus').textContent.includes('저장했습니다'));assert.deepEqual(saved,{match_id:3});
   await page.waitForFunction(()=>!document.querySelector('#saveVideoMatch').disabled);await page.selectOption('#linkMatchSelect','');await page.locator('#saveVideoMatch').click();await page.waitForFunction(()=>document.querySelector('#videoLinkStatus').textContent.includes('해제했습니다'));assert.deepEqual(saved,{match_id:null});
   await page.fill('#videoTitle','새 영상');await page.fill('#youtubeUrl','https://youtu.be/12345678901');await page.fill('#videoMatchDate','2026-10-15');await page.selectOption('#videoMatchSelect','6');await page.locator('#videoRegisterBtn').click();await page.waitForFunction(()=>document.querySelector('#videoRegisterMessage').textContent.includes('성공적으로'));assert.equal(saved.match_id,6);
  }
  assert.deepEqual(errors,[]);console.log(role+': registration match selection, link/unlink and visibility OK');await page.close();
 }
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1});
