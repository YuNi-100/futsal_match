const {chromium}=require('playwright');const path=require('node:path');const assert=require('node:assert/strict');const root=path.resolve(__dirname,'..','public');
(async()=>{const browser=await chromium.launch({headless:true,channel:'msedge'});try{
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));let fail=false,deleted=0;
 let videos=[{video_id:1,title:'선택 영상',match_date:'2026-10-19',match_id:6,youtube_id:'abcdefghijk'},{video_id:2,title:'유지할 영상',match_date:'2026-10-18',match_id:null,youtube_id:'12345678901'}];
 await page.route('**/*',async route=>{const req=route.request(),u=new URL(req.url());if(u.hostname!=='wgh.test')return route.fulfill({body:''});
 if(u.pathname==='/auth/me')return route.fulfill({json:{user:{user_id:1,name:'관리자',role:'admin'},csrf_token:'csrf'}});
 if(u.pathname==='/api/matches')return route.fulfill({json:{success:true,data:[{match_id:6,match_date:'2026-10-19',opponent:'은평',our_score:3,opponent_score:2}]}});
 if(u.pathname==='/api/youtube-videos')return route.fulfill({json:{success:true,data:videos}});
 if(u.pathname==='/api/youtube-videos/1'){
  assert.equal(req.method(),'DELETE');assert.equal(req.headers()['x-csrf-token'],'csrf');deleted++;
  if(fail)return route.fulfill({status:500,json:{detail:'영상 등록 정보를 삭제하지 못했습니다.'}});
  videos=videos.filter(v=>v.video_id!==1);return route.fulfill({json:{success:true}});}
 return route.fulfill({path:path.join(root,u.pathname.slice(1))});});
 await page.goto('http://wgh.test/video-register.html');
 await page.waitForFunction(()=>document.querySelector('#linkVideoSelect').options.length===3);
 assert.equal(await page.locator('#deleteRegisteredVideo').isEnabled(),false);
 await page.selectOption('#linkVideoSelect','1');assert.equal(await page.locator('#deleteRegisteredVideo').isEnabled(),true);
 page.once('dialog',async dialog=>{assert.match(dialog.message(),/선택 영상/);assert.match(dialog.message(),/YouTube 원본은 유지/);assert.match(dialog.message(),/분석 자료/);await dialog.dismiss();});
 await page.locator('#deleteRegisteredVideo').click();assert.equal(deleted,0);
 fail=true;page.once('dialog',dialog=>dialog.accept());await page.locator('#deleteRegisteredVideo').click();
 await page.waitForFunction(()=>document.querySelector('#videoLinkStatus').textContent.includes('삭제하지 못했습니다'));
 assert.equal(await page.locator('#linkVideoSelect').inputValue(),'1');
 assert.equal(await page.locator('#linkVideoSelect option[value="1"]').count(),1);
 fail=false;page.once('dialog',dialog=>dialog.accept());await page.locator('#deleteRegisteredVideo').click();
 await page.waitForFunction(()=>document.querySelector('#linkVideoSelect option[value="1"]')===null);
 assert.equal(await page.locator('#linkVideoSelect option[value="2"]').count(),1);
 assert.equal(await page.locator('#deleteRegisteredVideo').isEnabled(),false);
 assert.match(await page.locator('#videoLinkStatus').textContent(),/경기·선수 기록과 YouTube 원본은 유지/);
 assert.deepEqual(errors,[]);console.log('PASS: disabled without selection, clear confirmation, cancel sends no DELETE, error preserves selection, success removes only selected entry, other video retained');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
