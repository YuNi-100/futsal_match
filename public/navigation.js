/* Optional video choices shared by the existing match creation dialogs. */
window.WGHLoadMatchVideoOptions = async (select, isCurrent = () => true) => {
  if (!select) return;
  select.disabled=true;
  select.replaceChildren(new Option('영상 목록을 불러오는 중…',''));
  try {
    const response=await fetch('/api/youtube-videos');
    const result=await response.json();
    if (!response.ok || !result.success || !Array.isArray(result.data)) throw new Error('Video list unavailable');
    if (!isCurrent()) return;
    select.replaceChildren(new Option('연결 안 함 (나중에 연결 가능)',''));
    for (const video of result.data) {
      const linked=video.match_id!=null;
      const option=new Option(`${video.match_date} · ${video.title}${linked?' (다른 경기 연결됨)':''}`,String(video.video_id));
      option.disabled=linked;
      select.add(option);
    }
    select.disabled=false;
  } catch (_) {
    if (isCurrent()) select.replaceChildren(new Option('영상 조회 실패 · 연결 없이 등록 후 영상 관리에서 연결하세요',''));
  }
};

/* Shared WGH navigation; preserve URLs and authentication while using a top header. */
(() => {
  const menu=document.querySelector('.side-menu');
  if (!menu) return;
  const entries=[
    {key:'home',icon:'⌂',label:'홈',href:'/index.html'},
    {key:'matches',icon:'▣',label:'경기 기록',href:'/matches.html'},
    {key:'players',icon:'♙',label:'선수 정보',href:'/players.html'},
    {key:'schedules',icon:'▦',label:'다음 경기',href:'/schedules.html'},
    {key:'video',icon:'▶',label:'WGH TV',href:'/video.html'},
    {key:'team',icon:'♧',label:'팀 소개',href:'/index.html#team'}
  ];
  const filename=location.pathname.split('/').pop()||'index.html';
  function activeKey(){
    if(filename==='index.html') return location.hash==='#team'?'team':'home';
    return {'matches.html':'matches','match.html':'matches','players.html':'players','player.html':'players','schedules.html':'schedules','video.html':'video','video-register.html':'video','feedback-review.html':'video'}[filename];
  }
  function render(){
    const active=activeKey();
    menu.replaceChildren();
    for(const item of entries){
      const link=document.createElement('a');
      link.className='menu-item'+(item.key===active?' active':'');
      link.href=item.href;
      link.setAttribute('aria-label',item.label);
      if(item.key===active)link.setAttribute('aria-current','page');
      const icon=document.createElement('span');icon.className='menu-icon';icon.textContent=item.icon;
      const label=document.createElement('span');label.textContent=item.label;
      link.append(icon,label);menu.append(link);
    }
  }
  render();
  window.addEventListener('hashchange',render);
  const sidebar=document.querySelector('aside.sidebar');
  if(sidebar){
    document.body.classList.add('wgh-top-layout');
    if(filename==='index.html')document.body.classList.add('wgh-home');
    const header=document.createElement('header');header.className='wgh-site-header';
    const utility=document.createElement('div');utility.className='wgh-header-utility';
    const utilityInner=document.createElement('div');utilityInner.className='wgh-header-inner';
    const description=document.createElement('span');description.className='wgh-header-tagline';description.textContent='WOMEN’S FUTSAL CLUB · WE GO HIGH';utilityInner.append(description);
    const teamSettings=document.createElement('button');teamSettings.type='button';teamSettings.className='club-team-settings';teamSettings.dataset.adminOnly='';teamSettings.dataset.wghTeamSettings='';teamSettings.textContent='팀명 변경';utilityInner.append(teamSettings);
    const authPanel=sidebar.querySelector('[data-auth-panel]');if(authPanel)utilityInner.append(authPanel);utility.append(utilityInner);
    const bar=document.createElement('div');bar.className='wgh-header-main';
    const home=document.createElement('a');home.href='/index.html';home.className='wgh-brand-home';home.setAttribute('aria-label','WGH 홈');
    const logo=sidebar.querySelector('.team-logo');if(logo){logo.querySelector('h1').textContent='WE GO HIGH';home.append(logo);}
    const toggle=document.createElement('button');toggle.type='button';toggle.className='wgh-menu-toggle';toggle.textContent='메뉴';toggle.setAttribute('aria-expanded','false');toggle.setAttribute('aria-controls','wghMainNavigation');
    menu.id='wghMainNavigation';menu.setAttribute('aria-label','주 메뉴');
    function closeMenu(){header.classList.remove('wgh-nav-open');toggle.setAttribute('aria-expanded','false');}
    toggle.addEventListener('click',()=>{const opened=header.classList.toggle('wgh-nav-open');toggle.setAttribute('aria-expanded',String(opened));});
    menu.addEventListener('click',event=>{if(event.target.closest('a'))closeMenu();});
    document.addEventListener('keydown',event=>{if(event.key==='Escape'&&header.classList.contains('wgh-nav-open')){closeMenu();toggle.focus();}});
    bar.append(home,toggle,menu);header.append(utility,bar);sidebar.replaceWith(header);
  }
})();

