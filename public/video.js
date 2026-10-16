
  // WGH 영상 탭: 전체 경기 YouTube 재생과 하이라이트 준비 영역을 구분합니다.
  const fullTab = document.getElementById('fullTab');
  const highlightTab = document.getElementById('highlightTab');
  const fullPanel = document.getElementById('fullPanel');
  const highlightPanel = document.getElementById('highlightPanel');
  const fullPlayer = document.getElementById('fullPlayer');
  const highlightPlayer = document.getElementById('highlightPlayer');
  const fullList = document.getElementById('fullVideoList');
  let selectedVideoId = null;
  let videoCatalog = [];
  let matchChoices = [];
  let matchChoicesReady = false;
  let videoCatalogReady = false;
  const linkedMatchId = new URLSearchParams(location.search).get('match_id');

  function switchVideoTab(name) {
    const isFull = name === 'full';
    fullTab.classList.toggle('active', isFull);
    highlightTab.classList.toggle('active', !isFull);
    fullTab.setAttribute('aria-selected', String(isFull));
    highlightTab.setAttribute('aria-selected', String(!isFull));
    fullPanel.hidden = !isFull;
    highlightPanel.hidden = isFull;
    if (!isFull && fullPlayer.src) {
      // 다른 탭에서는 유튜브 영상 재생을 중지합니다.
      fullPlayer.src = fullPlayer.src;
    }
    if (isFull) highlightPlayer.pause();
  }
  fullTab.addEventListener('click', () => switchVideoTab('full'));
  highlightTab.addEventListener('click', () => switchVideoTab('highlight'));

  // 등록된 YouTube ID만 사용해 임베드 주소를 구성합니다.
  function playYouTubeVideo(video, button) {
    if (!/^[a-zA-Z0-9_-]{11}$/.test(video.youtube_id)) return;
    selectedVideoId = video.video_id;
    const url = new URL('https://www.youtube.com/embed/' + video.youtube_id);
    url.searchParams.set('playsinline', '1');
    fullPlayer.src = url.toString();
    fullPlayer.hidden = false;
    document.getElementById('fullPlaceholder').hidden = true;
    fullList.querySelectorAll('.video-list-item').forEach(item => item.classList.remove('selected'));
    button.classList.add('selected');
  }

  async function loadFullVideos() {
    fullList.replaceChildren();
    const loading = document.createElement('p');
    loading.className = 'video-empty';
    loading.textContent = '등록된 경기 영상을 불러오는 중입니다…';
    fullList.appendChild(loading);
    try {
      const response = await fetch('/api/youtube-videos');
      if (!response.ok) throw new Error('HTTP ' + response.status);
      const result = await response.json();
      if (!result.success || !Array.isArray(result.data)) throw new Error('목록 형식 오류');
      videoCatalog = result.data;
      videoCatalogReady = true;
      refreshLinkEditor();
      const videos = linkedMatchId === null ? result.data
        : result.data.filter(video => String(video.match_id) === linkedMatchId);
      if (!videos.some(video => video.video_id === selectedVideoId)) {
        selectedVideoId = null;
        fullPlayer.removeAttribute('src');
        fullPlayer.hidden = true;
        document.getElementById('fullPlaceholder').hidden = false;
      }
      fullList.replaceChildren();
      if (!videos.length) {
        const empty = document.createElement('p');
        empty.className = 'video-empty';
        empty.textContent = linkedMatchId === null ? '아직 등록된 전체 경기 영상이 없습니다.' : '이 경기에 연결된 영상이 없습니다.';
        fullList.appendChild(empty);
        return;
      }
      for (const video of videos) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'video-list-item';
        const title = document.createElement('span');
        title.textContent = (video.match_date ? video.match_date + ' · ' : '') + (video.title || '제목 없는 경기');
        const play = document.createElement('span');
        play.textContent = '▶ 재생';
        button.append(title, play);
        button.addEventListener('click', () => playYouTubeVideo(video, button));
        if (video.video_id === selectedVideoId) button.classList.add('selected');
        fullList.appendChild(button);
        if (linkedMatchId !== null && selectedVideoId === null) playYouTubeVideo(video, button);
      }
    } catch (error) {
      videoCatalogReady = false;
      refreshLinkEditor();
      console.error('WGH YouTube 영상 목록 오류:', error);
      fullList.replaceChildren();
      const message = document.createElement('p');
      message.className = 'video-empty';
      message.textContent = '영상 목록을 불러오지 못했습니다. FastAPI 서버와 MySQL 연결을 확인해 주세요.';
      fullList.appendChild(message);
    }
  }

  // 이번 단계는 목록/재생 전환만 수행합니다. 기존 로컬 업로드는 사용하지 않습니다.
  loadFullVideos();

  
/* =====================================================
   WGH 유튜브 경기 영상 등록
   - 홈페이지 입력값을 FastAPI에 전달
   - MySQL 저장 성공 시 영상 목록 새로고침
   ===================================================== */

const youtubeRegisterForm =
    document.getElementById('youtubeRegisterForm');

const videoRegisterBtn =
    document.getElementById('videoRegisterBtn');

const videoRegisterMessage =
    document.getElementById('videoRegisterMessage');

