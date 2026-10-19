(() => {
 const el=id=>document.getElementById(id);
 const id=new URLSearchParams(location.search).get('analysis_id');
 let result=null,busy=false;
 const time=seconds=>Math.floor(seconds/60).toString().padStart(2,'0')+':'+String(seconds%60).padStart(2,'0');
 function seconds(value){if(!/^\d{1,4}:[0-5]\d$/.test(value.trim()))throw Error('시간을 분:초로 입력하세요. 예: 01:07');const [m,s]=value.trim().split(':').map(Number);return m*60+s;}
 function jump(at){if(!result||!Number.isInteger(at)||at<0)return;el('reviewPlayer').src='https://www.youtube.com/embed/'+result.youtube_url.split('v=')[1]+'?start='+at;}
 function addScene(scene,original){
  const row=document.createElement('div');row.className='review-row';
  const head=document.createElement('div');head.className='review-row-head';
  const input=document.createElement('input');input.className='scene-time';input.value=time(scene.time_seconds);input.setAttribute('aria-label','장면 시간 (분:초)');input.required=true;
  const play=document.createElement('button');play.type='button';play.textContent='장면 보기';play.addEventListener('click',()=>{try{jump(seconds(input.value));}catch(error){el('reviewStatus').textContent=error.message;}});
  const remove=document.createElement('button');remove.type='button';remove.className='remove-scene';remove.textContent='삭제';remove.addEventListener('click',()=>{if(!busy)row.remove();});
  head.append(input,play,remove);
  const comment=document.createElement('textarea');comment.className='scene-comment';comment.rows=2;comment.maxLength=1000;comment.required=true;comment.value=scene.comment;comment.setAttribute('aria-label','게시할 짧은 코멘트');row.append(head,comment);
  if(original){const details=document.createElement('details');const title=document.createElement('summary');title.textContent='AI 원문';details.append(title);for(const key of ['observation','comment','next_action'])if(original[key]){const line=document.createElement('p');line.textContent=original[key];details.append(line);}row.append(details);}
  el('reviewScenes').append(row);
 }
 function setBusy(value){busy=value;el('reviewForm').querySelectorAll('button,input,textarea').forEach(control=>control.disabled=value);}
 function render(data){
  result=data;const review=data.review||{};
  el('reviewVideoTitle').textContent=data.title;el('reviewRange').textContent='분석 구간 '+time(data.start_seconds)+' ~ '+time(data.end_seconds);
  el('reviewSummary').value=review.summary??data.analysis.summary;
  el('reviewState').textContent=review.publication?'게시됨 · 수정 후 검수 완료 시 반영':'검수 전';
  el('reviewScenes').replaceChildren();
  for(const scene of review.scenes||data.analysis.scenes){const original=data.analysis.scenes.find(item=>item.time_seconds===scene.time_seconds);addScene(scene,original);}
  el('publishedLink').href='/video.html?video_id='+encodeURIComponent(data.video_id)+'&tab=analysis';
  el('reviewContent').hidden=false;jump(data.start_seconds);
 }
 el('addReviewScene').addEventListener('click',()=>{if(!busy&&el('reviewScenes').children.length<24)addScene({time_seconds:result.start_seconds,comment:''});});
 el('reviewForm').addEventListener('submit',async event=>{
  event.preventDefault();if(busy||!result)return;
  let scenes;
  try{scenes=[...el('reviewScenes').children].map(row=>({time_seconds:seconds(row.querySelector('input').value),comment:row.querySelector('textarea').value.trim()}));if(!scenes.length)throw Error('게시할 코멘트를 하나 이상 남겨 주세요.');if(scenes.some(scene=>!scene.comment||scene.time_seconds<result.start_seconds||scene.time_seconds>=result.end_seconds))throw Error('코멘트와 분석 구간 안의 시간을 확인해 주세요.');}
  catch(error){el('reviewStatus').textContent=error.message;return;}
  const publish=event.submitter?.dataset.publish==='true';setBusy(true);el('reviewStatus').textContent='저장 중…';
  try{
   const response=await fetch('/api/admin/video-analyses/'+id+'/review',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({revision:result.review?.revision||0,summary:el('reviewSummary').value.trim(),scenes,publish})});
   const body=await response.json();if(!response.ok||!body.success)throw Error(typeof body.detail==='string'?body.detail:'검수 내용을 저장하지 못했습니다.');
   render(body.data);el('reviewStatus').textContent=publish?'검수 완료. 선수 화면의 분석 결과에 게시했습니다.':'임시 저장했습니다. 선수 화면의 게시 내용은 유지됩니다.';
  }catch(error){el('reviewStatus').textContent=error.message;}finally{setBusy(false);}
 });
 window.WGHAuthReady.then(async identity=>{
  if(identity.user?.role!=='admin'||identity.user.consent_required){el('reviewStatus').textContent='관리자 로그인과 이용 동의가 필요합니다.';return;}
  if(!/^\d+$/.test(id||'')){el('reviewStatus').textContent='분석 결과를 목록에서 선택해 주세요.';return;}
  try{const response=await fetch('/api/admin/video-analyses/'+id,{cache:'no-store'});const body=await response.json();if(!response.ok||!body.success)throw Error('분석 결과를 불러오지 못했습니다.');render(body.data);el('reviewStatus').textContent='원본을 확인하고 시간·코멘트를 수정한 뒤 검수 완료를 눌러 주세요.';}
  catch(error){el('reviewStatus').textContent=error.message;}
 });
})();