/* Shared creation dialogs in the existing navigation script. */
(() => {
  let busy=false;
  const field=(id,label,type='text',extra='')=>`<div class="form-group"><label for="${id}">${label}</label><input id="${id}" name="${id}" type="${type}" ${extra}></div>`;
  const today=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
  const matchFields=record=>JSON.stringify([String(record.match_date||'').slice(0,10),String(record.opponent||'').trim(),Number(record.our_score),Number(record.opponent_score),String(record.location||'').trim(),String(record.memo||'')]);
  const playerRecords=records=>JSON.stringify(records.map(record=>({player_id:Number(record.player_id),goals:Number(record.goals||0),assists:Number(record.assists||0)})).sort((a,b)=>a.player_id-b.player_id));

  async function homeMatchMarkup() {
    let source = document.querySelector('#matchModal .modal-content');
    if (!source) {
      const response = await fetch('/index.html', {cache:'no-cache'});
      if (!response.ok) throw new Error('경기 등록창을 불러오지 못했습니다. 다시 시도해 주세요.');
      const page = new DOMParser().parseFromString(await response.text(),'text/html');
      source = page.querySelector('#matchModal .modal-content');
    }
    if (!source) throw new Error('경기 등록창을 찾을 수 없습니다.');
    const content = source.cloneNode(true);
    const ids = {matchForm:'sharedMatchForm',matchDate:'registerDate',opponent:'registerOpponent',location:'registerLocation',ourScore:'registerOurScore',opponentScore:'registerTheirScore',memo:'registerMemo',matchPlayerList:'registerPlayers',matchVideoSelect:'registerVideo',modalCloseButton:'sharedMatchClose',cancelButton:'sharedMatchCancel'};
    content.querySelectorAll('[id]').forEach(element=>{if(ids[element.id])element.id=ids[element.id];});
    content.querySelectorAll('label[for]').forEach(label=>{const old=label.htmlFor;if(ids[old])label.htmlFor=ids[old];});
    content.querySelector('h2').id='registrationTitle';
    content.querySelector('#sharedMatchClose').dataset.registerClose='';
    content.querySelector('#sharedMatchCancel').dataset.registerClose='';
    const players=content.querySelector('#registerPlayers');
    players.replaceChildren();
    const loading=document.createElement('p');loading.id='registerPlayerStatus';loading.className='match-player-loading';loading.textContent='선수 목록을 불러오는 중입니다…';players.append(loading);
    const status=document.createElement('p');status.className='wgh-register-status';status.setAttribute('role','status');
    content.querySelector('form').insertBefore(status,content.querySelector('.modal-actions'));
    return content.outerHTML;
  }

  document.addEventListener('click',async event=>{
    const trigger=event.target.closest('[data-wgh-create]');
    if(!trigger||!document.documentElement.classList.contains('wgh-admin')||busy)return;
    const kind=trigger.dataset.wghCreate;
    if(!['player','match','schedule'].includes(kind))return;
    if(document.querySelector('.wgh-register-dialog[open],.club-dialog[open]'))return;
    let editing=trigger.dataset.recordEdit?JSON.parse(trigger.dataset.recordEdit):(kind==='schedule'&&trigger.dataset.scheduleEdit?JSON.parse(trigger.dataset.scheduleEdit):null);
    const title=editing?{schedule:'다음 일정 수정',match:'경기 기록 수정',player:'선수 정보 수정'}[kind]:{player:'선수 등록',match:'경기 기록 추가',schedule:'다음 일정 추가'}[kind];
    const dialog=document.createElement('dialog');dialog.className='wgh-register-dialog'+(kind==='match'?' wgh-match-dialog':'');dialog.setAttribute('aria-labelledby','registrationTitle');
    let fields='';
    if(kind==='match') {
      busy=true;
      try {
        if(editing){
          const response=await fetch('/api/matches/'+encodeURIComponent(editing.match_id));const result=await response.json();
          if(!response.ok||!result.success)throw new Error('기존 경기 정보를 불러오지 못했습니다. 다시 열어 주세요.');
          editing=result.data;
        }
        dialog.innerHTML=await homeMatchMarkup();
      }
      catch(error) { alert(error.message); return; }
      finally { busy=false; }
    } else if(kind==='player'){
      fields=field('registerPlayerName','선수 이름 *','text','required maxlength="50"')+field('registerNumber','등번호 *','number','required min="0" step="1"')+
      '<div class="form-group"><label for="registerPosition">포지션 *</label><select id="registerPosition" required><option value="">선택하세요</option><option value="GK">GK · 골키퍼</option><option value="FIXO">FIXO · 픽소</option><option value="ALA">ALA · 아라</option><option value="PIVO">PIVO · 피보</option></select></div>'+field('registerJoined','입단일','date')+'<div class="form-group"><label for="registerMember">연결할 Google 가입 회원 (선택)</label><select id="registerMember" disabled><option value="">회원 목록을 불러오는 중…</option></select><small>아직 가입하지 않았다면 연결 없이 등록하고 나중에 연결할 수 있습니다.</small></div>';
    }else{
      fields=field('registerDate','경기 날짜 *','date','required')+field('registerOpponent','상대팀 *','text','required maxlength="100"')+field('registerLocation','장소','text','maxlength="100"');
      if(kind==='schedule')fields+='<div class="form-group"><label for="registerStart">시작 시간 *</label><input id="registerStart" type="text" inputmode="numeric" maxlength="5" placeholder="20:00" required></div><div class="form-group"><label for="registerEnd">종료 시간 *</label><input id="registerEnd" type="text" inputmode="numeric" maxlength="5" placeholder="21:30" required></div>';
      if(kind==='match')fields+=field('registerOurScore','WGH 득점 *','number','required min="0" step="1" value="0"')+field('registerTheirScore','상대팀 득점 *','number','required min="0" step="1" value="0"');
      fields+='<div class="form-group"><label for="registerMemo">메모</label><textarea id="registerMemo" rows="3"></textarea></div>';
      if(kind==='match')fields+='<fieldset class="wgh-register-players"><legend>참가 선수 · 득점 · 도움</legend><p id="registerPlayerStatus">선수 목록을 불러오는 중입니다…</p><div id="registerPlayers"></div></fieldset>';
    }
    if(kind!=='match') dialog.innerHTML=`<div class="wgh-register-header"><h2 id="registrationTitle">${title}</h2><button type="button" data-register-close aria-label="닫기">×</button></div><form>${fields}<p class="wgh-register-status" role="status"></p><div class="modal-actions"><button type="button" class="cancel-button" data-register-close>취소</button><button type="submit" class="save-match-button">저장</button></div></form>`;
    document.body.append(dialog);
    dialog.querySelectorAll('[data-team-name]').forEach(element=>{element.textContent=window.WGHClub.teamName;});
    const form=dialog.querySelector('form');form.reset();const status=dialog.querySelector('[role=status]');const submit=form.querySelector('[type=submit]');
    const get=id=>dialog.querySelector('#'+id);
    let saving=false,stale=false,playersReady=kind!=='match',membersReady=kind!=='player'||Boolean(editing);
    const close=()=>{if(!saving)dialog.close();};
    dialog.querySelectorAll('[data-register-close]').forEach(button=>button.addEventListener('click',close));
    dialog.addEventListener('cancel',e=>{if(saving)e.preventDefault();});
    dialog.addEventListener('close',()=>{dialog.remove();trigger.focus();},{once:true});
    dialog.showModal();
    const leaguePicker=kind==='match'?window.WGHClub.mountLeaguePicker(form,form.firstElementChild,{current:editing,atomicNewMatch:!editing}):null;
    if(kind!=='player')get('registerDate').value=today();
    if(editing&&kind==='schedule'){
      for(const [id,key] of [['registerDate','match_date'],['registerOpponent','opponent'],['registerLocation','location'],['registerMemo','memo']])get(id).value=editing[key]||'';
      get('registerStart').value=String(editing.start_time||'').slice(0,5);get('registerEnd').value=String(editing.end_time||'').slice(0,5);
    }
    if(editing&&kind==='match'){
      for(const [id,key] of [['registerDate','match_date'],['registerOpponent','opponent'],['registerLocation','location'],['registerMemo','memo'],['registerOurScore','our_score'],['registerTheirScore','opponent_score']])get(id).value=editing[key]??'';
      dialog.querySelector('h2').textContent=title;
      get('registerVideo').closest('.form-group').hidden=true;
    }
    if(editing&&kind==='player'){
      get('registerMember').closest('.form-group').hidden=true;
      get('registerPlayerName').value=editing.player_name;get('registerNumber').value=editing.back_number;get('registerPosition').value=editing.position;
      submit.disabled=true;membersReady=false;
      try{
        const response=await fetch('/api/players/'+encodeURIComponent(editing.player_id));const result=await response.json();
        if(!response.ok||!result.success)throw new Error('선수 정보를 불러오지 못했습니다. 창을 닫고 다시 열어 주세요.');
        if(!dialog.isConnected)return;
        get('registerPlayerName').value=result.data.player_name;get('registerNumber').value=result.data.back_number;get('registerPosition').value=result.data.position;get('registerJoined').value=result.data.joined_at||'';
        membersReady=true;submit.disabled=false;
      }catch(error){status.textContent=error.message;}
    }
    if(kind==='schedule')for(const id of ['registerStart','registerEnd'])get(id).addEventListener('input',()=>{const digits=get(id).value.replace(/\D/g,'');if(digits.length===4)get(id).value=digits.slice(0,2)+':'+digits.slice(2);});
    if(kind==='match'){
      submit.disabled=true;
      try{
        const response=await fetch('/api/players');const result=await response.json();
        if(!response.ok||!result.success||!Array.isArray(result.data))throw new Error('선수 목록을 불러오지 못했습니다. 창을 닫고 다시 열어주세요.');
        if(!dialog.isConnected)return;
        let saved=[];
        if(editing){
          if(!Array.isArray(editing.players))throw new Error('기존 선수 기록을 불러오지 못했습니다. 저장하지 말고 다시 열어 주세요.');
          saved=editing.players;
          const ids=new Set(result.data.map(player=>Number(player.player_id)));
          if(saved.some(record=>!ids.has(Number(record.player_id))))throw new Error('선수 정보가 변경되었습니다. 창을 닫고 다시 열어 주세요.');
        }
        for(const player of result.data){
          const row=document.createElement('div');row.className='match-player-row';
          const label=document.createElement('label');label.className='match-player-check';
          const checkbox=document.createElement('input');checkbox.type='checkbox';checkbox.value=player.player_id;checkbox.className='match-player-checkbox';
          const number=document.createElement('span');number.className='match-player-number';number.textContent=player.back_number;
          const name=document.createElement('strong');name.className='match-player-name';name.textContent=player.player_name;
          label.append(checkbox,number,name);row.append(label);
          for(const [name,text]of [['goals','득점'],['assists','도움']]){
            const wrap=document.createElement('label');wrap.className='match-player-record';
            const caption=document.createElement('span');caption.textContent=text;
            const input=document.createElement('input');input.type='number';input.min='0';input.step='1';input.value='0';input.disabled=true;input.dataset.record=name;input.className=name==='goals'?'match-player-goals':'match-player-assists';
            wrap.append(caption,input);row.append(wrap);
          }
          checkbox.addEventListener('change',()=>row.querySelectorAll('[data-record]').forEach(input=>{input.disabled=!checkbox.checked;if(!checkbox.checked)input.value='0';}));
          const record=saved.find(record=>Number(record.player_id)===Number(player.player_id));
          if(record){checkbox.checked=true;for(const key of ['goals','assists']){const input=row.querySelector('[data-record='+key+']');input.disabled=false;input.value=record[key];}}
          get('registerPlayers').append(row);
        }
        get('registerPlayerStatus').textContent=result.data.length?'':'등록된 선수가 없습니다.';
        get('registerPlayerStatus').hidden=result.data.length>0;
        await leaguePicker.ready;
        if(!editing)await window.WGHLoadMatchVideoOptions(get('registerVideo'),()=>dialog.isConnected);
        if(!dialog.isConnected)return;
        playersReady=true;submit.disabled=false;
      }catch(error){if(dialog.isConnected)status.textContent=error.message;}
    }
    if(kind==='player'&&!editing) {
      submit.disabled=true;
      try {
        const response=await fetch('/api/admin/members',{cache:'no-store'});const result=await response.json();
        if(!response.ok || !result.success || !Array.isArray(result.data))throw new Error('회원 목록을 불러오지 못했습니다. 창을 닫고 다시 열어주세요.');
        if(!dialog.isConnected)return;
        const select=get('registerMember');select.replaceChildren(new Option('연결 안 함 (나중에 연결)',''));
        for(const member of result.data)if(member.player_id==null)select.add(new Option(`${member.name} · ${member.email}`,String(member.user_id)));
        select.disabled=false;membersReady=true;submit.disabled=false;
      }catch(error){if(dialog.isConnected)status.textContent=error.message;}
    }
    form.addEventListener('submit',async event=>{
      event.preventDefault();if(saving||stale||!playersReady||!membersReady||leaguePicker?.busy)return;
      if(!document.documentElement.classList.contains('wgh-admin')){status.textContent='관리자 로그인을 확인해 주세요.';return;}
      let payload,url,method=editing?'PUT':'POST';
      if(kind==='player'){
        payload={player_name:get('registerPlayerName').value.trim(),back_number:Number(get('registerNumber').value),position:get('registerPosition').value,joined_at:get('registerJoined').value||null,member_user_id:get('registerMember').value?Number(get('registerMember').value):null};url=editing?'/api/players/'+encodeURIComponent(editing.player_id):'/api/players';
        if(editing)delete payload.member_user_id;
        if(!payload.player_name){status.textContent='선수 이름을 입력해 주세요.';return;}
      }else{
        payload={match_date:get('registerDate').value,opponent:get('registerOpponent').value.trim(),location:get('registerLocation').value.trim(),memo:get('registerMemo').value};
        if(!payload.opponent){status.textContent='상대팀 이름을 입력해 주세요.';return;}
        if(kind==='schedule'){
          const normalize=value=>/^\d{4}$/.test(value)?value.slice(0,2)+':'+value.slice(2):value;
          const start=normalize(get('registerStart').value),end=normalize(get('registerEnd').value);const pattern=/^([01]\d|2[0-3]):[0-5]\d$/;
          if(!pattern.test(start)||!pattern.test(end)||end<=start){status.textContent='시작·종료 시간을 24시간 형식으로 확인해 주세요. 종료 시간은 시작 시간보다 늦어야 합니다.';return;}
          Object.assign(payload,{start_time:start,end_time:end});url=editing?'/api/schedules/'+encodeURIComponent(editing.schedule_id):'/api/schedules';
        }else{
          let leagueSelection;
          try{leagueSelection=leaguePicker.value();}catch(error){status.textContent=error.message;return;}
          if(!editing){
            Object.assign(payload,leagueSelection);
            payload.video_id=get('registerVideo').value?Number(get('registerVideo').value):null;
          }
          Object.assign(payload,{our_score:Number(get('registerOurScore').value),opponent_score:Number(get('registerTheirScore').value),players:[...get('registerPlayers').children].filter(row=>row.querySelector('[type=checkbox]')?.checked).map(row=>({player_id:Number(row.querySelector('[type=checkbox]').value),goals:Number(row.querySelector('[data-record=goals]').value),assists:Number(row.querySelector('[data-record=assists]').value)}))});url=editing?'/api/matches/'+encodeURIComponent(editing.match_id):'/api/matches';
          if(editing){
            // Preserve stored NULLs/spacing when these inputs were not actually edited.
            if(payload.location===String(editing.location||'').trim())payload.location=editing.location??null;
            if(payload.memo===String(editing.memo||''))payload.memo=editing.memo??null;
            if(payload.opponent===String(editing.opponent||'').trim())payload.opponent=editing.opponent;
            const fieldsChanged=matchFields(payload)!==matchFields(editing);
            const playersChanged=playerRecords(payload.players)!==playerRecords(editing.players);
            const leagueChanged=leagueSelection.league_id!==(editing.league_id??null);
            if(!fieldsChanged&&!playersChanged){
              if(!leagueChanged){dialog.close();return;}
              // Same form and one Save button; metadata-only edits still use the safe endpoint.
              url+='/league';method='PATCH';
              payload={league_id:leagueSelection.league_id,expected_league_id:editing.league_id??null};
            }else{
              if(!playersChanged)delete payload.players;
              // Mixed edits are committed together; never issue two partially successful saves.
              if(leagueChanged)Object.assign(payload,{league_id:leagueSelection.league_id,expected_league_id:editing.league_id??null});
            }
          }
        }
      }
      saving=true;busy=true;submit.disabled=true;status.textContent='저장 중입니다…';
      try{
        const response=await fetch(url,{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});const result=await response.json();
        if(response.status===409&&kind==='match'&&editing&&typeof result.detail==='string'&&result.detail.includes('다른 창'))stale=true;
        if(!response.ok||result.success===false)throw new Error(typeof result.detail==='string'?result.detail:'입력값을 확인해 주세요.');
        window.dispatchEvent(new CustomEvent('wgh-record-created',{detail:{kind,data:result.data}}));
        if(kind==='player')window.dispatchEvent(new Event('wgh-membership-changed'));
        saving=false;dialog.close();
      }catch(error){status.textContent=error.message;}
      finally{saving=false;busy=false;if(dialog.isConnected)submit.disabled=stale;}
    });
  });
})();

