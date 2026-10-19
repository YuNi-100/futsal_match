/* Shared WGH sidebar. Change labels and URLs here instead of editing every page. */
(() => {
  const menu=document.querySelector('.side-menu');
  if (!menu) return;
  const entries=[
    {key:'home',icon:'⌂',label:'홈',href:'/index.html'},
    {key:'matches',icon:'▣',label:'경기 기록',href:'/matches.html'},
    {key:'players',icon:'♙',label:'선수 정보',href:'/players.html'},
    {key:'schedules',icon:'▦',label:'다음 경기',href:'/schedules.html'},
    {key:'team',icon:'♧',label:'팀 소개',href:'/index.html#team'},
    {key:'video',icon:'▶',label:'경기 영상',href:'/video.html'}
  ];
  const filename=location.pathname.split('/').pop()||'index.html';
  function activeKey(){
    if(filename==='index.html') return location.hash==='#team'?'team':'home';
    return {'matches.html':'matches','match.html':'matches','players.html':'players','player.html':'players','schedules.html':'schedules','video.html':'video'}[filename];
  }
  function render(){
    const active=activeKey();
    menu.replaceChildren();
    for(const item of entries){
      const link=document.createElement('a');
      link.className='menu-item'+(item.key===active?' active':'');
      link.href=item.href;
      if(item.key===active)link.setAttribute('aria-current','page');
      const icon=document.createElement('span');icon.className='menu-icon';icon.textContent=item.icon;
      const label=document.createElement('span');label.textContent=item.label;
      link.append(icon,label);menu.append(link);
    }
  }
  render();
  window.addEventListener('hashchange',render);
})();

