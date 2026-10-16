const el = id => document.getElementById(id);
let videos = [];
let busy = false;
let latest = null;
function refreshButton() {
  el('analyze').disabled = busy || !el('video').value;
}
function timeLabel(seconds) {
  return Math.floor(seconds / 60).toString().padStart(2, '0') + ':' + (seconds % 60).toString().padStart(2, '0');
}
function showPlayer(seconds = 0) {
  const video = videos.find(item => String(item.video_id) === el('video').value);
  if (!video || !/^[A-Za-z0-9_-]{11}$/.test(video.youtube_id)) {
    el('player').hidden = true;
    return;
  }
  el('player').src = 'https://www.youtube.com/embed/' + video.youtube_id + '?start=' + seconds;
  el('player').hidden = false;
}
async function loadVideos() {
  try {
    const response = await fetch('/api/youtube-videos');
    const result = await response.json();
    if (!response.ok || !result.success || !Array.isArray(result.data)) throw Error('영상 목록을 불러오지 못했어요. 서버와 MySQL 연결을 확인해 주세요.');
    videos = result.data;
    el('video').replaceChildren();
    for (const item of videos) {
      const option = document.createElement('option');
      option.value = item.video_id;
      option.textContent = (item.match_date || '') + ' · ' + item.title;
      el('video').append(option);
    }
    el('status').textContent = videos.length ? '우리 팀 유니폼과 분석할 구간을 입력하세요.' : '경기 영상 페이지에서 공개 YouTube 영상을 먼저 등록해 주세요.';
    showPlayer();
  } catch (error) {
    el('video').replaceChildren();
    el('status').textContent = error.message;
  }
  refreshButton();
}
function render(result) {
  latest = result;
  el('summary').textContent = result.analysis.summary;
  el('scenes').replaceChildren();
  for (const scene of result.analysis.scenes) {
    const card = document.createElement('article');
    const title = document.createElement('h3');
    title.textContent = timeLabel(scene.time_seconds) + ' · ' + scene.category;
    card.append(title);
    for (const [key, label] of [['observation', '관찰한 장면'], ['comment', '코치 코멘트'], ['next_action', '다음에 해볼 행동']]) {
      if (!scene[key]) continue;
      const line = document.createElement('p');
      const strong = document.createElement('strong');
      strong.textContent = label + ': ';
      line.append(strong, document.createTextNode(scene[key]));
      card.append(line);
    }
    const jump = document.createElement('button');
    jump.type = 'button';
    jump.textContent = '이 장면 확인';
    jump.addEventListener('click', () => showPlayer(scene.time_seconds));
    card.append(jump);
    el('scenes').append(card);
  }
  el('limits').replaceChildren();
  for (const limit of result.analysis.limitations) {
    const item = document.createElement('li');
    item.textContent = limit;
    el('limits').append(item);
  }
  el('meta').textContent = 'AI 생성 · ' + result.model + ' · 분석 구간 ' + timeLabel(result.start_seconds) + '~' + timeLabel(result.end_seconds) + ' · 사람 검수 필요';
  el('result').hidden = false;
}
el('video').addEventListener('change', () => {
  el('consent').checked = false;
  el('result').hidden = true;
  latest = null;
  showPlayer();
  refreshButton();
});
el('feedbackForm').addEventListener('submit', async event => {
  event.preventDefault();
  if (busy) return;
  const start = Number(el('start').value);
  const end = Number(el('end').value);
  const teamColor = el('color').value.trim();
  if (!Number.isInteger(start) || !Number.isInteger(end) || end <= start || end - start > 180 || !teamColor) {
    el('status').textContent = '우리 팀 유니폼을 입력하고 1~180초 구간을 지정해 주세요.';
    return;
  }
  if (!el('consent').checked) return;
  busy = true;
  refreshButton();
  el('video').disabled = true;
  el('result').hidden = true;
  latest = null;
  el('status').textContent = '영상을 분석하고 있어요. 최대 약 2분이 걸릴 수 있어요. 버튼을 다시 누르지 마세요.';
  try {
    const response = await fetch('/api/youtube-videos/' + encodeURIComponent(el('video').value) + '/feedback', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({team_color: teamColor, start_seconds: start, end_seconds: end, consent: true})
    });
    const result = await response.json();
    if (!response.ok || !result.success) throw Error(typeof result.detail === 'string' ? result.detail : '요청 값을 확인해 주세요. 오류 코드: ' + response.status);
    render(result.data);
    el('status').textContent = '분석을 마쳤어요. 장면을 다시 보며 코멘트가 맞는지 확인해 주세요.';
  } catch (error) {
    el('status').textContent = error.message + ' 재시도 전 사용 내역을 확인해 주세요.';
  } finally {
    busy = false;
    el('video').disabled = false;
    refreshButton();
  }
});
el('download').addEventListener('click', () => {
  if (!latest) return;
  const url = URL.createObjectURL(new Blob([JSON.stringify(latest, null, 2)], {type: 'application/json'}));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'wgh-video-feedback.json';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
loadVideos();