youtubeRegisterForm.addEventListener('submit', async function (event) {

    // 폼 제출 시 페이지 새로고침 방지
    event.preventDefault();

    // 입력값 가져오기
    const title =
        document.getElementById('videoTitle').value.trim();

    const youtubeUrl =
        document.getElementById('youtubeUrl').value.trim();

    const matchDate =
        document.getElementById('videoMatchDate').value;

    if (!matchChoicesReady) { videoRegisterMessage.textContent = '경기 목록을 불러오지 못했습니다. 새로고침 후 다시 시도해 주세요.'; return; }

    // 필수 입력값 확인
    if (!title || !youtubeUrl || !matchDate) {
        videoRegisterMessage.textContent =
            '모든 필수 항목을 입력해 주세요.';
        return;
    }

    // 중복 클릭 방지
    videoRegisterBtn.disabled = true;
    videoRegisterBtn.textContent = '등록 중...';

    videoRegisterMessage.textContent = '영상 등록 중입니다.';
    videoRegisterMessage.style.color = '#3478f6';

    try {

        // FastAPI에 영상 등록 요청
        const response = await fetch('/api/youtube-videos', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                title: title,
                youtube_url: youtubeUrl,
                match_date: matchDate,
                match_id: document.getElementById('videoMatchSelect').value ? Number(document.getElementById('videoMatchSelect').value) : null
            })
        });

        const result = await response.json();

        // API 오류 확인
        if (!response.ok || result.success === false) {

            const detail = result.detail || result.message;

            let errorMessage = '영상 등록에 실패했습니다.';

            if (typeof detail === 'string') {
                errorMessage = detail;
            } else if (typeof detail?.message === 'string') {
                errorMessage = detail.message;
            }

            throw new Error(errorMessage);
        }

        // 등록 성공
        videoRegisterMessage.textContent =
            '영상이 성공적으로 등록되었습니다!';

        videoRegisterMessage.style.color = '#16803c';

        // 입력창 초기화
        youtubeRegisterForm.reset();

        // 전체 경기 영상 목록 다시 불러오기
        await loadFullVideos();

    } catch (error) {

        console.error('유튜브 영상 등록 오류:', error);

        videoRegisterMessage.textContent =
            error.message || '영상 등록 중 오류가 발생했습니다.';

        videoRegisterMessage.style.color = '#d93025';

    } finally {

        // 등록 버튼 다시 활성화
        videoRegisterBtn.disabled = false;
        videoRegisterBtn.textContent = '＋ 영상 등록';

    }

});

function fillMatchOptions(select,emptyLabel) {
  select.replaceChildren(new Option(emptyLabel,''));
  for (const match of matchChoices) {
    select.add(new Option(`${match.match_date} · WGH vs ${match.opponent} (${match.our_score}:${match.opponent_score})`,String(match.match_id)));
  }
}
function showSelectedVideoMatch() {
  const videoId=document.getElementById('linkVideoSelect').value;
  const video=videoCatalog.find(item=>String(item.video_id)===videoId);
  const matchSelect=document.getElementById('linkMatchSelect');
  fillMatchOptions(matchSelect,'연결 안 함 (연결 해제)');
  if (video?.match_id != null && !matchChoices.some(item=>Number(item.match_id)===Number(video.match_id))) {
    matchSelect.add(new Option('기존 연결 경기 #'+video.match_id,String(video.match_id)));
  }
  matchSelect.value=video?.match_id == null?'':String(video.match_id);
  document.getElementById('saveVideoMatch').disabled=!(video && matchChoicesReady && videoCatalogReady);
}
function refreshLinkEditor() {
  const videoSelect=document.getElementById('linkVideoSelect');
  const previous=videoSelect.value;
  videoSelect.replaceChildren(new Option('영상을 선택하세요',''));
  for (const video of videoCatalog) videoSelect.add(new Option(`${video.match_date} · ${video.title}`,String(video.video_id)));
  if (videoCatalog.some(item=>String(item.video_id)===previous)) videoSelect.value=previous;
  showSelectedVideoMatch();
}
async function loadMatchChoices() {
  try {
    const response=await fetch('/api/matches');
    const result=await response.json();
    if (!response.ok || !result.success || !Array.isArray(result.data)) throw new Error('경기 목록을 불러오지 못했습니다. 새로고침해 주세요.');
    matchChoices=result.data;
    matchChoicesReady=true;
    fillMatchOptions(document.getElementById('videoMatchSelect'),'연결 안 함');
    refreshLinkEditor();
  } catch(error) {
    document.getElementById('videoLinkStatus').textContent=error.message;
    videoRegisterMessage.textContent=error.message;
  }
}
document.getElementById('linkVideoSelect').addEventListener('change',()=>{
  showSelectedVideoMatch();
  document.getElementById('videoLinkStatus').textContent='';
});
document.getElementById('videoLinkForm').addEventListener('submit',async event=>{
  event.preventDefault();
  const videoId=document.getElementById('linkVideoSelect').value;
  const matchId=document.getElementById('linkMatchSelect').value;
  if (!videoId || !matchChoicesReady || !videoCatalogReady) return;
  const button=document.getElementById('saveVideoMatch');
  const status=document.getElementById('videoLinkStatus');
  button.disabled=true;
  try {
    const response=await fetch('/api/youtube-videos/'+encodeURIComponent(videoId)+'/match',{
      method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({match_id:matchId?Number(matchId):null})
    });
    const result=await response.json();
    if (!response.ok || !result.success) throw new Error(typeof result.detail==='string'?result.detail:'경기 연결을 저장하지 못했습니다.');
    status.textContent=matchId?'경기 연결을 저장했습니다.':'경기 연결을 해제했습니다.';
    await loadFullVideos();
  } catch(error) {status.textContent=error.message;}
  finally {showSelectedVideoMatch();}
});
loadMatchChoices();
