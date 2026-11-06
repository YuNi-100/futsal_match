const {chromium}=require('playwright');
const fs=require('node:fs');const path=require('node:path');const assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({headless:true,channel:'msedge'});try{
for(const scenario of ['guest','consent','user','admin','mobile']){
const context=await browser.newContext({viewport:scenario==='mobile'?{width:390,height:844}:{width:1366,height:900}});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
let accepted=scenario!=='consent',submitted=false,reviewed=false;const role=['admin','mobile'].includes(scenario)?'admin':'user';
await page.route('http://wgh.test/**',async route=>{const req=route.request(),url=new URL(req.url());
if(url.pathname==='/auth/me')return route.fulfill({json:{user:scenario==='guest'?null:{user_id:1,name:'테스트 회원',role,consent_required:!accepted},csrf_token:'csrf'}});
if(url.pathname==='/auth/account')return route.fulfill({json:{profile:{name:'테스트 회원',email:'member@example.test',joined_at:'2026-10-19',player_id:7,player_name:'연결 선수',back_number:7,position:'ALA'},role,consent:accepted?{accepted_at:'2026-10-19',terms_version:'2026-10-19'}:null,version:'2026-10-19',application:submitted?{status:'pending',requested_at:'2026-10-19'}:null}});
if(url.pathname==='/auth/account/management')return route.fulfill({json:{requests:[{request_id:2,user_id:2,name:'신청 회원',email:'applicant@example.test',reason:'팀 기록 관리',status:reviewed?'approved':'pending',review_note:reviewed?'확인 완료':null}],admins:[{user_id:1,name:'관리자',email:'admin@example.test'},{user_id:3,name:'운영진',email:'staff@example.test'}],history:reviewed?[{created_at:'2026-10-19',name:'신청 회원',action:'approved',actor:'관리자',reason:'팀 기록 관리',note:'확인 완료'}]:[]}});
if(req.method()==='POST'){assert.equal(req.headers()['x-csrf-token'],'csrf');if(url.pathname.endsWith('/consent'))accepted=true;if(url.pathname.endsWith('/requests'))submitted=true;if(url.pathname.endsWith('/review'))reviewed=true;return route.fulfill({json:{success:true}});}
const file=path.join(__dirname,'..','public',url.pathname.slice(1));if(fs.existsSync(file))return route.fulfill({path:file});return route.fulfill({status:404,body:''});});
await page.goto('http://wgh.test/account.html');
if(scenario==='guest'){await page.locator('#loginGuide:not([hidden])').waitFor();assert.equal(await page.locator('#profilePanel').isVisible(),false);}
else{await page.locator('#profilePanel:not([hidden])').waitFor();assert.match(await page.locator('#profileFields').textContent(),/member@example.test/);assert.equal(await page.locator('#linkedPlayer a').getAttribute('href'),'/player.html?player_id=7');
if(scenario==='consent'){await page.locator('#termsConsent').check();await page.locator('#privacyConsent').check();await page.locator('#acceptConsent').click();await page.locator('#consentPanel[hidden]').waitFor({state:'attached'});assert.equal(accepted,true);}
if(scenario==='user'){await page.locator('#applicationReason').fill('운영 지원');await page.locator('#applicationForm button').click();await page.locator('#applicationForm[hidden]').waitFor({state:'attached'});assert.equal(submitted,true);}
if(role==='admin')await page.locator('#managementPanel > summary').click();
if(scenario==='admin'){await page.locator('#requestList input').fill('확인 완료');await page.getByRole('button',{name:'승인',exact:true}).click();await page.getByText('대기 중인 권한 신청이 없습니다.').waitFor();assert.equal(reviewed,true);
await page.getByText('최근 처리 이력',{exact:true}).click();
await page.locator('#historyList').getByText('신청 사유 팀 기록 관리',{exact:true}).waitFor();
await page.locator('#historyList').getByText('처리 사유 확인 완료',{exact:true}).waitFor();
assert.equal(await page.locator('#adminList input:visible').count(),0);
await page.locator('#adminList button').first().click();
assert.equal(await page.locator('#adminList input:visible').count(),1);}
if(scenario==='mobile')assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
}
assert.deepEqual(errors,[]);await context.close();console.log('Account UI passed: '+scenario);
}
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1)});
