window.WGHAuthReady.then(async identity=>{
 const el=id=>document.getElementById(id),text=(tag,value)=>{const n=document.createElement(tag);n.textContent=value;return n;};
 if(!identity.user)return;
 async function api(path='',body){const r=await fetch('/auth/video-access'+path,body===undefined?{cache:'no-store'}:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const data=await r.json();if(!r.ok)throw Error(typeof data.detail==='string'?data.detail:'처리하지 못했습니다.');return data;}
 async function load(){
  el('videoAccessPanel').hidden=false;
  try{const own=await api();el('videoAccessState').textContent=own.approved?'영상 이용 승인 완료':'영상 이용 승인 대기 · 관리자 승인 후 영상·분석·댓글을 이용할 수 있습니다.';
   el('videoMemberManagement').hidden=!own.is_admin||identity.user.consent_required;
   if(!own.is_admin||identity.user.consent_required)return;
   const data=await api('/members');el('videoMemberList').replaceChildren();
   const pending=data.members.filter(m=>!m.approved).length;el('videoMemberCount').textContent='승인 대기 '+pending+'명 · 전체 '+data.members.length+'명';
   for(const item of data.members){const row=text('div','');row.className='account-row';row.append(text('strong',item.name+' · '+(item.is_admin?'관리자':item.approved?'승인 완료':'승인 대기')),text('small',item.email));
    if(!item.is_admin){const button=text('button',item.approved?'승인 취소':'영상 이용 승인');button.type='button';button.addEventListener('click',async()=>{if(!confirm(item.name+'님의 영상 이용을 '+(item.approved?'승인 취소':'승인')+'할까요?'))return;button.disabled=true;try{await api('/members/'+item.user_id,{approved:!item.approved,revision:item.revision});await load();}catch(e){el('videoMemberMessage').textContent=e.message;button.disabled=false;}});row.append(button);}el('videoMemberList').append(row);
   }
   if(!data.members.length)el('videoMemberList').append(text('p','가입 회원이 없습니다.'));
  }catch(e){el('videoAccessState').textContent=e.message;}
 }
 el('videoMemberReload').addEventListener('click',load);window.addEventListener('wgh-membership-changed',load);load();
});
