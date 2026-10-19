const {chromium}=require('playwright');const path=require('node:path');const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..','public');
(async()=>{const browser=await chromium.launch({headless:true,channel:'msedge'});try{
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));let posted=null;
 const result={analysis_id:7,video_id:9,title:'은평vs다산2',model:'test-model',team_color:'파란색 계열의 진한 유니폼',start_seconds:0,end_seconds:1210,analysis:{summary:'검수 전 경기 흐름',scenes:[{time_seconds:620,category:'확인 어려움',observation:'유니폼 구분 어려움',comment:'팀을 확정하지 않습니다.',next_action:'원본 확인'}],limitations:['원본 검수 필요']}};
 await page.route('**/*',async route=>{const req=route.request(),u=new URL(req.url());if(u.hostname!=='wgh.test')return route.fulfill({body:''});
  if(u.pathname==='/auth/me')return route.fulfill({json:{user:{user_id:1,name:'관리자',role:'admin'},csrf_token:'csrf'}});
  if(u.pathname==='/api/youtube-videos')return route.fulfill({json:{success:true,data:[{video_id:9,title:'은평vs다산2',youtube_id:'Gfgr1JNRgG4',match_date:'2026-03-30'}]}});
  if(u.pathname==='/api/youtube-videos/9/feedback'){posted=req.postDataJSON();assert.equal(req.headers()['x-csrf-token'],'csrf');return route.fulfill({json:{success:true,cached:false,data:result}});}
  if(u.pathname==='/api/admin/video-analyses/7')return route.fulfill({json:{success:true,data:result}});
  return route.fulfill({path:path.join(root,u.pathname.slice(1))});
 });
 await page.goto('http://wgh.test/feedback.html?video_id=9&end=1210');
 await page.waitForFunction(()=>!document.querySelector('#analyze').disabled);
 assert.equal(await page.locator('#end').inputValue(),'1210');
 assert.match(await page.locator('#color').inputValue(),/파란색/);
 await page.locator('#consent').check();await page.locator('#analyze').click();
 await page.locator('#result').waitFor({state:'visible'});
 assert.equal(posted.end_seconds,1210);assert.equal(posted.consent,true);
 assert.match(await page.locator('#summary').textContent(),/검수 전/);
 assert.match(page.url(),/analysis_id=7/);
 await page.locator('#scenes button').click();assert.match(await page.locator('#player').getAttribute('src'),/start=620/);
 posted=null;await page.reload();await page.locator('#result').waitFor({state:'visible'});
 assert.equal(posted,null);assert.match(await page.locator('#status').textContent(),/추가 AI 호출은 하지/);
 assert.deepEqual(errors,[]);console.log('PASS: full 20m10s request, dark-blue uniform, consent+CSRF, saved result reload without AI, scene timestamp jump');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
