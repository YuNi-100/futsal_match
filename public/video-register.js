window.WGHAuthReady.then(identity => {
  if (!identity.user || identity.user.role !== 'admin' || identity.user.consent_required) {
    const main=document.querySelector('main');
    main.replaceChildren();
    const section=document.createElement('section');section.className='video-panel';
    const heading=document.createElement('h2');
    heading.textContent=identity.user?'관리자만 접근할 수 있습니다.':'로그인 후 관리자 권한을 확인해 주세요.';
    const back=document.createElement('a');back.href='/video.html';back.textContent='경기 영상으로 돌아가기';
    section.append(heading,back);main.append(section);
    return;
  }
  let videoCatalog=[];
  let videoManagementBusy=false;
  let matchChoices=[];
  let matchChoicesReady=false;
  let videoCatalogReady=false;
  async function loadFullVideos() {
    try {
      const response=await fetch('/api/youtube-videos');
      const result=await response.json();
      if (!response.ok || !result.success || !Array.isArray(result.data)) throw new Error('영상 목록을 불러오지 못했습니다. 새로고침해 주세요.');
      videoCatalog=result.data;
      window.dispatchEvent(new CustomEvent('wgh-video-catalog',{detail:{videos:videoCatalog}}));
      videoCatalogReady=true;
      refreshLinkEditor();
    } catch (error) {
      videoCatalogReady=false;
      refreshLinkEditor();
      document.getElementById('videoLinkStatus').textContent=error.message;
    }
  }
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
    select.add(new Option(`${match.match_date} · ${match.team_name||'WGH 은평'} vs ${match.opponent} (${match.our_score}:${match.opponent_score})`,String(match.match_id)));
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
  const titleInput=document.getElementById('editVideoTitle');
  if (!videoManagementBusy) titleInput.value=video?.title || '';
  titleInput.disabled=videoManagementBusy || !(video && videoCatalogReady);
  document.getElementById('saveVideoTitle').disabled=videoManagementBusy || !(video && videoCatalogReady);
  document.getElementById('linkVideoSelect').disabled=videoManagementBusy;
  document.getElementById('linkMatchSelect').disabled=videoManagementBusy;
  document.getElementById('deleteRegisteredVideo').disabled=videoManagementBusy || !(video && videoCatalogReady);
  document.getElementById('saveVideoMatch').disabled=videoManagementBusy || !(video && matchChoicesReady && videoCatalogReady);
  document.getElementById('unlinkVideoMatch').disabled=videoManagementBusy || !(video && video.match_id != null && matchChoicesReady && videoCatalogReady);
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
  if (videoManagementBusy || !videoId || !matchChoicesReady || !videoCatalogReady) return;
  const button=document.getElementById('saveVideoMatch');
  const status=document.getElementById('videoLinkStatus');
  videoManagementBusy=true;
  showSelectedVideoMatch();
  try {
    const response=await fetch('/api/youtube-videos/'+encodeURIComponent(videoId)+'/match',{
      method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({match_id:matchId?Number(matchId):null})
    });
    const result=await response.json();
    if (!response.ok || !result.success) throw new Error(typeof result.detail==='string'?result.detail:'경기 연결을 저장하지 못했습니다.');
    status.textContent=matchId?'경기 연결을 저장했습니다.':'경기 연결을 해제했습니다.';
    await loadFullVideos();
  } catch(error) {status.textContent=error.message;}
  finally {videoManagementBusy=false;showSelectedVideoMatch();}
});
document.getElementById('editVideoTitle').addEventListener('keydown',event=>{
  if (event.key==='Enter') {event.preventDefault();document.getElementById('saveVideoTitle').click();}
});

document.getElementById('saveVideoTitle').addEventListener('click',async()=>{
  if (videoManagementBusy || !videoCatalogReady) return;
  const videoId=document.getElementById('linkVideoSelect').value;
  const video=videoCatalog.find(item=>String(item.video_id)===videoId);
  const input=document.getElementById('editVideoTitle');
  const title=input.value.trim();
  const status=document.getElementById('videoLinkStatus');
  if (!video) return;
  if (!title || title.length>200) {status.textContent='영상 제목은 1~200자로 입력해 주세요.';input.focus();return;}
  if (title===video.title) {status.textContent='제목이 변경되지 않았습니다.';return;}
  const pendingMatch=document.getElementById('linkMatchSelect').value;
  let saved=false;
  videoManagementBusy=true;showSelectedVideoMatch();
  try {
    const response=await fetch('/api/youtube-videos/'+encodeURIComponent(videoId)+'/title',{
      method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({title})
    });
    const result=await response.json();
    if (!response.ok || !result.success) throw new Error(typeof result.detail==='string'?result.detail:'영상 제목을 수정하지 못했습니다.');
    video.title=result.data.title;saved=true;
    refreshLinkEditor();
    window.dispatchEvent(new CustomEvent('wgh-video-catalog',{detail:{videos:videoCatalog}}));
    await loadSavedAnalyses();
    status.textContent='영상 제목을 수정했습니다.';
  } catch(error) {status.textContent=error.message;}
  finally {
    videoManagementBusy=false;showSelectedVideoMatch();
    document.getElementById('linkMatchSelect').value=pendingMatch;
    if (!saved) input.value=title;
  }
});

