window.WGHAuthReady.then(identity=>{
 if(!identity.user||identity.user.consent_required)return;
 const el=id=>document.getElementById(id),params=new URLSearchParams(location.search);
 const state={catalog:[],tab:'full',query:'',page:1,selected:null,token:0,commentToken:0,before:null,loading:false};
 const time=n=>String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0');
 const node=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
 async function api(url,options={}){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);try{const r=await fetch(url,{...options,signal:controller.signal,cache:'no-store'});const b=await r.json();if(!r.ok||!b.success)throw Error(typeof b.detail==='string'?b.detail:'요청을 처리하지 못했습니다.');return b.data;}finally{clearTimeout(timer);}}
 function player(){return el(state.tab==='analysis'?'analysisPlayer':'fullPlayer');}
 function play(video,seconds=null){
  const p=player();if(!/^[A-Za-z0-9_-]{11}$/.test(video.youtube_id))return;
  const url=new URL('https://www.youtube.com/embed/'+video.youtube_id);url.searchParams.set('playsinline','1');url.searchParams.set('enablejsapi','1');url.searchParams.set('origin',location.origin);
  if(seconds!==null){url.searchParams.set('start',seconds);url.searchParams.set('autoplay','1');}
  p.src=url.toString();p.hidden=false;
  if(seconds!==null)p.scrollIntoView({behavior:'smooth',block:'center'});
 }
 function clearSelection(){state.selected=null;++state.token;++state.commentToken;state.before=null;for(const id of ['fullPlayer','analysisPlayer']){el(id).removeAttribute('src');el(id).hidden=true;}el('tvPlaybackPanel').hidden=true;el('fullPlaceholder').hidden=false;el('publishedSummary').textContent='';el('publishedComments').replaceChildren();el('publishedStatus').textContent='영상을 선택하면 분석 결과를 확인할 수 있습니다.';el('tvComments').hidden=true;el('tvCommentList').replaceChildren();}
 function filtered(){const q=state.query.toLocaleLowerCase('ko').replace(/\s+/g,'');return state.catalog.filter(v=>(state.tab!=='analysis'||v.has_published_analysis)&&(!q||String(v.title||'').toLocaleLowerCase('ko').replace(/\s+/g,'').includes(q)));}
 function render(){
  const list=el(state.tab==='analysis'?'analysisVideoList':'fullVideoList'),nav=el(state.tab==='analysis'?'analysisPages':'fullPages');list.replaceChildren();nav.replaceChildren();
  const rows=filtered(),pages=Math.max(1,Math.ceil(rows.length/10));state.page=Math.max(1,Math.min(state.page,pages));el('tvSearchStatus').textContent=rows.length+'개 영상';
  if(!rows.length)list.append(node('p',state.query?'검색 결과가 없습니다.':state.tab==='analysis'?'아직 게시된 분석 결과가 없습니다.':'등록된 경기 영상이 없습니다.','video-empty'));
  for(const v of rows.slice((state.page-1)*10,state.page*10)){
   const button=node('button',undefined,'video-list-item wgh-tv-card');button.type='button';button.setAttribute('aria-label',(v.title||'경기 영상')+' 선택');if(state.selected?.video_id===v.video_id)button.classList.add('selected');
   const thumb=node('span',undefined,'tv-card-thumbnail');if(/^[A-Za-z0-9_-]{11}$/.test(v.youtube_id)){const img=node('img');img.src='https://i.ytimg.com/vi/'+v.youtube_id+'/hqdefault.jpg';img.alt='';img.loading='lazy';img.width=480;img.height=270;img.addEventListener('error',()=>{img.hidden=true;});thumb.append(img);}thumb.append(node('span','▶','tv-card-play'));
   const copy=node('span',undefined,'tv-card-copy');copy.append(node('strong',v.title||'제목 없는 경기','tv-card-title'),node('span',v.match_date||'날짜 미등록','tv-card-meta'));button.append(thumb,copy);button.addEventListener('click',()=>select(v,true));list.append(button);
  }
  if(pages>1){const add=(label,p,disabled=false)=>{const b=node('button',label);b.type='button';b.disabled=disabled;if(p===state.page&&/^\d+$/.test(label))b.setAttribute('aria-current','page');b.addEventListener('click',()=>{state.page=p;render();el('tvSearch').focus();});nav.append(b);};add('이전',state.page-1,state.page===1);const numbers=[...new Set([1,pages,state.page-1,state.page,state.page+1].filter(n=>n>=1&&n<=pages))].sort((a,b)=>a-b);let last=0;for(const n of numbers){if(last&&n>last+1)nav.append(node('span','…'));add(String(n),n);last=n;}add('다음',state.page+1,state.page===pages);}
 }
 async function select(video,scroll=false){
  clearSelection();state.selected=video;const token=state.token;play(video);render();
  if(state.tab==='full'){el('tvPlaybackPanel').hidden=false;el('fullPlaceholder').hidden=true;el('tvNowPlaying').textContent=video.title||'경기 영상';el('tvComments').hidden=false;el('tvCommentStatus').textContent='';el('tvCommentContent').value='';el('tvCommentTime').value='';loadComments(false);}
  else{
   el('publishedStatus').textContent='분석 결과를 불러오는 중…';
   try{const data=await api('/api/youtube-videos/'+video.video_id+'/analysis');if(token!==state.token)return;if(!data){el('publishedStatus').textContent='게시된 분석 결과가 없습니다.';return;}el('publishedSummary').textContent=data.summary||'';el('publishedStatus').textContent='관리자 검수 완료 · AI 코멘트';for(const scene of data.scenes){const row=node('div',undefined,'published-comment'),jump=node('button',time(scene.time_seconds));jump.type='button';jump.addEventListener('click',()=>play(video,scene.time_seconds));row.append(jump,node('p',scene.comment));el('publishedComments').append(row);}}
   catch(e){if(token===state.token)el('publishedStatus').textContent=e.name==='AbortError'?'응답이 늦습니다. 카드를 다시 선택해 주세요.':e.message;}
  }
  if(scroll)player().scrollIntoView({behavior:'smooth',block:'center'});
 }
 function switchTab(tab){clearSelection();state.tab=tab;state.page=1;el('highlightPlayer').pause();for(const t of ['full','analysis','highlight']){el(t+'Tab').classList.toggle('active',t===tab);el(t+'Tab').setAttribute('aria-selected',String(t===tab));el(t+'Panel').hidden=t!==tab;}el('tvSearchForm').hidden=tab==='highlight';if(tab!=='highlight')render();}
 for(const t of ['full','analysis','highlight'])el(t+'Tab').addEventListener('click',()=>switchTab(t));el('tvClosePlayer').addEventListener('click',()=>{clearSelection();render();});
 el('tvSearchForm').addEventListener('submit',e=>{e.preventDefault();state.query=el('tvSearch').value.trim();state.page=1;render();});
 el('tvSearch').addEventListener('input',()=>{state.query=el('tvSearch').value.trim();state.page=1;render();});
 function seconds(value){if(!value.trim())return null;if(!/^\d{1,4}:[0-5]\d$/.test(value.trim()))throw Error('장면 시간은 분:초 형식으로 입력해 주세요.');const [m,s]=value.trim().split(':').map(Number);if(m*60+s>86400)throw Error('장면 시간이 너무 큽니다.');return m*60+s;}
 function formData(content,stamp){const text=content.trim();if(!text||text.length>1000)throw Error('댓글은 1~1000자로 입력해 주세요.');return {content:text,time_seconds:seconds(stamp)};}
 async function loadComments(more){
  if(!state.selected||state.tab!=='full')return;const id=state.selected.video_id,token=++state.commentToken;state.loading=true;el('tvCommentMore').disabled=true;el('tvCommentStatus').textContent='댓글을 불러오는 중…';
  try{const data=await api('/api/tv/videos/'+id+'/comments'+(more&&state.before?'?before='+state.before:''));if(token!==state.commentToken)return;if(!more)el('tvCommentList').replaceChildren();for(const item of data.items)commentRow(item,id);state.before=data.next_before;el('tvCommentMore').hidden=!state.before;el('tvCommentStatus').textContent=el('tvCommentList').children.length?'':'첫 댓글을 남겨 주세요.';}
  catch(e){if(token===state.commentToken)el('tvCommentStatus').textContent=e.name==='AbortError'?'댓글 응답이 늦습니다. 다시 불러오기를 눌러 주세요.':e.message;}
  finally{if(token===state.commentToken){state.loading=false;el('tvCommentMore').disabled=false;}}
 }
 function commentRow(item,videoId){
  const row=node('article',undefined,'tv-comment'),head=node('div',undefined,'tv-comment-head');const date=new Date(item.created_at);head.append(node('strong',item.author_name),node('small',Number.isNaN(date.getTime())?'':date.toLocaleString('ko-KR',{timeZone:'Asia/Seoul'})));
  if(item.time_seconds!==null){const jump=node('button',time(item.time_seconds));jump.type='button';jump.addEventListener('click',()=>{if(state.selected?.video_id===videoId)play(state.selected,item.time_seconds);});head.append(jump);}
  const body=node('p',item.content);row.append(head,body);
  if(item.can_edit){const edit=node('button','수정');edit.type='button';edit.addEventListener('click',()=>{if(row.querySelector('form'))return;const form=node('form'),text=node('textarea');text.maxLength=1000;text.required=true;text.value=item.content;text.setAttribute('aria-label','수정할 댓글');const stamp=node('input');stamp.placeholder='장면 시간 예: 03:25';stamp.value=item.time_seconds===null?'':time(item.time_seconds);stamp.setAttribute('aria-label','장면 시간');const save=node('button','저장');save.type='submit';const cancel=node('button','취소');cancel.type='button';cancel.addEventListener('click',()=>form.remove());form.append(text,stamp,save,cancel);form.addEventListener('submit',async e=>{e.preventDefault();try{const data={...formData(text.value,stamp.value),revision:item.revision};save.disabled=true;await api('/api/tv/videos/'+videoId+'/comments/'+item.comment_id,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});if(state.selected?.video_id===videoId)loadComments(false);}catch(e){alert(e.message);}finally{save.disabled=false;}});row.append(form);});row.append(edit);}
  if(item.can_delete){const remove=node('button','삭제');remove.type='button';remove.addEventListener('click',async()=>{if(!confirm('이 댓글을 삭제할까요?'))return;remove.disabled=true;try{await api('/api/tv/videos/'+videoId+'/comments/'+item.comment_id,{method:'DELETE'});if(state.selected?.video_id===videoId)loadComments(false);}catch(e){alert(e.message);remove.disabled=false;}});row.append(remove);}
  el('tvCommentList').append(row);
 }
 el('tvCommentForm').addEventListener('submit',async e=>{e.preventDefault();if(!state.selected)return;const id=state.selected.video_id,content=el('tvCommentContent'),stamp=el('tvCommentTime'),submit=el('tvCommentSubmit');try{const data=formData(content.value,stamp.value);submit.disabled=true;await api('/api/tv/videos/'+id+'/comments',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});if(state.selected?.video_id===id){content.value='';stamp.value='';loadComments(false);}}catch(e){el('tvCommentStatus').textContent=e.message;}finally{submit.disabled=false;}});
 el('tvCommentMore').addEventListener('click',()=>{if(!state.loading)loadComments(true);});el('tvCommentReload').addEventListener('click',()=>loadComments(false));
 async function load(){el('tvSearchStatus').textContent='영상 목록을 불러오는 중…';try{state.catalog=await api('/api/tv/catalog');const match=params.get('match_id');if(match!==null)state.catalog=state.catalog.filter(v=>String(v.match_id)===match).sort((a,b)=>String(a.title||'').localeCompare(String(b.title||''),'ko',{numeric:true})||a.video_id-b.video_id);switchTab(params.get('tab')==='analysis'?'analysis':'full');const wanted=params.get('video_id');const selected=filtered().find(v=>String(v.video_id)===wanted)||(match!==null&&state.tab==='full'?filtered()[0]:null);if(selected)select(selected);}catch(e){el('tvSearchStatus').textContent=e.name==='AbortError'?'목록 응답이 늦습니다. 다시 불러오기를 눌러 주세요.':e.message;}}
 el('tvReload').addEventListener('click',load);load();
});
