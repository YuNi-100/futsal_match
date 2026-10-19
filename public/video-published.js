window.WGHAuthReady.then(identity=>{
 if(!identity.user||identity.user.consent_required)return;
 const el=id=>document.getElementById(id);let catalog=[],selected=null,requestId=0;
 const time=seconds=>Math.floor(seconds/60).toString().padStart(2,'0')+':'+String(seconds%60).padStart(2,'0');
 async function load(){
  const token=++requestId;const id=el('analysisVideoSelect').value;const video=catalog.find(item=>String(item.video_id)===id);
  const list=el('publishedComments');list.replaceChildren();el('publishedSummary').textContent='';el('analysisPlayer').removeAttribute('src');el('analysisPlayer').hidden=true;
  if(!video){el('publishedStatus').textContent='영상을 선택해 주세요.';return;}
  el('publishedStatus').textContent='분석 결과를 불러오는 중…';
  const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),15000);
  try{const response=await fetch('/api/youtube-videos/'+encodeURIComponent(id)+'/analysis',{cache:'no-store',signal:controller.signal});const body=await response.json();if(token!==requestId)return;if(!response.ok||!body.success)throw Error('분석 결과를 불러오지 못했습니다. 로그인 상태를 확인해 주세요.');
   if(/^[A-Za-z0-9_-]{11}$/.test(video.youtube_id)){el('analysisPlayer').src='https://www.youtube.com/embed/'+video.youtube_id;el('analysisPlayer').hidden=false;}
   if(!body.data){el('publishedStatus').textContent='아직 검수 완료된 분석 결과가 없습니다.';return;}
   el('publishedSummary').textContent=body.data.summary||'';el('publishedStatus').textContent='관리자 검수 완료 · AI 코멘트';
   for(const scene of body.data.scenes){const row=document.createElement('div');row.className='published-comment';const jump=document.createElement('button');jump.type='button';jump.textContent=time(scene.time_seconds);jump.setAttribute('aria-label',time(scene.time_seconds)+' 장면 보기');
    
    
   jump.addEventListener('click', () => {

  // 1. 선택한 시간부터 자동 재생
  const player = el('analysisPlayer');

  player.src =
    'https://www.youtube.com/embed/' +
    video.youtube_id +
    '?start=' + scene.time_seconds +
    '&autoplay=1';

  // 2. 영상 플레이어가 보이도록 화면 이동
  player.scrollIntoView({
    behavior: 'smooth',
    block: 'center'
  });

});
    
    const comment=document.createElement('p');comment.textContent=scene.comment;row.append(jump,comment);list.append(row);}
  }
  catch(error){if(token===requestId)el('publishedStatus').textContent=error.name==='AbortError'?'응답이 늦어 결과를 불러오지 못했습니다. 영상을 다시 선택해 주세요.':error.message;}finally{clearTimeout(timeout);}
 }
 function show(){for(const name of ['full','highlight']){el(name+'Tab').classList.remove('active');el(name+'Tab').setAttribute('aria-selected','false');el(name+'Panel').hidden=true;}el('analysisTab').classList.add('active');el('analysisTab').setAttribute('aria-selected','true');el('analysisPanel').hidden=false;el('highlightPlayer').pause();const full=el('fullPlayer');if(full.getAttribute('src'))full.src=full.src;load();}
 el('analysisTab').addEventListener('click',show);el('analysisVideoSelect').addEventListener('change',load);
 window.addEventListener('wgh-view-video-selected',event=>{selected=String(event.detail.video_id);el('analysisVideoSelect').value=selected;});
 window.addEventListener('wgh-view-video-catalog',event=>{
  catalog=event.detail.videos;const select=el('analysisVideoSelect');select.replaceChildren(new Option('영상을 선택하세요',''));for(const video of catalog)select.add(new Option(video.match_date+' · '+video.title,String(video.video_id)));
  const params=new URLSearchParams(location.search);const wanted=params.get('video_id')||selected;
  if(catalog.some(video=>String(video.video_id)===wanted))select.value=wanted;else if(catalog.length)select.value=String(catalog[0].video_id);
  if(params.get('tab')==='analysis')show();
 });
});
