(() => {
  const el = id => document.getElementById(id);
  const id = new URLSearchParams(location.search).get('match_id');
  const status = el('detailStatus');
  if (!id || !/^[1-9]\d*$/.test(id)) {
    status.textContent = '올바른 경기 주소가 아닙니다. 홈에서 경기를 다시 선택해 주세요.';
    return;
  }
  function playerLink(player) {
    const link = document.createElement('a');
    link.className = 'player-record-link';
    link.href = '/player.html?player_id=' + encodeURIComponent(player.player_id) + '&match_id=' + encodeURIComponent(id);
    link.textContent = player.player_name;
    return link;
  }
  async function load() {
    try {
      const response = await fetch('/api/matches/' + encodeURIComponent(id));
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(typeof result.detail === 'string' ? result.detail : '경기 상세 정보를 불러오지 못했습니다.');
      const match = result.data;
      document.title = `WGH vs ${match.opponent} | 경기 기록`;
      el('matchTitle').textContent = `WGH vs ${match.opponent}`;
      el('detailDate').textContent = match.match_date;
      el('detailOpponent').textContent = match.opponent;
      el('detailScore').textContent = `${match.our_score} : ${match.opponent_score}`;
      const resultLabel = {win:'승리',draw:'무승부',lose:'패배'};
      el('detailResult').textContent = resultLabel[match.result] || '결과 미등록';
      el('detailResult').dataset.result = match.result;
      el('detailLocation').textContent = match.location || '장소 미등록';
      el('detailTime').textContent = match.start_time || match.end_time
        ? `${match.start_time || '미등록'} ~ ${match.end_time || '미등록'}` : '시간 미등록';
      el('detailMemo').textContent = match.memo || '등록된 메모가 없습니다.';
      const players = el('detailPlayers');
      players.replaceChildren();
      for (const player of match.players) {
        const row = document.createElement('tr');
        for (const [index,value] of [player.back_number,player.player_name,player.position,player.goals,player.assists].entries()) {
          const cell = document.createElement('td');
          if (index === 1) cell.append(playerLink(player));
          else cell.textContent = String(value);
          row.append(cell);
        }
        players.append(row);
      }
      el('playersEmpty').hidden = match.players.length > 0;
      el('playersTable').hidden = match.players.length === 0;
      const scorers = match.players.filter(player => player.goals > 0);
      el('detailScorers').replaceChildren();
      if (!scorers.length) el('detailScorers').textContent = '등록된 득점 선수 기록이 없습니다.';
      scorers.forEach((player,index) => {
        if (index) el('detailScorers').append(' · ');
        const name = document.createElement(match.videos.length || match.video_login_required ? 'a' : 'span');
        name.textContent = player.player_name;
        if (match.videos.length || match.video_login_required) {
          name.className = 'player-record-link';
          name.href = '/video.html?match_id=' + encodeURIComponent(id);
          name.setAttribute('aria-label', player.player_name + ' 득점 경기 영상 보기');
        }
        el('detailScorers').append(name, ` ${player.goals}골`);
      });
      if (scorers.length && !match.videos.length && !match.video_login_required) {
        const note = document.createElement('span');
        note.className = 'detail-muted';
        note.textContent = ' (경기 영상 미등록)';
        el('detailScorers').append(note);
      }
      const videoButton = el('matchVideoLink');
      if (match.video_login_required) {
        videoButton.href='/video.html?match_id='+encodeURIComponent(id);
        videoButton.textContent='로그인하고 경기 영상 보기 →';
        videoButton.hidden=false;
        el('videoStatus').textContent='경기 영상은 회원 로그인 후 볼 수 있습니다.';
      } else if (match.videos.length) {
        videoButton.href = '/video.html?match_id=' + encodeURIComponent(id);
        videoButton.hidden = false;
        el('videoStatus').textContent = `연결된 경기 영상 ${match.videos.length}개`;
      } else {
        el('videoStatus').textContent = '등록된 경기 영상 없음';
        el('noMatchVideo').hidden = false;
      }
      status.hidden = true;
      el('matchDetail').hidden = false;
    } catch (error) {
      status.textContent = error.message;
    }
  }
  load();
})();
