(() => {
 const el=id=>document.getElementById(id);let busy=false;
 const parse=value=>{if(!/^\d{1,4}:[0-5]\d$/.test(value.trim()))throw Error('분석 시간을 분:초로 입력해 주세요.');const [m,s]=value.trim().split(':').map(Number);return m*60+s;};
 function options(videos){const select=el('analysisVideo');const previous=select.value;select.replaceChildren(new Option('영상을 선택하세요',''));for(const video of videos)select.add(new Option(video.match_date+' · '+video.title,String(video.video_id)));if(videos.some(video=>String(video.video_id)===previous))select.value=previous;}
 window.addEventListener('wgh-video-catalog',event=>options(event.detail.videos));
 el('analysisForm').addEventListener('submit',async event=>{
  event.preventDefault();if(busy)return;let start,end;
  try{start=parse(el('analysisStart').value);end=parse(el('analysisEnd').value);if(end<=start||end-start>1800)throw Error('분석 구간은 1초~30분으로 입력해 주세요.');}catch(error){el('analysisStatus').textContent=error.message;return;}
  const payload={team_color:el('analysisTeam').value.trim(),start_seconds:start,end_seconds:end,consent:el('analysisConsent').checked};const videoId=el('analysisVideo').value;
  if(!videoId||!payload.team_color||!payload.consent)return;
  busy=true;el('analysisForm').querySelectorAll('input,select,button').forEach(control=>control.disabled=true);el('analysisStatus').textContent='분석 중… 수 분이 걸릴 수 있습니다. 이 창을 유지해 주세요.';
  try{const response=await fetch('/api/youtube-videos/'+encodeURIComponent(videoId)+'/feedback',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});const body=await response.json();if(!response.ok||!body.success)throw Error(typeof body.detail==='string'?body.detail:'분석에 실패했습니다.');location.href='/feedback-review.html?analysis_id='+encodeURIComponent(body.data.analysis_id);}
  catch(error){el('analysisStatus').textContent=error.message+' 재실행 전 사용 내역을 확인해 주세요.';}finally{busy=false;el('analysisForm').querySelectorAll('input,select,button').forEach(control=>control.disabled=false);}
 });
})();
