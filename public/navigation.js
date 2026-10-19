/* Shared WGH sidebar. Change labels and URLs here instead of editing every page. */
(() => {
  const menu=document.querySelector('.side-menu');
  if (!menu) return;
  const entries=[
    {key:'home',icon:'⌂',label:'홈',href:'/index.html'},
    {key:'matches',icon:'▣',label:'경기 기록',href:'/matches.html'},
    {key:'players',icon:'♙',label:'선수 정보',href:'/players.html'},
    {key:'schedules',icon:'▦',label:'다음 경기',href:'/schedules.html'},
    {key:'team',icon:'♧',label:'팀 소개',href:'/index.html#team'},
    {key:'video',icon:'▶',label:'경기 영상',href:'/video.html'}
  ];
  const filename=location.pathname.split('/').pop()||'index.html';
  function activeKey(){
    if(filename==='index.html') return location.hash==='#team'?'team':'home';
    return {'matches.html':'matches','match.html':'matches','players.html':'players','player.html':'players','schedules.html':'schedules','video.html':'video'}[filename];
  }
  function render(){
    const active=activeKey();
    menu.replaceChildren();
    for(const item of entries){
      const link=document.createElement('a');
      link.className='menu-item'+(item.key===active?' active':'');
      link.href=item.href;
      if(item.key===active)link.setAttribute('aria-current','page');
      const icon=document.createElement('span');icon.className='menu-icon';icon.textContent=item.icon;
      const label=document.createElement('span');label.textContent=item.label;
      link.append(icon,label);menu.append(link);
    }
  }
  render();
  window.addEventListener('hashchange',render);
})();
