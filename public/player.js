(() => {
  const el=id=>document.getElementById(id);
  const params=new URLSearchParams(location.search);
  const id=params.get('player_id');
  const matchId=params.get('match_id');
  if (matchId && /^[1-9]\d*$/.test(matchId)) {
    el('playerBack').href='/match.html?match_id='+encodeURIComponent(matchId);
    el('playerBack').textContent='← 경기 상세로';
  }
  if (!id || !/^[1-9]\d*$/.test(id)) {
    el('playerStatus').textContent='올바른 선수 주소가 아닙니다. 선수를 다시 선택해 주세요.';
    return;
  }
  const cell=(row,text)=>{
    const td=document.createElement('td'); td.textContent=String(text); row.append(td); return td;
  };
  async function load() {
    try {
      const response=await fetch('/api/players/'+encodeURIComponent(id));
      const result=await response.json();
      if (!response.ok || !result.success) throw new Error(typeof result.detail==='string'?result.detail:'선수 정보를 불러오지 못했습니다.');
      const player=result.data;
      document.title=player.player_name+' | WGH 선수 정보';
      document.getElementById('playerRecordActions')?.remove();
      const actions=window.WGHRecordActions('player',player,()=>{location.href='/players.html';});actions.id='playerRecordActions';el('playerDetail').prepend(actions);
      el('playerName').textContent=player.player_name;
      const jerseyName=document.createElement('span');jerseyName.className='jersey-name';jerseyName.textContent=player.player_name;
      const jerseyNumber=document.createElement('span');jerseyNumber.className='jersey-number';jerseyNumber.textContent=player.back_number;
      el('playerNumber').replaceChildren(jerseyName,jerseyNumber);
      el('playerNumber').setAttribute('aria-label','등번호 '+player.back_number);
      const positions={GK:'골키퍼',FIXO:'픽소',ALA:'아라',PIVO:'피보'};
      el('playerPosition').textContent=(positions[player.position]||player.position)+' · '+player.position;
      el('playerJoined').textContent=player.joined_at||'미등록';
      for (const name of ['appearances','goals','assists']) el(name).textContent=player[name];
      el('playerMatches').replaceChildren();
      for (const match of player.matches) {
        const row=document.createElement('tr');
        cell(row,match.match_date);
        const opponent=cell(row,'');
        const detail=document.createElement('a');
        detail.className='player-record-link';
        detail.href='/match.html?match_id='+encodeURIComponent(match.match_id);
        detail.textContent=match.opponent;
        opponent.append(detail);
        cell(row,`${match.our_score} : ${match.opponent_score}`);
        const goals=cell(row,match.goals);
        if (match.goals>0 && match.has_video) {
          const video=document.createElement('a');
          video.className='player-record-link';
          video.href='/video.html?match_id='+encodeURIComponent(match.match_id);
          video.textContent=String(match.goals);
          video.setAttribute('aria-label',`${match.opponent} 경기 ${match.goals}골 · 경기 영상 보기`);
          goals.replaceChildren(video);
        }
        cell(row,match.assists);
        cell(row,match.has_video?'연결 영상 있음':'등록된 영상 없음');
        el('playerMatches').append(row);
      }
      el('playerMatchesEmpty').hidden=player.matches.length>0;
      el('playerMatchesTable').hidden=player.matches.length===0;
      el('playerStatus').hidden=true;
      el('playerDetail').hidden=false;
    } catch(error) {el('playerStatus').textContent=error.message;}
  }
  let memberChoicesLoading=false;
  async function loadMemberChoices() {
    if(!document.documentElement.classList.contains('wgh-admin')||memberChoicesLoading)return;
    memberChoicesLoading=true;
    const status=el('playerMemberStatus'),select=el('playerMemberSelect'),button=el('savePlayerMember');
    button.disabled=true;select.disabled=true;
    try {
      const response=await fetch('/api/admin/members',{cache:'no-store'});const result=await response.json();
      if(!response.ok||!result.success)throw new Error('회원 목록을 불러오지 못했습니다. 새로고침해 주세요.');
      select.replaceChildren(new Option('연결 안 함 (연결 해제)',''));
      for(const member of result.data)if(member.player_id==null||Number(member.player_id)===Number(id)) {
        select.add(new Option(`${member.name} · ${member.email}`,String(member.user_id)));
        if(Number(member.player_id)===Number(id))select.value=String(member.user_id);
      }
      select.disabled=false;button.disabled=false;
    }catch(error){status.textContent=error.message;}
    finally{memberChoicesLoading=false;}
  }
  window.addEventListener('wgh-auth-changed',loadMemberChoices);
  if(document.documentElement.classList.contains('wgh-admin'))loadMemberChoices();
  el('playerMemberForm').addEventListener('submit',async event=>{
    event.preventDefault();if(!document.documentElement.classList.contains('wgh-admin')||el('savePlayerMember').disabled)return;
    const selected=el('playerMemberSelect').value;el('savePlayerMember').disabled=true;
    try {
      const response=await fetch('/api/admin/players/'+encodeURIComponent(id)+'/member',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({user_id:selected?Number(selected):null})});
      const result=await response.json();if(!response.ok||!result.success)throw new Error(typeof result.detail==='string'?result.detail:'회원 연결 저장에 실패했습니다.');
      el('playerMemberStatus').textContent=selected?'선수 회원 연결을 저장했습니다.':'선수 회원 연결을 해제했습니다.';
      await loadMemberChoices();window.dispatchEvent(new Event('wgh-membership-changed'));
    }catch(error){el('playerMemberStatus').textContent=error.message;el('savePlayerMember').disabled=false;}
  });
  window.addEventListener('wgh-record-created',event=>{if(event.detail.kind==='player')load();});
  load();
})();
