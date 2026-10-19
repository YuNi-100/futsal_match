const {chromium}=require('playwright');const path=require('node:path');const assert=require('node:assert/strict');const root=path.resolve(__dirname,'..','public');
(async()=>{const browser=await chromium.launch({headless:true,channel:'msedge'});try{
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));let fail=false,patches=0;
 const video={video_id:1,title:'기존 제목',match_date:'2026-10-19',match_id:6,youtube_id:'abcdefghijk'};
 await page.route('**/*',async route=>{const req=route.request(),u=new URL(req.url());if(u.hostname!=='wgh.test')return route.fulfill({body:''});
 if(u.pathname==='/api/admin/video-analyses')return route.fulfill({json:{success:true,data:[]}});
 if(u.pathname==='/auth/me')return route.fulfill({json:{user:{user_id:1,name:'관리자',role:'admin'},csrf_token:'csrf'}});
 if(u.pathname==='/api/matches')return route.fulfill({json:{success:true,data:[{match_id:6,match_date:'2026-10-19',opponent:'상대팀',our_score:3,opponent_score:2}]}});
 if(u.pathname==='/api/youtube-videos')return route.fulfill({json:{success:true,data:[video]}});
 if(u.pathname==='/api/youtube-videos/1/title'){
  patches++;assert.equal(req.method(),'PATCH');assert.equal(req.headers()['x-csrf-token'],'csrf');const body=req.postDataJSON();assert.deepEqual(Object.keys(body),['title']);
  if(fail)return route.fulfill({status:500,json:{detail:'영상 제목을 수정하지 못했습니다.'}});
  video.title=body.title;return route.fulfill({json:{success:true,data:{video_id:1,title:video.title}}});}
 if(u.pathname.startsWith('/api/'))throw Error('Unexpected mutation: '+u.pathname);
 return route.fulfill({path:path.join(root,u.pathname.slice(1))});});
 await page.goto('http://wgh.test/video-register.html');await page.waitForFunction(()=>document.querySelector('#linkVideoSelect').options.length===2);
 assert.equal(await page.locator('#saveVideoTitle').isEnabled(),false);
 await page.selectOption('#linkVideoSelect','1');assert.equal(await page.locator('#editVideoTitle').inputValue(),'기존 제목');
 await page.selectOption('#linkMatchSelect','');
 await page.locator('#editVideoTitle').fill('   ');await page.locator('#saveVideoTitle').click();assert.equal(patches,0);
 fail=true;await page.locator('#editVideoTitle').fill('실패 후 보존');await page.locator('#saveVideoTitle').click();await page.waitForFunction(()=>document.querySelector('#videoLinkStatus').textContent.includes('수정하지 못했습니다'));
 assert.equal(await page.locator('#editVideoTitle').inputValue(),'실패 후 보존');assert.equal(await page.locator('#linkMatchSelect').inputValue(),'');
 fail=false;await page.locator('#editVideoTitle').fill(' 수정 제목 ');await page.locator('#editVideoTitle').press('Enter');await page.waitForFunction(()=>document.querySelector('#videoLinkStatus').textContent==='영상 제목을 수정했습니다.');
 assert.equal(await page.locator('#editVideoTitle').inputValue(),'수정 제목');assert.match(await page.locator('#linkVideoSelect option:checked').textContent(),/수정 제목/);
 assert.match(await page.locator('#analysisVideo option[value="1"]').textContent(),/수정 제목/);assert.equal(await page.locator('#linkMatchSelect').inputValue(),'');assert.equal(video.match_id,6);assert.equal(video.youtube_id,'abcdefghijk');
 assert.deepEqual(errors,[]);console.log('PASS title editor: empty blocked, failure preserved, Enter saves title only, catalog refreshed, pending match choice preserved, source/link unchanged');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
