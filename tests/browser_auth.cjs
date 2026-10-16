// Browser regression checks with mocked APIs. No real DB, Google or paid API calls.
const {chromium} = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..', 'public');
(async () => {
  const browser = await chromium.launch({headless:true,channel:'msedge'});
  try {
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
            await page.locator('#modalCloseButton').click();
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
        if (route === '/video.html') assert.equal(await page.locator('#youtubeRegisterForm').isVisible(), role === 'admin');
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
