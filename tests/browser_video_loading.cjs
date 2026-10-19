const {chromium}=require('playwright');
const path=require('node:path');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..','public');
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 try {
  for(const scenario of ['normal','expired','consent','timeout','server-error','filtered']) {
   const page=await browser.newPage();
   const errors=[];let dialogs=0,requests=0,recovered=false;
   page.on('pageerror',error=>errors.push(error.message));
   page.on('dialog',async dialog=>{dialogs++;await dialog.dismiss();});
   const videos=[
    {video_id:1,title:'기존 경기 영상',youtube_id:'abcdefghijk',match_id:null,match_date:'2026-10-19'},
    {video_id:2,title:'연결된 경기 영상',youtube_id:'12345678901',match_id:16,match_date:'2026-10-18'}
   ];
   await page.clock.install();
   await page.route('**/*',async route=>{
    const url=new URL(route.request().url());
    if(url.hostname!=='wgh.test')return route.fulfill({body:''});
    if(url.pathname==='/auth/me')return route.fulfill({json:{user:{user_id:1,name:'관리자',role:'admin'},csrf_token:'csrf'}});
    if(url.pathname==='/api/youtube-videos'){
     requests++;
     if(scenario==='timeout'&&!recovered)return; // Leave the first request pending until AbortController fires.
     if(scenario==='expired')return route.fulfill({status:401,json:{detail:'경기 영상은 로그인 후 볼 수 있습니다.'}});
     if(scenario==='consent')return route.fulfill({status:403,json:{detail:'동의 필요'}});
     if(scenario==='server-error'&&!recovered)return route.fulfill({status:500,json:{detail:'서버 오류'}});
     return route.fulfill({json:{success:true,data:videos}});
    }
    return route.fulfill({path:path.join(root,url.pathname.slice(1))});
   });
   await page.goto('http://wgh.test/video.html'+(scenario==='filtered'?'?match_id=16':''));
   if(scenario==='expired'||scenario==='consent'){
    await page.locator('#fullVideoList a[href="/account.html"]').waitFor();
    assert.equal(await page.locator('#fullVideoList .video-list-item').count(),0);
    assert.equal(await page.locator('#fullPlayer').getAttribute('src'),null);
    assert.equal(await page.locator('html').evaluate(el=>el.classList.contains('wgh-admin')),false);
    if(scenario==='expired')assert.match(await page.locator('#fullVideoList').textContent(),/현재 요청의 로그인 정보를 확인할 수 없습니다/);
    assert.equal(dialogs,0);
   }else if(scenario==='timeout'||scenario==='server-error'){
    if(scenario==='timeout'){
     await page.waitForFunction(()=>document.querySelector('#fullVideoList').textContent.includes('불러오는 중'));
     // Wait for the intercepted request so the timeout applies to the intended fetch.
     while(requests===0)await new Promise(resolve=>setTimeout(resolve,10));
     await page.clock.runFor(16000);
    }
    await page.locator('#fullVideoList button').waitFor();
    assert.match(await page.locator('#fullVideoList').textContent(),/다시 불러오기/);
    recovered=true;
    await page.locator('#fullVideoList button').click();
    await page.locator('.video-list-item').first().waitFor();
    assert.equal(await page.locator('.video-list-item').count(),2);
    assert.equal(requests,2);
   }else{
    await page.locator('.video-list-item').first().waitFor();
    assert.equal(await page.locator('.video-list-item').count(),scenario==='filtered'?1:2);
    await page.locator('.video-list-item').first().click();
    assert.match(await page.locator('#fullPlayer').getAttribute('src'),/youtube.com\/embed\//);
   }
   assert.deepEqual(errors,[]);
   console.log('PASS:',scenario);
   await page.close();
  }
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
