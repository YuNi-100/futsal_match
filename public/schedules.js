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
  async function load(){
    try{
      const response=await fetch('/api/schedules');
      const result=await response.json();
      if(!response.ok||!result.success||!Array.isArray(result.data))throw new Error('다음 경기 일정을 불러오지 못했습니다. 잠시 후 다시 확인해 주세요.');
      const schedules=[...result.data].sort((a,b)=>String(a.match_date).localeCompare(String(b.match_date))||String(a.start_time||'').localeCompare(String(b.start_time||''))||Number(a.schedule_id)-Number(b.schedule_id));
      document.getElementById('schedulePageCount').textContent=`예정 ${schedules.length}경기`;
      list.replaceChildren();
      if(!schedules.length){status.textContent='등록된 다음 경기 일정이 없습니다.';return;}
      schedules.forEach((schedule,index)=>{
        const card=node('article','detail-panel schedule-page-card');
        const header=node('div','schedule-page-header');
        const date=node('p','schedule-page-date',schedule.match_date);
        header.append(date,node('span','schedule-page-badge',index===0?'가장 가까운 경기':'예정 경기'));
        card.append(header,node('h3',null,`WGH vs ${schedule.opponent}`));
        const meta=node('dl','schedule-page-meta');
        for(const [label,value]of [['시간',`${time(schedule.start_time)} ~ ${time(schedule.end_time)}`],['장소',schedule.location||'장소 미정']]){
          const group=node('div');group.append(node('dt',null,label),node('dd',null,value));meta.append(group);
        }
        card.append(meta);
        if(schedule.memo)card.append(node('p','schedule-page-memo',schedule.memo));
        list.append(card);
      });
      status.hidden=true;
    }catch(error){status.textContent=error.message;}
  }
  window.addEventListener('wgh-record-created',event=>{if(event.detail.kind==='schedule')load();});
  load();
})();