/* Shared creation dialogs in the existing navigation script. */
(() => {
  let busy=false;
  const field=(id,label,type='text',extra='')=>`<div class="form-group"><label for="${id}">${label}</label><input id="${id}" name="${id}" type="${type}" ${extra}></div>`;
  const today=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};

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
    const ids = {matchForm:'sharedMatchForm',matchDate:'registerDate',opponent:'registerOpponent',location:'registerLocation',ourScore:'registerOurScore',opponentScore:'registerTheirScore',memo:'registerMemo',matchPlayerList:'registerPlayers',modalCloseButton:'sharedMatchClose',cancelButton:'sharedMatchCancel'};
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
    if(document.querySelector('.wgh-register-dialog[open]'))return;
    const title={player:'선수 등록',match:'경기 기록 추가',schedule:'다음 일정 추가'}[kind];
    const dialog=document.createElement('dialog');dialog.className='wgh-register-dialog'+(kind==='match'?' wgh-match-dialog':'');dialog.setAttribute('aria-labelledby','registrationTitle');
    let fields='';
    if(kind==='match') {
      busy=true;
      try { dialog.innerHTML=await homeMatchMarkup(); }
      catch(error) { alert(error.message); return; }
      finally { busy=false; }
    } else if(kind==='player'){
      fields=field('registerPlayerName','선수 이름 *','text','required maxlength="50"')+field('registerNumber','등번호 *','number','required min="0" step="1"')+
      '<div class="form-group"><label for="registerPosition">포지션 *</label><select id="registerPosition" required><option value="">선택하세요</option><option value="GK">GK · 골키퍼</option><option value="FIXO">FIXO · 픽소</option><option value="ALA">ALA · 아라</option><option value="PIVO">PIVO · 피보</option></select></div>'+field('registerJoined','입단일','date');
    }else{
      fields=field('registerDate','경기 날짜 *','date','required')+field('registerOpponent','상대팀 *','text','required maxlength="100"')+field('registerLocation','장소','text','maxlength="100"');
      if(kind==='schedule')fields+='<div class="form-group"><label for="registerStart">시작 시간 *</label><input id="registerStart" type="text" inputmode="numeric" maxlength="5" placeholder="20:00" required></div><div class="form-group"><label for="registerEnd">종료 시간 *</label><input id="registerEnd" type="text" inputmode="numeric" maxlength="5" placeholder="21:30" required></div>';
      if(kind==='match')fields+=field('registerOurScore','WGH 득점 *','number','required min="0" step="1" value="0"')+field('registerTheirScore','상대팀 득점 *','number','required min="0" step="1" value="0"');
      fields+='<div class="form-group"><label for="registerMemo">메모</label><textarea id="registerMemo" rows="3"></textarea></div>';
      if(kind==='match')fields+='<fieldset class="wgh-register-players"><legend>참가 선수 · 득점 · 도움</legend><p id="registerPlayerStatus">선수 목록을 불러오는 중입니다…</p><div id="registerPlayers"></div></fieldset>';
    }
    if(kind!=='match') dialog.innerHTML=`<div class="wgh-register-header"><h2 id="registrationTitle">${title}</h2><button type="button" data-register-close aria-label="닫기">×</button></div><form>${fields}<p class="wgh-register-status" role="status"></p><div class="modal-actions"><button type="button" class="cancel-button" data-register-close>취소</button><button type="submit" class="save-match-button">저장</button></div></form>`;
    document.body.append(dialog);
    const form=dialog.querySelector('form');form.reset();const status=dialog.querySelector('[role=status]');const submit=form.querySelector('[type=submit]');
    const get=id=>dialog.querySelector('#'+id);
    let saving=false,playersReady=kind!=='match';
    const close=()=>{if(!saving)dialog.close();};
    dialog.querySelectorAll('[data-register-close]').forEach(button=>button.addEventListener('click',close));
    dialog.addEventListener('cancel',e=>{if(saving)e.preventDefault();});
    dialog.addEventListener('close',()=>{dialog.remove();trigger.focus();},{once:true});
    dialog.showModal();
    if(kind!=='player')get('registerDate').value=today();
    if(kind==='schedule')for(const id of ['registerStart','registerEnd'])get(id).addEventListener('input',()=>{const digits=get(id).value.replace(/\D/g,'');if(digits.length===4)get(id).value=digits.slice(0,2)+':'+digits.slice(2);});
    if(kind==='match'){
      submit.disabled=true;
      try{
        const response=await fetch('/api/players');const result=await response.json();
        if(!response.ok||!result.success||!Array.isArray(result.data))throw new Error('선수 목록을 불러오지 못했습니다. 창을 닫고 다시 열어주세요.');
        if(!dialog.isConnected)return;
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
          get('registerPlayers').append(row);
        }
        get('registerPlayerStatus').textContent=result.data.length?'':'등록된 선수가 없습니다.';
        get('registerPlayerStatus').hidden=result.data.length>0;
        playersReady=true;submit.disabled=false;
      }catch(error){if(dialog.isConnected)status.textContent=error.message;}
    }
    form.addEventListener('submit',async event=>{
      event.preventDefault();if(saving||!playersReady)return;
      if(!document.documentElement.classList.contains('wgh-admin')){status.textContent='관리자 로그인을 확인해 주세요.';return;}
      let payload,url;
      if(kind==='player'){
        payload={player_name:get('registerPlayerName').value.trim(),back_number:Number(get('registerNumber').value),position:get('registerPosition').value,joined_at:get('registerJoined').value||null};url='/api/players';
        if(!payload.player_name){status.textContent='선수 이름을 입력해 주세요.';return;}
      }else{
        payload={match_date:get('registerDate').value,opponent:get('registerOpponent').value.trim(),location:get('registerLocation').value.trim(),memo:get('registerMemo').value};
        if(!payload.opponent){status.textContent='상대팀 이름을 입력해 주세요.';return;}
        if(kind==='schedule'){
          const normalize=value=>/^\d{4}$/.test(value)?value.slice(0,2)+':'+value.slice(2):value;
          const start=normalize(get('registerStart').value),end=normalize(get('registerEnd').value);const pattern=/^([01]\d|2[0-3]):[0-5]\d$/;
          if(!pattern.test(start)||!pattern.test(end)||end<=start){status.textContent='시작·종료 시간을 24시간 형식으로 확인해 주세요. 종료 시간은 시작 시간보다 늦어야 합니다.';return;}
          Object.assign(payload,{start_time:start,end_time:end});url='/api/schedules';
        }else{
          Object.assign(payload,{our_score:Number(get('registerOurScore').value),opponent_score:Number(get('registerTheirScore').value),players:[...get('registerPlayers').children].filter(row=>row.querySelector('[type=checkbox]')?.checked).map(row=>({player_id:Number(row.querySelector('[type=checkbox]').value),goals:Number(row.querySelector('[data-record=goals]').value),assists:Number(row.querySelector('[data-record=assists]').value)}))});url='/api/matches';
        }
      }
      saving=true;busy=true;submit.disabled=true;status.textContent='저장 중입니다…';
      try{
        const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});const result=await response.json();
        if(!response.ok||result.success===false)throw new Error(typeof result.detail==='string'?result.detail:'입력값을 확인해 주세요.');
        window.dispatchEvent(new CustomEvent('wgh-record-created',{detail:{kind,data:result.data}}));
        saving=false;dialog.close();
      }catch(error){status.textContent=error.message;}
      finally{saving=false;busy=false;if(dialog.isConnected)submit.disabled=false;}
    });
  });
})();