/* Original brand images and Instagram links supplied by the WGH owner. */
(() => {
  const main=document.querySelector('main.main-content');
  if(!main||document.getElementById('wghBrandFooter'))return;
  const channels=[
    {name:'위고하이 오피셜',handle:'wegohigh_official',image:'wegohigh-official.png'},
    {name:'여자풋살클럽 위고하이',handle:'wghfutsal',image:'wgh-futsal.png'},
    {name:'위필드',handle:'wefield_official',image:'wefield-official.png'},
    {name:'위고하이 은평',handle:'wgh.eunpyeong',image:'wgh-eunpyeong.png'}
  ];
  const footer=document.createElement('footer');footer.id='wghBrandFooter';footer.className='wgh-brand-footer';
  footer.setAttribute('aria-labelledby','wghBrandFooterTitle');
  const heading=document.createElement('h2');heading.id='wghBrandFooterTitle';heading.textContent='WGH 공식 채널';
  const links=document.createElement('div');links.className='wgh-brand-links';
  for(const channel of channels){
    const link=document.createElement('a');link.href='https://www.instagram.com/'+channel.handle+'/';link.target='_blank';link.rel='noopener noreferrer';link.className='wgh-brand-link';link.setAttribute('aria-label',channel.name+' 인스타그램 (새 탭)');
    const image=document.createElement('img');image.src='/images/brands/'+channel.image;image.alt=channel.name+' 로고';image.width=88;image.height=88;image.loading='lazy';
    const name=document.createElement('strong');name.textContent=channel.name;
    const handle=document.createElement('span');handle.textContent='@'+channel.handle;
    link.append(image,name,handle);links.append(link);
  }
  footer.append(heading,links);main.append(footer);
})();

