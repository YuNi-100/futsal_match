const {chromium}=require('playwright');
const path=require('node:path');
const assert=require('node:assert/strict');
const root='C:/workspace/futsal_match/public';
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 try {
  for(const role of ['guest','admin']) {
   const page=await browser.newPage({viewport:{width:1366,height:900}});
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   const match={match_id:6,match_date:'2026-10-15',opponent:'WGH 은평',our_score:3,opponent_score:2,result:'win',location:'은평 풋살장',memo:'첫 번째 메모\n<img src=x onerror="throw Error(123)">',start_time:null,end_time:null,players:[{player_id:1,player_name:'테스트 선수',back_number:7,position:'ALA',goals:2,assists:1}],videos:[{video_id:3,title:'이 경기 영상',youtube_id:'abcdefghijk'}]};
   let videos=match.videos;
   await page.route('**/*',async route=>{
    const url=new URL(route.request().url());
    if(url.hostname!=='wgh.test') return route.fulfill({body:''});
    if(url.pathname==='/auth/me')return route.fulfill({json:{user:role==='guest'?null:{user_id:1,name:'관리자',role:'admin'},csrf_token:'test'}});
    if(url.pathname==='/api/matches/6')return route.fulfill({json:{success:true,data:{...match,videos}}});
    if(url.pathname==='/api/matches/999')return route.fulfill({status:404,json:{detail:'경기 기록을 찾을 수 없습니다.'}});
    if(url.pathname==='/api/matches/6/players')return route.fulfill({json:{success:true,data:match.players}});
    if(url.pathname==='/api/matches')return route.fulfill({json:{success:true,data:[match]}});
    if(url.pathname==='/api/players')return route.fulfill({json:{success:true,data:match.players}});
    if(url.pathname==='/api/schedules')return route.fulfill({json:{success:true,data:[]}});
    if(url.pathname==='/api/youtube-videos')return route.fulfill({json:{success:true,data:[{...match.videos[0],match_id:6,match_date:match.match_date},{video_id:4,match_id:1,title:'다른 경기 영상',youtube_id:'12345678901'}]}});
    return route.fulfill({path:path.join(root,url.pathname==='/'?'index.html':url.pathname.slice(1))});
   });
   await page.goto('http://wgh.test/');
   await page.waitForSelector('.match-detail-link');
   if(role==='admin'){
    await page.waitForSelector('html.wgh-admin');
    await page.locator('.edit-match-button').click();
    assert.equal(new URL(page.url()).pathname,'/');
    await page.locator('#modalCloseButton').click();
   }
   await page.locator('.match-detail-link').click();
   await page.waitForSelector('#matchDetail:not([hidden])');
   assert.equal(new URL(page.url()).searchParams.get('match_id'),'6');
   assert.equal(await page.locator('#detailTime').textContent(),'시간 미등록');
   assert.equal(await page.locator('#detailLocation').textContent(),'은평 풋살장');
   assert.equal(await page.locator('#detailMemo img').count(),0);
   assert.match(await page.locator('#detailScorers').textContent(),/테스트 선수 2골/);
   assert.equal(await page.locator('#detailPlayers tr').count(),1);
   await page.locator('#matchVideoLink').click();
   assert.equal(new URL(page.url()).searchParams.get('match_id'),'6');
   if(role==='guest') {
     await page.waitForFunction(()=>document.querySelector('main')?.textContent.includes('로그인 후'));
     assert.equal(await page.locator('iframe').count(),0);
   }else{
     await page.waitForSelector('.video-list-item');
     assert.equal(await page.locator('.video-list-item').count(),1);
     assert.match(await page.locator('#fullPlayer').getAttribute('src'),/abcdefghijk/);
   }
   videos=[];
   await page.goto('http://wgh.test/match.html?match_id=6');
   await page.waitForSelector('#matchDetail:not([hidden])');
   assert.equal(await page.locator('#matchVideoLink').isVisible(),false);
   assert.equal(await page.locator('#noMatchVideo').isDisabled(),true);
   await page.setViewportSize({width:390,height:844});
   assert.equal(await page.locator('#detailPlayers').isVisible(),true);
   await page.screenshot({path:'C:/Users/EZ/.codex/.chatgpt-projects/g-p-6ac594379aec8191a402e9b21ce9cc51/match-detail-mobile.png',fullPage:true});
   await page.goto('http://wgh.test/match.html?match_id=999');
   await page.waitForFunction(()=>document.querySelector('#detailStatus').textContent.includes('찾을 수 없습니다'));
   assert.deepEqual(errors,[]);
   console.log(role+': card navigation, admin action isolation, details, video filtering, empty video and mobile passed');
   await page.close();
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
