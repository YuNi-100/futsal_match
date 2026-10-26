(() => {
  const status=document.getElementById('schedulePageStatus');
  const list=document.getElementById('schedulePageList');
  function node(tag,className,text){
    const el=document.createElement(tag);
    if(className)el.className=className;
    if(text!==undefined)el.textContent=String(text);
    return el;
  }
  function time(value){return value?String(value).slice(0,5):'시간 미정';}
  function actions(schedule){
    const bar=node('div','schedule-page-actions');bar.dataset.adminOnly='';
    const edit=node('button','edit-schedule-button','수정');edit.type='button';edit.dataset.wghCreate='schedule';edit.dataset.scheduleEdit=JSON.stringify(schedule);
    const remove=node('button','delete-schedule-button','삭제');remove.type='button';
    remove.addEventListener('click',async()=>{
      if(!document.documentElement.classList.contains('wgh-admin')||remove.disabled)return;
      if(!confirm('이 경기 일정을 삭제하시겠습니까?\n삭제한 일정은 복구할 수 없습니다.'))return;
      remove.disabled=true;
      try{
        const response=await fetch('/api/schedules/'+encodeURIComponent(schedule.schedule_id),{method:'DELETE'});
        const result=await response.json();
        if(!response.ok||result.success===false)throw new Error(typeof result.detail==='string'?result.detail:'경기 일정을 삭제하지 못했습니다.');
        await load();
      }catch(error){alert(error.message);}finally{remove.disabled=false;}
    });
    bar.append(edit,remove);return bar;
  }
  async function load(){
    try{
      const response=await fetch('/api/schedules');
      const result=await response.json();
      if(!response.ok||!result.success||!Array.isArray(result.data))throw new Error('다음 경기 일정을 불러오지 못했습니다. 잠시 후 다시 확인해 주세요.');
      const schedules=[...result.data].sort((a,b)=>String(a.match_date).localeCompare(String(b.match_date))||String(a.start_time||'').localeCompare(String(b.start_time||''))||Number(a.schedule_id)-Number(b.schedule_id));
      document.getElementById('schedulePageCount').textContent=`예정 ${schedules.length}경기`;
      list.replaceChildren();
      status.hidden=false;
      if(!schedules.length){status.textContent='등록된 다음 경기 일정이 없습니다.';return;}
      let compactList;
      schedules.forEach((schedule,index)=>{
        if(index>0){
          if(!compactList){
            compactList=node('div','schedule-compact-list');
            list.append(compactList);
          }
          const item=node('details','schedule-compact-item');
          const summary=node('summary','schedule-compact-summary');
          const opponent=node('strong','schedule-compact-opponent');
          const ownTeam=node('span',null,window.WGHClub.teamName);ownTeam.dataset.teamName='';opponent.append(ownTeam,` vs ${schedule.opponent}`);
          summary.append(node('span','schedule-compact-date',schedule.match_date),opponent,node('span','schedule-compact-location',schedule.location||'장소 미정'));
          const content=node('div','schedule-compact-content');
          const meta=node('dl','schedule-page-meta');
          for(const [label,value] of [['시간',`${time(schedule.start_time)} ~ ${time(schedule.end_time)}`],['메모',schedule.memo||'등록된 메모가 없습니다.']]){
            const group=node('div');group.append(node('dt',null,label),node('dd',null,value));meta.append(group);
          }
          content.append(meta,actions(schedule));item.append(summary,content);compactList.append(item);
          return;
        }
        const card=node('article','detail-panel schedule-page-card');
        const header=node('div','schedule-page-header');
        const date=node('p','schedule-page-date',schedule.match_date);
        header.append(date,node('span','schedule-page-badge',index===0?'가장 가까운 경기':'예정 경기'));
        const title=node('h3');const ownTeam=node('span',null,window.WGHClub.teamName);ownTeam.dataset.teamName='';title.append(ownTeam,` vs ${schedule.opponent}`);card.append(header,title);
        const meta=node('dl','schedule-page-meta');
        for(const [label,value]of [['시간',`${time(schedule.start_time)} ~ ${time(schedule.end_time)}`],['장소',schedule.location||'장소 미정']]){
          const group=node('div');group.append(node('dt',null,label),node('dd',null,value));meta.append(group);
        }
        card.append(meta);
        if(schedule.memo)card.append(node('p','schedule-page-memo',schedule.memo));
        card.append(actions(schedule));
        list.append(card);
      });
      status.hidden=true;
    }catch(error){status.textContent=error.message;}
  }
  window.addEventListener('wgh-record-created',event=>{if(event.detail.kind==='schedule')load();});
  window.addEventListener('wgh-club-changed',load);
  window.WGHClub.ready.then(load);
})();
