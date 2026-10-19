window.WGHAuthReady.then(identity => {
  if(!identity.user) {
    document.querySelectorAll('iframe').forEach(frame=>frame.removeAttribute('src'));
    const main=document.querySelector('main');
    main.replaceChildren();
    const section=document.createElement('section');section.className='detail-panel';
    const heading=document.createElement('h2');heading.textContent='경기 영상은 로그인 후 볼 수 있어요';
    const link=document.createElement('a');link.href='/auth/google/login';link.textContent='Google 계정으로 로그인';
    section.append(heading,link);main.append(section);
    return;
  }

  // WGH 영상 탭: 전체 경기 YouTube 재생과 하이라이트 준비 영역을 구분합니다.
  const fullTab = document.getElementById('fullTab');
  const highlightTab = document.getElementById('highlightTab');
  const fullPanel = document.getElementById('fullPanel');
  const highlightPanel = document.getElementById('highlightPanel');
  const fullPlayer = document.getElementById('fullPlayer');
  const highlightPlayer = document.getElementById('highlightPlayer');
  const fullList = document.getElementById('fullVideoList');
  let selectedVideoId = null;
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

  

});