/* Admin controls shared by record lists and detail pages. */
window.WGHRecordActions=(kind,record,afterDelete)=>{
  const bar=document.createElement('div');bar.className='wgh-record-actions match-actions';bar.dataset.adminOnly='';
  const edit=document.createElement('button');edit.type='button';edit.className='wgh-record-edit';edit.textContent='수정';edit.dataset.wghCreate=kind;edit.dataset.recordEdit=JSON.stringify(record);
  const remove=document.createElement('button');remove.type='button';remove.className='wgh-record-delete';remove.textContent='삭제';
  remove.addEventListener('click',async event=>{
    event.preventDefault();event.stopPropagation();
    if(!document.documentElement.classList.contains('wgh-admin')||remove.disabled)return;
    const message=kind==='match'?'이 경기 기록과 해당 경기의 선수 득점·도움 기록을 삭제하시겠습니까? 연결 영상은 유지됩니다.':'이 선수를 삭제하시겠습니까? 출전 기록이나 회원 연결이 있는 선수는 삭제할 수 없습니다.';
    if(!confirm(message))return;
    remove.disabled=true;
    try{
      const id=kind==='match'?record.match_id:record.player_id;
      const response=await fetch('/api/'+(kind==='match'?'matches':'players')+'/'+encodeURIComponent(id),{method:'DELETE'});const result=await response.json();
      if(!response.ok||result.success===false)throw new Error(typeof result.detail==='string'?result.detail:'삭제하지 못했습니다. 다시 확인해 주세요.');
      if(afterDelete)await afterDelete();
    }catch(error){alert(error.message);}finally{remove.disabled=false;}
  });
  bar.append(edit);
  bar.append(remove);return bar;
};
