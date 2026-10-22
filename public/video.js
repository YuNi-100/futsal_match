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
  const requestedVideoId=new URLSearchParams(location.search).get('video_id');
  const playbackPanel=document.getElementById('tvPlaybackPanel');
  const caption=document.getElementById('tvNowPlaying');
  function clearPlayer(){
    selectedVideoId=null;fullPlayer.removeAttribute('src');fullPlayer.hidden=true;
    document.getElementById('fullPlaceholder').hidden=false;
    if(playbackPanel)playbackPanel.hidden=true;
    fullList.querySelectorAll('.video-list-item').forEach(item=>item.classList.remove('selected'));
  }
  document.getElementById('tvClosePlayer')?.addEventListener('click',clearPlayer);

  function switchVideoTab(name) {
    const analysisTab=document.getElementById('analysisTab');
    const analysisPanel=document.getElementById('analysisPanel');
    if(analysisTab){analysisTab.classList.remove('active');analysisTab.setAttribute('aria-selected','false');analysisPanel.hidden=true;document.getElementById('analysisPlayer').removeAttribute('src');}
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
    window.dispatchEvent(new CustomEvent('wgh-view-video-selected',{detail:{video_id:video.video_id}}));
    const url = new URL('https://www.youtube.com/embed/' + video.youtube_id);
    url.searchParams.set('playsinline', '1');
    fullPlayer.src = url.toString();
    if(playbackPanel)playbackPanel.hidden=false;
    if(caption)caption.textContent=video.title||'경기 영상';
    fullPlayer.hidden = false;
    document.getElementById('fullPlaceholder').hidden = true;
    fullList.querySelectorAll('.video-list-item').forEach(item => item.classList.remove('selected'));
    button.classList.add('selected');
  }

  async function loadFullVideos() {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    fullList.replaceChildren();
    const loading = document.createElement('p');
    loading.className = 'video-empty';
    loading.textContent = '등록된 경기 영상을 불러오는 중입니다…';
    fullList.appendChild(loading);
    try {
      const response = await fetch('/api/youtube-videos', {cache:'no-store', signal:controller.signal});
      if (response.status === 401 || response.status === 403) {
        clearPlayer();
        fullList.replaceChildren();
        const message = document.createElement('p');
        message.className = 'video-empty';
        const text = document.createElement('span');
        text.textContent = response.status === 401
          ? '현재 요청의 로그인 정보를 확인할 수 없습니다. 로그인 상태를 확인해 주세요. '
          : '영상 시청을 위한 이용 동의와 로그인 상태를 확인해 주세요. ';
        const link = document.createElement('a');
        link.href = '/account.html';
        link.textContent = response.status === 401 ? 'Google 계정으로 다시 로그인' : '내 페이지에서 확인';
        message.append(text, link);
        fullList.appendChild(message);
        return;
      }
      if (!response.ok) throw new Error('HTTP ' + response.status);
      const result = await response.json();
      if (!result.success || !Array.isArray(result.data)) throw new Error('목록 형식 오류');
      const videos = linkedMatchId === null ? result.data
        : result.data.filter(video => String(video.match_id) === linkedMatchId)
            .sort((a, b) => String(a.title || '').localeCompare(String(b.title || ''), 'ko', { numeric: true, sensitivity: 'base' }) || Number(a.video_id) - Number(b.video_id));
      window.dispatchEvent(new CustomEvent('wgh-view-video-catalog',{detail:{videos}}));
      if (!videos.some(video => video.video_id === selectedVideoId)) {
        clearPlayer();
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
        button.className = 'video-list-item wgh-tv-card';
        button.setAttribute('aria-label',(video.title||'경기 영상')+' 재생');
        const thumbnail=document.createElement('span');thumbnail.className='tv-card-thumbnail';
        if(/^[a-zA-Z0-9_-]{11}$/.test(video.youtube_id)){
          const image=document.createElement('img');image.src='https://i.ytimg.com/vi/'+video.youtube_id+'/hqdefault.jpg';image.alt='';image.loading='lazy';image.width=480;image.height=270;
          image.addEventListener('error',()=>{image.hidden=true;});thumbnail.append(image);
        }
        const play=document.createElement('span');play.className='tv-card-play';play.textContent='▶';play.setAttribute('aria-hidden','true');thumbnail.append(play);
        const copy=document.createElement('span');copy.className='tv-card-copy';
        const title = document.createElement('strong');title.className='tv-card-title';
        title.textContent = video.title || '제목 없는 경기';
        const date=document.createElement('span');date.className='tv-card-meta';date.textContent=video.match_date||'날짜 미등록';
        copy.append(title,date);button.append(thumbnail,copy);
        button.addEventListener('click', () => playYouTubeVideo(video, button));
        if (video.video_id === selectedVideoId) button.classList.add('selected');
        fullList.appendChild(button);
        if(requestedVideoId!==null&&String(video.video_id)===requestedVideoId)playYouTubeVideo(video,button);
        if (linkedMatchId !== null && selectedVideoId === null) playYouTubeVideo(video, button);
      }
    } catch (error) {
      console.error('WGH YouTube 영상 목록 오류:', error);
      fullList.replaceChildren();
      const message = document.createElement('p');
      message.className = 'video-empty';
      message.textContent = error.name === 'AbortError'
        ? '서버 응답이 늦어 영상 목록을 불러오지 못했습니다. '
        : '영상 목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요. ';
      const retry = document.createElement('button');
      retry.type = 'button';
      retry.textContent = '다시 불러오기';
      retry.addEventListener('click', loadFullVideos);
      message.appendChild(retry);
      fullList.appendChild(message);
    } finally {
      clearTimeout(timeout);
    }
  }

  // 이번 단계는 목록/재생 전환만 수행합니다. 기존 로컬 업로드는 사용하지 않습니다.
  loadFullVideos();

  

});
