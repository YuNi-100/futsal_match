// Browser regression checks with mocked APIs. No real DB, Google or paid API calls.
const {chromium} = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..', 'public');
(async () => {
  const browser = await chromium.launch({headless:true,channel:'msedge'});
  try {
    await testRegistrations(browser);
    await verifyMembershipUI(browser);
    for (const role of ['guest','user','admin']) {
      const context = await browser.newContext({viewport:{width:1366,height:900}});
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      let csrf = null;
      let savedPlayers = null;
      await page.route('http://wgh.test/**', async route => {
        const request = route.request();
        const url = new URL(request.url());
        if (url.pathname === '/auth/me') return route.fulfill({json:{
          user: role === 'guest' ? null : {user_id:7,name:'테스트 계정',role},
          csrf_token: role === 'guest' ? null : 'browser-csrf',
        }});
        if (url.pathname.startsWith('/api')) {
          if (['POST','PUT'].includes(request.method())) {
            csrf = request.headers()['x-csrf-token'];
            savedPlayers = request.postDataJSON()?.players;
          }
          let data = [];
          if (url.pathname === '/api/matches') data = [{match_id:1,match_date:'2026-10-16',start_time:'20:00',end_time:'21:00',opponent:'기존 상대팀',our_score:2,opponent_score:1,result:'win',location:'기존 구장'}];
          if (url.pathname === '/api/schedules') data = [{schedule_id:1,match_date:'2026-10-20',start_time:'20:00',end_time:'21:00',opponent:'다음 상대팀',location:'기존 구장'}];
          if (url.pathname === '/api/matches/1/players') data = [{player_id:1,goals:2,assists:1}];
          if (url.pathname === '/api/players') data = [{player_id:1,player_name:'<img src=x onerror="throw Error(123)">',back_number:7,position:'ALA',appearances:1,goals:2,assists:0}];
          return route.fulfill({json:{success:true,data}});
        }
        const file = path.join(root, url.pathname === '/' ? 'index.html' : url.pathname.slice(1));
        return route.fulfill({path:file});
      });
      for (const route of ['/','/video.html','/feedback.html','/article.html']) {
        await page.goto('http://wgh.test' + route);
        await page.waitForFunction(() => document.querySelector('[data-auth-panel]')?.textContent.length > 0);
        assert.equal(await page.locator('html').evaluate(el => el.classList.contains('wgh-admin')), role === 'admin');
        if (route === '/') {
          assert.equal(await page.locator('#addMatchButton').isVisible(), role === 'admin');
          await page.waitForSelector('.edit-match-button', {state:'attached'});
          assert.equal(await page.locator('.edit-match-button').isVisible(), role === 'admin');
          assert.equal(await page.getByText('기존 상대팀',{exact:true}).isVisible(),true);
          if (role === 'admin') {
            await page.locator('#addMatchButton').click();
            assert.equal(await page.locator('#matchStartTime,#matchEndTime').count(), 0);
            await page.locator('dialog [data-register-close]').first().click();
            await page.locator('.edit-match-button').click();
            await page.waitForFunction(() => !document.querySelector('#matchForm [type=submit]').disabled);
            assert.equal(await page.locator('.match-player-checkbox').isChecked(),true);
            assert.equal(await page.locator('.match-player-goals').inputValue(),'2');
            assert.equal(await page.locator('.match-player-assists').inputValue(),'1');
            await page.locator('.match-player-goals').fill('3');
            page.once('dialog',dialog => dialog.accept());
            await page.locator('#matchForm [type=submit]').click();
            await page.waitForFunction(() => !document.querySelector('#matchModal').classList.contains('active'));
            assert.deepEqual(savedPlayers,[{player_id:1,goals:3,assists:1}]);
          }
        }
        if (route === '/video.html') assert.equal(await page.locator('#youtubeRegisterForm').count(), 0);
        if (route === '/' && role === 'guest') {
          await page.screenshot({path:path.resolve(__dirname,'..','..','wgh-login-preview.png'),fullPage:true});
          await page.setViewportSize({width:390,height:844});
          assert.equal(await page.getByText('Google 계정으로 로그인',{exact:true}).count(),1);
          await page.setViewportSize({width:1366,height:900});
        }
      }
      if (role === 'admin') {
        await page.evaluate(() => fetch('/api/matches',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}));
        assert.equal(csrf,'browser-csrf');
      }
      assert.deepEqual(errors, []);
      console.log(`${role}: 4 pages, controls and JavaScript OK`);
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(error => {console.error(error);process.exitCode=1;});


async function testRegistrations(browser) {
  const projectRoot = require('node:path').resolve(__dirname,'..','public');
  for (const role of ['guest','user','admin']) {
    const context=await browser.newContext();const page=await context.newPage();const errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    let saved=null;
    let matchLayout=null;
    const players=[{player_id:1,player_name:'기존 선수',back_number:7,position:'ALA',appearances:1,goals:1,assists:0}];
    const matches=[];const schedules=[];
    await page.route('**/*',async route=>{
      const request=route.request(),url=new URL(request.url());
      if(url.hostname!=='wgh.test')return route.fulfill({body:''});
      if(url.pathname==='/auth/me')return route.fulfill({json:{user:role==='guest'?null:{user_id:1,name:'테스트',role},csrf_token:'csrf'}});
      if(url.pathname.startsWith('/api/')){
        if(request.method()==='POST'){
          assert.equal(request.headers()['x-csrf-token'],'csrf');saved=request.postDataJSON();
          if(url.pathname==='/api/players'){
            if(players.some(p=>p.back_number===saved.back_number))return route.fulfill({status:409,json:{detail:'이미 사용 중인 등번호입니다.'}});
            players.push({...saved,player_id:players.length+1,appearances:0,goals:0,assists:0});
          }
          if(url.pathname==='/api/matches')matches.push({...saved,match_id:9,result:'win'});
          if(url.pathname==='/api/schedules')schedules.push({...saved,schedule_id:9});
          return route.fulfill({status:201,json:{success:true,data:saved}});
        }
        return route.fulfill({json:{success:true,data:url.pathname==='/api/players'?players:url.pathname==='/api/matches'?matches:url.pathname==='/api/schedules'?schedules:[]}});
      }
      return route.fulfill({path:require('node:path').join(projectRoot,url.pathname==='/'?'index.html':url.pathname.slice(1))});
    });
    for(const [url,kind]of [['/','player'],['/players.html','player'],['/','match'],['/matches.html','match'],['/schedules.html','schedule']]){
      await page.goto('http://wgh.test'+url);await page.waitForFunction(()=>document.querySelector('[data-auth-panel]')?.textContent.length>0);
      const button=page.locator(`[data-wgh-create="${kind}"]`);
      assert.equal(await button.isVisible(),role==='admin');
      if(role!=='admin')continue;
      await button.click();await page.waitForSelector('dialog[open]');
      if(kind==='player'){
        await page.fill('#registerPlayerName',url==='/'?'홈 신규 선수':'목록 신규 선수');
        await page.fill('#registerNumber',url==='/'?'30':'31');await page.selectOption('#registerPosition','ALA');
        await page.locator('dialog [type=submit]').click();await page.waitForFunction(()=>!document.querySelector('dialog[open]'));
        assert.equal(saved.back_number,url==='/'?30:31);
        await page.waitForSelector(url==='/'?'#playerList a.player-item':'#playerDirectory a.player-item');
        assert.match(await page.locator(url==='/'?'#playerList':'#playerDirectory').first().textContent(),url==='/'?/홈 신규 선수/:/목록 신규 선수/);
        await button.click();await page.fill('#registerPlayerName','중복 확인');await page.fill('#registerNumber','7');await page.selectOption('#registerPosition','GK');
        await page.locator('dialog [type=submit]').click();await page.waitForFunction(()=>document.querySelector('.wgh-register-status').textContent.includes('이미 사용'));
        await page.locator('dialog [data-register-close]').first().click();
      } else if(kind==='match') {
        await page.waitForFunction(()=>!document.querySelector('dialog [type=submit]').disabled);
        assert.equal(await page.locator('dialog input[type=time]').count(),0);
        const layout=await page.locator('dialog').evaluate(dialog=>({title:dialog.querySelector('h2').textContent,labels:[...dialog.querySelectorAll('form > .form-group > label,.score-input-area label,.match-player-title')].map(node=>node.textContent.replace(/\s+/g,' ').trim()),scoreLayout:getComputedStyle(dialog.querySelector('.score-input-area')).display,width:dialog.getBoundingClientRect().width,submit:dialog.querySelector('[type=submit]').textContent.trim()}));
        if(matchLayout)assert.deepEqual(layout,matchLayout);else matchLayout=layout;
        await page.screenshot({path:'C:/Users/EZ/.codex/.chatgpt-projects/g-p-6ac594379aec8191a402e9b21ce9cc51/match-create-'+(url==='/'?'home':'list')+'.png',fullPage:true});
        await page.fill('#registerDate','2026-10-19');await page.fill('#registerOpponent','추가 경기');await page.fill('#registerOurScore','3');
        await page.locator('dialog .match-player-row [type=checkbox]').first().check();await page.locator('dialog .match-player-row [data-record=goals]').first().fill('3');
        await page.locator('dialog [type=submit]').click();await page.waitForFunction(()=>!document.querySelector('dialog[open]'));
        assert.deepEqual(saved.players,[{player_id:1,goals:3,assists:0}]);assert.equal(saved.start_time,undefined);
        await page.waitForFunction(()=>document.querySelector('#allMatchList,#matchList').textContent.includes('추가 경기'));
      } else {
        await page.fill('#registerDate','2026-10-25');await page.fill('#registerOpponent','추가 일정');await page.fill('#registerStart','2000');await page.fill('#registerEnd','2130');
        assert.equal(await page.locator('#registerStart').inputValue(),'20:00');assert.equal(await page.locator('dialog input[type=time]').count(),0);
        await page.locator('dialog [type=submit]').click();await page.waitForFunction(()=>!document.querySelector('dialog[open]'));
        assert.equal(saved.start_time,'20:00');assert.equal(saved.end_time,'21:30');
        await page.waitForFunction(()=>document.querySelector('#schedulePageList').textContent.includes('추가 일정'));
      }
    }
    assert.deepEqual(errors,[]);console.log(role+': administrator add buttons/forms, inline refresh, player duplicate feedback, player stats, match records, numeric schedule time OK');await context.close();
  }
}


async function verifyMembershipUI(browser) {
 const root=require('node:path').resolve(__dirname,'..','public');
 for(const role of ['guest','user','player','admin']) {
  const context=await browser.newContext();const page=await context.newPage();const errors=[];page.on('pageerror',error=>errors.push(error.message));
  let adminReads=0,saved=null;
  const members=[{user_id:2,name:'가입 회원',email:'member@example.test',player_id:null},{user_id:3,name:'이미 연결된 회원',email:'other@example.test',player_id:99}];
  const player={player_id:7,player_name:'기존 선수',back_number:7,position:'ALA',appearances:1,goals:1,assists:0};
  const players=[player];
  await page.route('**/*',async route=>{
   const request=route.request(),url=new URL(request.url());
   if(url.hostname!=='wgh.test')return route.fulfill({body:''});
   if(url.pathname==='/auth/me')return route.fulfill({json:{user:role==='guest'?null:{user_id:1,name:'테스트',role,player_id:role==='player'?7:null},csrf_token:'csrf'}});
   if(url.pathname==='/api/admin/members'){adminReads++;assert.equal(role,'admin');return route.fulfill({json:{success:true,data:members}});}
   if(url.pathname==='/api/admin/players/7/member'){
    assert.equal(role,'admin');assert.equal(request.headers()['x-csrf-token'],'csrf');saved=request.postDataJSON();members[0].player_id=saved.user_id==null?null:7;return route.fulfill({json:{success:true}});
   }
   if(url.pathname==='/api/players/7')return route.fulfill({json:{success:true,data:{...player,joined_at:null,matches:[]}}});
   if(url.pathname==='/api/players'){
    if(request.method()==='POST'){saved=request.postDataJSON();assert.equal(saved.member_user_id,2);assert.equal(request.headers()['x-csrf-token'],'csrf');players.push({...saved,player_id:20,appearances:0,goals:0,assists:0});return route.fulfill({status:201,json:{success:true,data:players.at(-1)}});}
    return route.fulfill({json:{success:true,data:players}});
   }
   if(url.pathname.startsWith('/api/'))return route.fulfill({json:{success:true,data:[]}});
   return route.fulfill({path:require('node:path').join(root,url.pathname==='/'?'index.html':url.pathname.slice(1))});
  });
  await page.goto('http://wgh.test/player.html?player_id=7');await page.waitForSelector('#playerDetail:not([hidden])');await page.waitForFunction(()=>document.querySelector('[data-auth-panel]')?.textContent.length>0);
  assert.equal(await page.locator('#playerMemberForm').isVisible(),role==='admin');
  if(role==='player')assert.match(await page.locator('[data-auth-panel]').textContent(),/선수 회원/);
  if(role==='admin'){
   await page.waitForFunction(()=>!document.querySelector('#savePlayerMember').disabled);
   assert.equal(await page.locator('#playerMemberSelect option').count(),2);
   await page.selectOption('#playerMemberSelect','2');await page.locator('#savePlayerMember').click();await page.waitForFunction(()=>document.querySelector('#playerMemberStatus').textContent.includes('저장했습니다'));assert.deepEqual(saved,{user_id:2});
   await page.waitForFunction(()=>!document.querySelector('#savePlayerMember').disabled);
   await page.selectOption('#playerMemberSelect','');await page.locator('#savePlayerMember').click();await page.waitForFunction(()=>document.querySelector('#playerMemberStatus').textContent.includes('해제했습니다'));assert.deepEqual(saved,{user_id:null});
   await page.goto('http://wgh.test/players.html');await page.waitForSelector('html.wgh-admin');await page.locator('[data-wgh-create=player]').click();
   await page.waitForFunction(()=>!document.querySelector('#registerMember').disabled);
   assert.equal(await page.locator('#registerMember option').count(),2);
   await page.fill('#registerPlayerName','연결 신규 선수');await page.fill('#registerNumber','30');await page.selectOption('#registerPosition','ALA');await page.selectOption('#registerMember','2');
   await page.locator('dialog [type=submit]').click();await page.waitForFunction(()=>!document.querySelector('dialog[open]'));assert.equal(saved.member_user_id,2);
  }else{assert.equal(adminReads,0);assert.equal((await page.content()).includes('member@example.test'),false);}
  assert.deepEqual(errors,[]);console.log(role+': private member choices, registration linking, existing link/unlink and player role display OK');await context.close();
 }
}
