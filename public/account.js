(() => {
 const $=id=>document.getElementById(id);let data,identity;
 const roles={admin:'관리자',player:'선수 회원',user:'일반 회원'},states={pending:'승인 대기',approved:'승인',rejected:'반려'};
 function text(tag,value){const e=document.createElement(tag);e.textContent=value??'미등록';return e;}
 async function api(path='',body){const r=await fetch('/auth/account'+path,body===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const d=await r.json();if(!r.ok)throw Error(typeof d.detail==='string'?d.detail:'요청 내용을 확인해 주세요.');return d;}
 async function action(button,work){button.disabled=true;$('accountStatus').textContent='처리 중입니다…';try{await work();window.dispatchEvent(new Event('wgh-membership-changed'));await load();$('accountStatus').textContent='반영되었습니다.';}catch(e){$('accountStatus').textContent=e.message;}finally{button.disabled=false;}}
 async function load(){
  data=await api();const p=data.profile;
  $('profilePanel').hidden=false;$('profileFields').replaceChildren();
  for(const [label,value]of [['이름',p.name],['Google 이메일',p.email],['가입일',p.joined_at],['현재 권한',roles[data.role]]])$('profileFields').append(text('dt',label),text('dd',value));
  $('linkedPlayer').replaceChildren(text('h4','연결된 선수'));
  if(p.player_id){const a=text('a',`${p.player_name} · ${p.back_number}번 · ${p.position} → 선수 상세정보`);a.href='/player.html?player_id='+p.player_id;$('linkedPlayer').append(a);}else $('linkedPlayer').append(text('p','아직 연결된 선수가 없습니다. 관리자에게 계정 연결을 요청해 주세요.'));
  const needsConsent=!data.consent;$('consentPanel').hidden=!needsConsent;
  $('consentInfo').textContent=data.consent?`이용 동의: ${data.consent.accepted_at} · 버전 ${data.consent.terms_version}`:'최초 이용 동의를 완료해 주세요.';
  $('applicationPanel').hidden=needsConsent||data.role==='admin';
  const app=data.application;$('applicationState').textContent=app?`${states[app.status]} · ${app.requested_at}${app.review_note?' · 처리 사유: '+app.review_note:''}`:'신청 후 기존 관리자의 승인을 받아야 합니다.';
  $('applicationForm').hidden=app?.status==='pending';
  $('managementPanel').hidden=needsConsent||data.role!=='admin';
  if(!needsConsent&&data.role==='admin')await management();
 }
 async function management(){
  const d=await api('/management');
  for(const id of ['requestList','adminList','historyList'])$(id).replaceChildren();
  for(const item of d.requests){const row=text('div','');row.className='account-row';row.append(text('strong',`${item.name} · ${item.email} · ${states[item.status]}`),text('p',item.reason));
   if(item.status==='pending'){const note=document.createElement('input');note.type='text';note.maxLength=1000;note.placeholder='승인 또는 반려 사유';note.setAttribute('aria-label','신청 처리 사유');row.append(note);for(const [decision,label]of [['approved','승인'],['rejected','반려']]){const b=text('button',label);b.onclick=()=>action(b,()=>api(`/requests/${item.request_id}/review`,{decision,note:note.value}));row.append(b);}}
   else row.append(text('p',item.review_note));$('requestList').append(row);
  }
  if(!d.requests.length)$('requestList').append(text('p','신청 내역이 없습니다.'));
  for(const item of d.admins){const row=text('div',`${item.name} · ${item.email}`);row.className='account-row';if(d.admins.length>1){const note=document.createElement('input');note.type='text';note.maxLength=1000;note.placeholder='권한 해제 사유';note.setAttribute('aria-label','관리자 권한 해제 사유');const b=text('button','관리자 권한 해제');b.onclick=()=>action(b,()=>api(`/admins/${item.user_id}/revoke`,{note:note.value}));row.append(note,b);}$('adminList').append(row);}
  for(const h of d.history)$('historyList').append(text('p',`${h.created_at} · ${h.name} · ${states[h.action]||'권한 해제'} · 처리: ${h.actor} · ${h.note}`));
 }
 $('acceptConsent').onclick=e=>action(e.target,async()=>{if(!$('termsConsent').checked||!$('privacyConsent').checked)throw Error('필수 항목에 모두 동의해 주세요.');await api('/consent',{terms:true,privacy:true,version:data.version});});
 $('applicationForm').onsubmit=e=>{e.preventDefault();action(e.submitter,()=>api('/requests',{reason:$('applicationReason').value}));};
 $('accountLogout').onclick=e=>action(e.target,async()=>{const r=await fetch('/auth/logout',{method:'POST'});if(!r.ok)throw Error('로그아웃에 실패했습니다.');location.href='/index.html';});
 window.WGHAuthReady.then(async value=>{identity=value;if(!identity.user){$('accountStatus').textContent='';$('loginGuide').hidden=false;return;}try{await load();$('accountStatus').textContent='';}catch(e){$('accountStatus').textContent=e.message;}});
})();
