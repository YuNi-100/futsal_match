(() => {
  const list = document.getElementById('allMatchList');
  const status = document.getElementById('matchesStatus');
  const pagination = document.getElementById('matchPagination');
  const pageSize = 10;
  let matches = [];
  const filter = document.getElementById('leagueFilter');
  const filterValue = () => new URLSearchParams(location.search).get('league') || '';
  const filteredMatches = () => matches.filter(match => !filterValue() || (filterValue()==='unassigned' ? match.league_id==null : String(match.league_id)===filterValue()));
  function node(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }
  function requestedPage() {
    const value = new URLSearchParams(location.search).get('page');
    return value && /^[1-9]\d*$/.test(value) ? Number(value) : 1;
  }
  function pageLink(label, page, disabled, current = false) {
    const link = node(disabled ? 'span' : 'a', 'matches-page-link', label);
    if (disabled) link.setAttribute('aria-disabled','true');
    else {
      const url = new URL(location.href);
      url.searchParams.set('page',page);
      link.href = url.pathname + url.search;
      link.addEventListener('click', event => {
        if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        history.pushState(null,'',link.href);
        render();
        document.querySelector('.matches-heading').scrollIntoView({block:'start'});
      });
    }
    if (current) link.setAttribute('aria-current','page');
    return link;
  }
  function render() {
      const shown = filteredMatches();
      filter.value=filterValue();
      document.getElementById('matchCount').textContent = filterValue()?`검색 ${shown.length}경기 · 전체 ${matches.length}경기`:`전체 ${matches.length}경기`;
      const totalPages = Math.max(1, Math.ceil(shown.length / pageSize));
      const page = Math.min(requestedPage(),totalPages);
      if (page !== requestedPage()) {
        const url = new URL(location.href); url.searchParams.set('page',page);
        history.replaceState(null,'',url.pathname + url.search);
      }
      list.replaceChildren();
      pagination.replaceChildren();
      pagination.hidden = shown.length <= pageSize;
      list.hidden = shown.length === 0;
      if (!shown.length) {
        status.hidden = false;
        status.textContent = filterValue()?'선택한 리그의 경기 기록이 없습니다.':'아직 등록된 경기 기록이 없습니다.';
        return;
      }
      pagination.append(pageLink('이전',page-1,page===1));
      const visible = new Set([1,totalPages,...Array.from({length:5},(_,i)=>page-2+i).filter(n=>n>=1&&n<=totalPages)]);
      let previous=0;
      for (const number of [...visible].sort((a,b)=>a-b)) {
        if (number>previous+1) pagination.append(node('span','matches-page-gap','…'));
        pagination.append(pageLink(String(number),number,false,number===page));
        previous=number;
      }
      pagination.append(pageLink('다음',page+1,page===totalPages));

      for (const match of shown.slice((page-1)*pageSize,page*pageSize)) {
        const card = node('article','match-card');
        const date = node('div','match-date');
        const league=node('div','record-match-league');
        if(match.league_name)league.append(node('span','league-badge',`[${match.league_name}]`));
        date.append(node('span',null,match.match_date));
        const teams = node('div','match-teams');
        const team=node('strong',null,match.team_name||'WGH 은평');team.dataset.teamName='';
        teams.append(team,node('span','match-score',`${match.our_score} : ${match.opponent_score}`),node('strong',null,match.opponent));
        const location = node('div','match-location','📍 ' + (match.location || '장소 미정'));
        location.title=match.location||'장소 미정';
        const resultLabels = {win:'승',draw:'무',lose:'패'};
        const resultClass = Object.hasOwn(resultLabels,match.result) ? match.result : '';
        const badge = node('div','match-result ' + resultClass,resultLabels[match.result] || '미등록');
        const link = node('a','match-detail-link');
        link.href = '/match.html?match_id=' + encodeURIComponent(match.match_id);
        link.setAttribute('aria-label',`${match.match_date} ${match.team_name||'WGH 은평'} 대 ${match.opponent} 경기 상세 보기`);
        card.append(league,date,teams,location,badge,link,window.WGHRecordActions('match',match,load));
        list.append(card);
      }
      status.hidden = true;
  }
  window.addEventListener('popstate',render);
  filter.addEventListener('change',()=>{
    const url=new URL(location.href);url.searchParams.delete('page');
    if(filter.value)url.searchParams.set('league',filter.value);else url.searchParams.delete('league');
    history.pushState(null,'',url.pathname+url.search);render();
  });
  async function refreshFilters(){
    try{
      const response=await fetch('/api/leagues');const result=await response.json();
      if(!response.ok||!result.success||!Array.isArray(result.data))throw new Error();
      const options=new Map(result.data.map(league=>[String(league.league_id),league.name]));
      for(const match of matches)if(match.league_id!=null)options.set(String(match.league_id),match.league_name||'기존 리그');
      const current=filterValue();
      if(current&&current!=='unassigned'&&!options.has(current))options.set(current,'선택한 리그');
      filter.replaceChildren(new Option('전체',''),new Option('미지정','unassigned'));
      for(const [id,name] of options)filter.add(new Option(name,id));
      filter.value=current;filter.disabled=false;
    }catch(_){filter.disabled=true;}
  }
  async function load() {
    try {
      const response = await fetch('/api/matches');
      const result = await response.json();
      if (!response.ok || !result.success || !Array.isArray(result.data)) throw new Error('경기 기록을 불러오지 못했습니다. 잠시 후 다시 확인해 주세요.');
      matches = [...result.data].sort((a,b)=>String(b.match_date).localeCompare(String(a.match_date)) || Number(b.match_id)-Number(a.match_id));
       await refreshFilters();
      render();
    } catch(error) {
      status.textContent = error.message;
    }
  }
  window.addEventListener('wgh-record-created',event=>{if(event.detail.kind==='match')load();});
  window.addEventListener('wgh-club-changed',load);
  window.addEventListener('wgh-leagues-changed',event=>{
    if(event.detail?.deletedLeagueId!=null&&filterValue()===String(event.detail.deletedLeagueId)){
      const url=new URL(location.href);url.searchParams.delete('league');url.searchParams.delete('page');
      history.replaceState(null,'',url.pathname+url.search);render();
    }
    refreshFilters();
  });
  load();
})();

