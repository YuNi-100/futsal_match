(() => {
  const list=document.getElementById('playerDirectory');
  const status=document.getElementById('playersStatus');
  const positions={GK:'골키퍼',FIXO:'픽소',ALA:'아라',PIVO:'피보'};
  const node=(tag,className,text)=>{
    const element=document.createElement(tag);
    if(className)element.className=className;
    if(text!==undefined)element.textContent=String(text);
    return element;
  };
  async function load(){
    try{
      const response=await fetch('/api/players');
      const result=await response.json();
      if(!response.ok||!result.success||!Array.isArray(result.data))throw new Error('선수 목록을 불러오지 못했습니다. 잠시 후 다시 확인해 주세요.');
      document.getElementById('playersCount').textContent=`전체 ${result.data.length}명`;
      list.replaceChildren();
      if(!result.data.length){status.textContent='등록된 선수가 없습니다.';return;}
      for(const player of result.data){
        const card=node('a','player-item');
        card.href='/player.html?player_id='+encodeURIComponent(player.player_id);
        card.setAttribute('aria-label',player.player_name+' 선수 정보 보기');
        const info=node('div','player-info');
        info.append(node('div','player-number',player.back_number),node('strong','player-name',player.player_name),node('span','player-position',positions[player.position]||player.position));
        const stats=node('div','player-stats');
        for(const [label,value] of [['출전',player.appearances],['득점',player.goals],['도움',player.assists]]){
          const stat=node('div','player-stat');stat.append(node('span',null,label),node('strong',null,value));stats.append(stat);
        }
        card.append(info,stats);list.append(card);
      }
      status.hidden=true;
    }catch(error){status.textContent=error.message;}
  }
  load();
})();
