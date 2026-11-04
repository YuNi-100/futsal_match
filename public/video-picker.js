/* Shared, additive video selection. Existing links change only on an explicit save. */
window.WGHVideoPicker = class {
  constructor(host,{dateInput=null,matchId=null,onEdit=null}={}) {
    host._videoPicker?.destroy();
    this.host=host;this.dateInput=dateInput;this.matchId=matchId;this.onEdit=onEdit;
    this.catalog=[];this.matches=[];this.selected=new Set();this.ready=false;this.busy=false;
    this.abort=new AbortController();this.build();
    dateInput?.addEventListener('change',()=>this.render(),{signal:this.abort.signal});
  }
  node(tag,text){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;}
  build(){
    const h=this.host;h.replaceChildren();h.classList.add('wgh-video-picker');h._videoPicker=this;
    const tools=this.node('div');tools.className='vp-tools';
    this.search=this.node('input');this.search.type='search';this.search.placeholder='제목·상대팀·날짜 검색';this.search.setAttribute('aria-label','연결할 영상 검색');
    this.search.addEventListener('input',()=>this.render());
    const include=this.node('label');this.include=this.node('input');this.include.type='checkbox';
    this.include.addEventListener('change',()=>this.render());include.append(this.include,this.node('span','다른 경기에 연결된 영상 포함'));
    this.reload=this.node('button','새로 불러오기');this.reload.type='button';this.reload.addEventListener('click',()=>this.load());
    tools.append(this.search,include,this.reload);
    this.count=this.node('p');this.count.setAttribute('role','status');
    this.current=this.node('div');this.current.className='vp-current';
    this.list=this.node('div');this.list.className='vp-list';
    this.all=this.node('button','표시된 영상 모두 선택');this.all.type='button';
    this.all.addEventListener('click',()=>{for(const v of this.visible||[])this.selected.add(Number(v.video_id));this.render();});
    this.clear=this.node('button','선택 취소');this.clear.type='button';this.clear.addEventListener('click',()=>{this.selected.clear();this.render();});
    const actions=this.node('div');actions.className='vp-actions';actions.append(this.all,this.clear);
    h.append(tools,this.count,this.current,actions,this.list);this.render();
  }
  async load(){
    const token=this.token=Symbol();this.ready=false;this.selected.clear();this.render();
    try{
      const responses=await Promise.all([fetch('/api/youtube-videos',{cache:'no-store'}),fetch('/api/matches',{cache:'no-store'})]);
      const data=await Promise.all(responses.map(r=>r.json()));
      if(responses.some(r=>!r.ok)||data.some(d=>!d.success||!Array.isArray(d.data)))throw Error('영상 목록을 불러오지 못했습니다. 새로 불러오기를 눌러 주세요.');
      if(this.token!==token)return;
      this.setData(data[0].data,data[1].data);
    }catch(e){if(this.token!==token)return;this.error=e.message;this.render();}
  }
  setData(videos,matches){this.catalog=videos;this.matches=matches;this.selected.clear();this.ready=true;this.error='';this.render();}
  setMatch(id){this.matchId=id==null?null:Number(id);this.selected.clear();this.render();}
  matchLabel(id){const m=this.matches.find(m=>Number(m.match_id)===Number(id));return m?`${m.match_date} · ${m.team_name||'WGH 은평'} vs ${m.opponent}`:'경기 #'+id;}
  row(v,current=false){
    const row=this.node('div');row.className='vp-row';
    const label=this.node('label'),check=this.node('input');check.type='checkbox';check.value=v.video_id;check.checked=this.selected.has(Number(v.video_id));check.disabled=this.busy;
    check.addEventListener('change',()=>{if(check.checked)this.selected.add(Number(v.video_id));else this.selected.delete(Number(v.video_id));this.render();});
    const copy=this.node('span'),title=this.node('strong',v.title);copy.append(title);
    const detail=v.match_id==null?'미연결':current?'현재 경기에 연결됨':'연결: '+this.matchLabel(v.match_id);
    copy.append(this.node('small',v.match_date+' · '+detail));label.append(check,copy);row.append(label);
    if(this.onEdit){const edit=this.node('button','개별 관리');edit.type='button';edit.disabled=this.busy;edit.addEventListener('click',()=>this.onEdit(v));row.append(edit);}
    return row;
  }
  render(){
    const query=(this.search.value||'').toLocaleLowerCase('ko').replace(/\s+/g,'');
    const matchesQuery=v=>!query||`${v.title} ${v.match_date} ${v.match_id==null?'':this.matchLabel(v.match_id)}`.toLocaleLowerCase('ko').replace(/\s+/g,'').includes(query);
    const isCurrent=v=>this.matchId!=null&&Number(v.match_id)===Number(this.matchId);
    const current=this.catalog.filter(isCurrent).sort((a,b)=>a.title.localeCompare(b.title,'ko',{numeric:true}));
    this.current.replaceChildren();this.current.hidden=!current.length;
    if(current.length){this.current.append(this.node('h4',`현재 경기 연결 영상 · ${current.length}개`));for(const v of current)this.current.append(this.row(v,true));}
    const sameDate=this.dateInput?.value;
    const rows=this.catalog.filter(v=>!isCurrent(v)&&matchesQuery(v)&&(v.match_id==null||(this.include.checked&&Boolean(query))));
    rows.sort((a,b)=>(Number(b.match_date===sameDate)-Number(a.match_date===sameDate))||String(b.match_date).localeCompare(String(a.match_date))||a.title.localeCompare(b.title,'ko',{numeric:true})||a.video_id-b.video_id);
    this.visible=rows;this.list.replaceChildren();
    let lastDate=null;
    for(const v of rows){if(v.match_date!==lastDate){lastDate=v.match_date;this.list.append(this.node('h4',lastDate+(lastDate===sameDate?' · 경기 날짜':'')));}this.list.append(this.row(v));}
    if(!rows.length&&this.ready)this.list.append(this.node('p',query?'검색 결과가 없습니다.':'선택 가능한 미연결 영상이 없습니다.'));
    const hiddenSelected=[...this.selected].filter(id=>!rows.some(v=>Number(v.video_id)===id)&&!current.some(v=>Number(v.video_id)===id)).length;
    this.count.textContent=this.ready?`${this.selected.size}개 선택 · ${rows.length}개 표시${hiddenSelected?' · 검색 밖 선택 '+hiddenSelected+'개':''}`:(this.error||'영상 목록을 불러오는 중…');
    if(this.ready&&this.include.checked&&!query)this.count.textContent+=' · 다른 경기 영상은 검색어를 입력하면 표시됩니다.';
    this.all.disabled=this.busy||!this.ready||!rows.length;this.clear.disabled=this.busy||!this.selected.size;
    this.reload.disabled=this.busy;this.search.disabled=this.busy;this.include.disabled=this.busy;
  }
  links(){if(!this.ready)throw Error('영상 목록을 먼저 불러와 주세요.');return this.catalog.filter(v=>this.selected.has(Number(v.video_id))).map(v=>({video_id:Number(v.video_id),expected_match_id:v.match_id==null?null:Number(v.match_id)}));}
  confirmMoves(target){const moved=this.links().filter(v=>v.expected_match_id!=null&&v.expected_match_id!==target);return !moved.length||confirm(`${moved.length}개 영상을 기존 경기에서 ${target==null?'새 경기':this.matchLabel(target)}로 옮길까요?\n\n${moved.map(v=>this.catalog.find(r=>Number(r.video_id)===v.video_id).title+'\n기존: '+this.matchLabel(v.expected_match_id)).join('\n')}`);}
  setBusy(value){this.busy=value;this.render();}
  destroy(){this.abort.abort();this.token=null;}
};
