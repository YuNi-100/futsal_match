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
      el('playerName').textContent=player.player_name;
      el('playerNumber').textContent='#'+player.back_number;
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
  load();
})();
