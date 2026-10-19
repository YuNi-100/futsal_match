(() => {
  const list = document.getElementById('allMatchList');
  const status = document.getElementById('matchesStatus');
  const pagination = document.getElementById('matchPagination');
  const pageSize = 10;
  let matches = [];
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
      const totalPages = Math.max(1, Math.ceil(matches.length / pageSize));
      const page = Math.min(requestedPage(),totalPages);
      if (page !== requestedPage()) {
        const url = new URL(location.href); url.searchParams.set('page',page);
        history.replaceState(null,'',url.pathname + url.search);
      }
      list.replaceChildren();
      pagination.replaceChildren();
      pagination.hidden = matches.length <= pageSize;
      list.hidden = matches.length === 0;
      if (!matches.length) {
        status.hidden = false;
        status.textContent = '아직 등록된 경기 기록이 없습니다.';
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

      for (const match of matches.slice((page-1)*pageSize,page*pageSize)) {
        const card = node('article','match-card');
        const date = node('div','match-date',match.match_date);
        const teams = node('div','match-teams');
        teams.append(node('strong',null,'WGH'),node('span','match-score',`${match.our_score} : ${match.opponent_score}`),node('strong',null,match.opponent));
        const location = node('div','match-location','📍 ' + (match.location || '장소 미정'));
        const resultLabels = {win:'승',draw:'무',lose:'패'};
        const resultClass = Object.hasOwn(resultLabels,match.result) ? match.result : '';
        const badge = node('div','match-result ' + resultClass,resultLabels[match.result] || '미등록');
        const link = node('a','match-detail-link');
        link.href = '/match.html?match_id=' + encodeURIComponent(match.match_id);
        link.setAttribute('aria-label',`${match.match_date} WGH 대 ${match.opponent} 경기 상세 보기`);
        card.append(date,teams,location,badge,link,window.WGHRecordActions('match',match,load));
        list.append(card);
      }
      status.hidden = true;
  }
  window.addEventListener('popstate',render);
  async function load() {
    try {
      const response = await fetch('/api/matches');
      const result = await response.json();
      if (!response.ok || !result.success || !Array.isArray(result.data)) throw new Error('경기 기록을 불러오지 못했습니다. 잠시 후 다시 확인해 주세요.');
      matches = [...result.data].sort((a,b)=>String(b.match_date).localeCompare(String(a.match_date)) || Number(b.match_id)-Number(a.match_id));
      document.getElementById('matchCount').textContent = `전체 ${matches.length}경기`;
      render();
    } catch(error) {
      status.textContent = error.message;
    }
  }
  window.addEventListener('wgh-record-created',event=>{if(event.detail.kind==='match')load();});
  load();
})();