document.getElementById('deleteRegisteredVideo').addEventListener('click',async()=>{
  if (videoManagementBusy || !videoCatalogReady) return;
  const videoId=document.getElementById('linkVideoSelect').value;
  const video=videoCatalog.find(item=>String(item.video_id)===videoId);
  if (!video) return;
  if (!confirm(`‘${video.title}’ 영상을 홈페이지에서 삭제할까요?` + '\n\n이 영상의 등록 정보·경기 연결과 저장된 영상 분석 자료가 삭제됩니다.\n경기 결과·선수별 출전·득점·도움과 YouTube 원본은 유지됩니다.\n이 작업은 되돌릴 수 없습니다.')) return;
  const status=document.getElementById('videoLinkStatus');
  videoManagementBusy=true;showSelectedVideoMatch();
  try {
    const response=await fetch('/api/youtube-videos/'+encodeURIComponent(videoId),{method:'DELETE'});
    const result=await response.json();
    if (!response.ok || !result.success) throw new Error(typeof result.detail==='string'?result.detail:'영상 등록 정보를 삭제하지 못했습니다.');
    // Remove the deleted entry immediately, even if a later refresh fails.
    videoCatalog=videoCatalog.filter(item=>String(item.video_id)!==videoId);
    refreshLinkEditor();
    status.textContent='홈페이지 영상 등록 정보를 삭제했습니다. 경기·선수 기록과 YouTube 원본은 유지됩니다.';
    await loadFullVideos();
  } catch(error) {status.textContent=error.message;}
  finally {videoManagementBusy=false;showSelectedVideoMatch();}
});
document.getElementById('unlinkVideoMatch').addEventListener('click',()=>{
  document.getElementById('linkMatchSelect').value='';
  document.getElementById('videoLinkForm').requestSubmit();
});
loadMatchChoices();
loadFullVideos();

async function loadSavedAnalyses() {
  const list=document.getElementById('analysisList');
  list.replaceChildren();
  try {
    const response=await fetch('/api/admin/video-analyses',{cache:'no-store'});
    const result=await response.json();
    if(!response.ok||!result.success||!Array.isArray(result.data))throw Error('저장된 분석 목록을 불러오지 못했습니다.');
    for(const item of result.data) {
      const row=document.createElement('div');row.className='video-list-item';row.style.flexWrap='wrap';row.style.gap='12px';
      const link=document.createElement('a');link.style.flex='1 1 240px';link.style.minWidth='0';link.style.overflowWrap='anywhere';
      link.href='/feedback-review.html?analysis_id='+encodeURIComponent(item.analysis_id);
      const title=document.createElement('span');title.textContent=item.title;
      const formatTime=value=>Number.isInteger(value)?String(Math.floor(value/60)).padStart(2,'0')+':'+String(value%60).padStart(2,'0'):'미상';
      const rawDate=String(item.analyzed_at||'');
      const dateLabel=rawDate?rawDate.replace('T',' ').replace(/(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/,''):'날짜 미상';
      const detail=document.createElement('small');detail.style.display='block';detail.textContent='분석 #'+item.analysis_id+' · '+dateLabel+' · '+formatTime(item.start_seconds)+'–'+formatTime(item.end_seconds);
      const state=document.createElement('span');state.textContent=item.published?'게시됨 · 검수·수정':'검수 전 · 결과 보기';
      link.append(title,detail);row.append(link,state);
      const remove=document.createElement('button');remove.type='button';remove.textContent='삭제';remove.setAttribute('aria-label',item.title+' 분석 #'+item.analysis_id+' 삭제');
      remove.addEventListener('click',async()=>{
        const warning=item.published?'\n홈페이지에 공개된 이 분석의 피드백도 삭제됩니다. 이전에 게시한 다른 분석이 있으면 그 분석이 표시될 수 있습니다.':'';
        if(!confirm('‘'+item.title+'’ 분석 #'+item.analysis_id+'을 삭제할까요?\n'+detail.textContent+warning+'\n\n선택한 분석 결과와 코멘트만 삭제합니다. 등록 영상·경기·선수 기록·YouTube 원본은 유지됩니다.\n삭제 후 복구할 수 없습니다.'))return;
        remove.disabled=true;
        try{
          const response=await fetch('/api/admin/video-analyses/'+encodeURIComponent(item.analysis_id),{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({revision:item.review_revision,published:item.published})});
          const body=await response.json();
          if(!response.ok||!body.success)throw Error(typeof body.detail==='string'?body.detail:'분석 결과를 삭제하지 못했습니다.');
          row.remove();
          if(!list.children.length){const empty=document.createElement('p');empty.className='video-empty';empty.textContent='아직 저장된 분석이 없습니다.';list.append(empty);}
        }catch(error){alert(error.message);remove.disabled=false;}
      });
      row.append(remove);list.append(row);
    }
    if(!result.data.length){const empty=document.createElement('p');empty.className='video-empty';empty.textContent='아직 저장된 분석이 없습니다.';list.append(empty);}
  }catch(error){const message=document.createElement('p');message.textContent=error.message;list.append(message);}
}
loadSavedAnalyses();

});

