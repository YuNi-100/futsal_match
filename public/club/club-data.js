/* 모든 인물·상대팀·점수·일정·소식은 화면 확인용 가상 예시입니다. */
window.WGH_DEMO = {
 players: [
  {id:1,name:'김하늘',number:7,position:'ALA',intro:'넓은 시야로 연결하는 플레이'},
  {id:2,name:'이서연',number:10,position:'PIVO',intro:'기회를 놓치지 않는 마무리'},
  {id:3,name:'박지우',number:11,position:'ALA',intro:'측면에서 만드는 새로운 흐름'},
  {id:4,name:'최유진',number:5,position:'FIXO',intro:'든든하게 지키는 우리의 중심'},
  {id:5,name:'정다은',number:8,position:'ALA',intro:'멈추지 않는 움직임과 연결'},
  {id:6,name:'윤수아',number:1,position:'GOLEIRO',intro:'골문 앞에서 보내는 믿음'},
  {id:7,name:'한예린',number:9,position:'PIVO',intro:'끝까지 집중하는 한 걸음'},
  {id:8,name:'오채원',number:3,position:'FIXO',intro:'한발 먼저 읽는 수비'}
 ],
 matches:[
  {id:108,date:'2026-10-11',opponent:'FC NOVA',our:4,their:2,location:'서울 루프탑 풋살파크',memo:'측면 패스와 빠른 전환을 연습한 친선 경기입니다.',goals:[2,1,3,2],assists:[1,3,5],appearances:[1,2,3,4,5,6,7,8]},
  {id:107,date:'2026-10-04',opponent:'BLUE WAVE',our:2,their:2,location:'은평 풋살파크',memo:'마지막까지 집중하며 함께 뛰었던 경기입니다.',goals:[1,7],assists:[5],appearances:[1,2,3,4,5,6,7]},
  {id:106,date:'2026-09-27',opponent:'TEAM ORBIT',our:3,their:1,location:'서울 루프탑 풋살파크',memo:'짧은 패스 연결과 수비 간격을 점검했습니다.',goals:[2,3,5],assists:[1,4],appearances:[1,2,3,4,5,6,8]},
  {id:105,date:'2026-09-20',opponent:'FC NOVA',our:1,their:3,location:'마포 풋살센터',memo:'상대 압박에 대응하는 움직임을 확인했습니다.',goals:[2],assists:[3],appearances:[1,2,3,4,6,7,8]},
  {id:104,date:'2026-09-13',opponent:'RISING FC',our:5,their:2,location:'은평 풋살파크',memo:'다양한 선수들이 공격에 함께 참여했습니다.',goals:[1,2,3,5,7],assists:[2,1,4,3],appearances:[1,2,3,4,5,6,7,8]},
  {id:103,date:'2026-09-06',opponent:'BLUE WAVE',our:2,their:0,location:'서울 루프탑 풋살파크',memo:'팀 전체가 수비에 집중한 경기입니다.',goals:[2,1],assists:[5],appearances:[1,2,3,4,5,6,8]},
  {id:102,date:'2026-08-30',opponent:'TEAM ORBIT',our:3,their:2,location:'마포 풋살센터',memo:'서로를 응원하며 끝까지 뛰었습니다.',goals:[3,1,2],assists:[1,2],appearances:[1,2,3,4,6,7,8]},
  {id:101,date:'2026-08-23',opponent:'RISING FC',our:1,their:1,location:'은평 풋살파크',memo:'새로운 호흡을 맞춰 본 친선 경기입니다.',goals:[7],assists:[1],appearances:[1,2,3,4,5,6,7]}
 ],
 schedules:[
  {id:201,date:'2026-10-18',start:'20:00',end:'22:00',opponent:'BLUE WAVE',location:'서울 루프탑 풋살파크',memo:'19:40 집결 · 파란색 유니폼'},
  {id:202,date:'2026-10-25',start:'19:00',end:'21:00',opponent:'TEAM ORBIT',location:'은평 풋살파크',memo:'18:40 집결 · 개인 물통 준비'},
  {id:203,date:'2026-11-01',start:'20:00',end:'22:00',opponent:'RISING FC',location:'마포 풋살센터',memo:'19:40 집결 · 파란색 유니폼'}
 ],
 videos:[
  {id:1,title:'패스로 연결하고, 함께 마무리하다',date:'2026-10-11',matchId:108,type:'highlight',duration:'00:12',art:'blue'},
  {id:2,title:'한발 먼저, 함께 만드는 수비',date:'2026-10-04',matchId:107,type:'training',duration:'00:12',art:'green'},
  {id:3,title:'우리의 움직임을 돌아보는 시간',date:'2026-09-27',matchId:106,type:'full',duration:'00:12',art:'pink'}
 ],
 news:[
  {id:1,category:'공지',date:'2026-10-15',title:'이번 주 경기, 준비물과 집결 안내',subtitle:'경기 전 함께 확인해 주세요.',body:['이번 주 친선 경기 일정의 예시 공지입니다. 날짜와 장소는 실제 운영 일정이 아닙니다.','파란색 유니폼과 풋살화, 개인 물통을 준비하고 시작 20분 전까지 모이는 상황을 가정했습니다. 실제 팀 공지로 교체해 사용하세요.'],art:'notice'},
  {id:2,category:'팀 이야기',date:'2026-10-12',title:'승패 너머에 남는, 함께한 순간들',subtitle:'같이 뛰고 같이 성장하는 우리.',body:['경기 결과뿐 아니라 함께 뛴 순간도 기록하는 공간입니다. 이 글은 디자인 확인용 예시입니다.','실제 경기 후 팀의 이야기와 사진을 넣어 주세요. 사진을 올리기 전 촬영자와 등장 인물의 공개 동의를 확인하세요.'],art:'story'},
  {id:3,category:'트레이닝',date:'2026-10-08',title:'다음 패스를 만드는 작은 움직임',subtitle:'우리의 훈련 노트를 채워 가요.',body:['훈련에서 확인한 내용을 짧게 정리하는 예시 게시물입니다.','패스를 받은 뒤 어디로 움직였는지, 동료가 공을 받을 공간이 있었는지 함께 돌아보는 글로 활용할 수 있습니다. 실제 경기 분석 결과는 아닙니다.'],art:'training'}
 ]
};
