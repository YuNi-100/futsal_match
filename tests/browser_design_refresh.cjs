const {chromium}=require('playwright');const fs=require('node:fs');const path=require('node:path');const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..','public');const fixtures=JSON.parse(fs.readFileSync(path.join(root,'..','.wgh-sync','design-fixtures.json'),'utf8'));
const output='C:/Users/EZ/.codex/.chatgpt-projects/g-p-6ac594379aec8191a402e9b21ce9cc51';
const firstMatch=fixtures['/api/matches'].data[0].match_id;const firstPlayer=fixtures['/api/players'].data[0].player_id;
const routes=['index.html','matches.html','players.html','schedules.html',`match.html?match_id=${firstMatch}`,`player.html?player_id=${firstPlayer}`,'video.html','video.html?video_id=9&tab=analysis','video-register.html','feedback-review.html?analysis_id=1','account.html'];
(async()=>{const browser=await chromium.launch({headless:true,channel:'msedge'});try{
 const context=await browser.newContext();let mutations=0;const errors=[];
 context.on('page',page=>page.on('pageerror',error=>errors.push(error.message)));
 await context.route('**/*',async route=>{const req=route.request(),u=new URL(req.url());if(u.hostname!=='wgh.test'){if(u.hostname==='i.ytimg.com'&&process.argv.includes('--preview'))return route.continue();return route.fulfill({body:''});}
  if(!['GET','HEAD'].includes(req.method())){mutations++;throw Error('Unexpected mutation in read-only visual test: '+u.pathname);}
  if(u.pathname==='/auth/me')return route.fulfill({json:{user:{user_id:1,name:'정세윤',role:'admin'},csrf_token:'csrf'}});
  if(u.pathname==='/auth/account')return route.fulfill({json:{profile:{name:'관리자',email:'test@example.invalid',joined_at:'2026-10-01'},role:'admin',consent:{accepted_at:'2026-10-01',terms_version:'1'},application:null}});
  if(u.pathname==='/auth/account/management')return route.fulfill({json:{requests:[],admins:[],history:[]}});
  if(u.pathname==='/api/admin/members')return route.fulfill({json:{success:true,data:[]}});
  if(fixtures[u.pathname])return route.fulfill({json:fixtures[u.pathname]});
  if(u.pathname.startsWith('/api/'))throw Error('Missing read-only API fixture: '+u.pathname);
  return route.fulfill({path:path.join(root,u.pathname==='/'?'index.html':u.pathname.slice(1))});
 });
 const page=await context.newPage();const failures=[];
 for(const width of (process.argv.includes('--preview')?[1440,390]:[1440,1024,768,390,360])){
  await page.setViewportSize({width,height:1000});
  for(const url of (process.argv.includes('--preview')?['index.html','video.html']:routes)){
   await page.goto('http://wgh.test/'+url);await page.waitForSelector('.wgh-site-header');
   await page.waitForFunction(()=>!document.body.innerText.includes('경기 기록을 불러오는 중...'));
   assert.equal(await page.locator('aside.sidebar').count(),0);
   assert.equal(await page.locator('.wgh-site-header .menu-item').count(),6);
   assert.equal(await page.locator('#wghBrandFooter a').count(),4);
   const footerLinks=await page.locator('#wghBrandFooter a').evaluateAll(items=>items.map(item=>item.href));
   assert.deepEqual(footerLinks,['https://www.instagram.com/wegohigh_official/','https://www.instagram.com/wghfutsal/','https://www.instagram.com/wefield_official/','https://www.instagram.com/wgh.eunpyeong/']);
   if(width<=700){await page.locator('.wgh-menu-toggle').click();assert.equal(await page.locator('.side-menu').isVisible(),true);await page.keyboard.press('Escape');assert.equal(await page.locator('.side-menu').isVisible(),false);}
   if(url==='index.html'){
    await page.waitForSelector('#playerList .player-item');await page.waitForSelector('#matchList .match-card');
    const order=await page.locator('main > section').evaluateAll(nodes=>nodes.map(node=>node.className));
    assert.deepEqual(order,['hero','stats-section','match-section','bottom-grid','player-section']);
    assert.equal(await page.locator('#totalMatches').textContent(),String(fixtures['/api/matches'].data.length));
    assert.equal(await page.locator('#playerList .player-item').count(),fixtures['/api/players'].data.length);
    assert.match(await page.locator('#playerList .player-item').first().getAttribute('href'),/player_id=/);
    const clip=await page.locator('#playerList .player-number').first().evaluate(node=>getComputedStyle(node).clipPath);assert.match(clip,/polygon/);
   }
   if(url==='video.html'){
    await page.waitForSelector('.wgh-tv-card');assert.equal(await page.locator('.wgh-tv-card').count(),fixtures['/api/youtube-videos'].data.length);
    assert.equal(await page.locator('#tvPlaybackPanel').isVisible(),false);
    await page.locator('.wgh-tv-card').first().click();assert.equal(await page.locator('#fullPlayer').isVisible(),true);
    await page.locator('#tvClosePlayer').click();assert.equal(await page.locator('#tvPlaybackPanel').isVisible(),false);
   }
   if(url.startsWith('feedback-review'))await page.waitForSelector('.review-row');
   const overflow=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,offenders:[...document.querySelectorAll('body *')].filter(node=>node.getBoundingClientRect().right>innerWidth+1&&getComputedStyle(node).position!=='fixed').slice(0,12).map(node=>node.tagName+'.'+node.className)}));
   if(overflow.scroll>width+1)failures.push({url,width,...overflow});
   if([1440,390].includes(width)&&['index.html','video.html','players.html','feedback-review.html?analysis_id=1'].includes(url)){
    await page.locator('#wghBrandFooter').scrollIntoViewIfNeeded();await page.waitForFunction(()=>[...document.querySelectorAll('#wghBrandFooter img')].every(img=>img.complete&&img.naturalWidth>0));await page.evaluate(()=>scrollTo(0,0));
    if(url==='video.html'&&process.argv.includes('--preview'))await page.waitForFunction(()=>[...document.querySelectorAll('.tv-card-thumbnail img')].every(img=>img.complete));
    if(url==='index.html'&&width===1440)await page.screenshot({path:path.join(output,'wgh-refresh-home-preview.png'),fullPage:false});
    const name=url.split('.')[0]+'-'+width;await page.screenshot({path:path.join(output,'wgh-refresh-'+name+'.png'),fullPage:true});
   }
  }
  console.log('CHECKED:',width,'px ·',process.argv.includes('--preview')?2:routes.length,'pages');
 }
 console.log('LAYOUT_FAILURES:',JSON.stringify(failures));assert.deepEqual(failures,[]);assert.deepEqual(errors,[]);assert.equal(mutations,0);
 console.log('PASS: original data, top navigation and mobile toggle, jersey numbers, TV selection/close, footer links, '+(process.argv.includes('--preview')?4:55)+' responsive views, no database writes');
}finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
