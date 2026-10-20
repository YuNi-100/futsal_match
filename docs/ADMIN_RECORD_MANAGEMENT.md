# 관리자 경기·선수 관리 복구

- 경기 목록/상세: 기존 수정·삭제 API에 관리자 버튼 연결. 수정창에 기존 참가 선수와 득점·도움 표시. 조회 실패 시 저장 차단. 영상 연결 유지.
- 선수 목록/상세: 이름·등번호·포지션·입단일 수정. 회원 연결은 기존 상세 화면에서 별도 관리.
- 선수 삭제: 출전 기록 또는 회원 연결이 있으면 409로 차단. 기존 경기 기록, 득점·도움 및 계정은 삭제하지 않음.
- 신규 PUT/DELETE /api/players/{player_id}: 관리자·이용동의·CSRF 검사. 수정은 기본 정보만 변경.
- 파일: public/navigation.js, matches.js, players.js, player.js, match-detail.js, style.css, main.py, src/api/player_management.py.
- DB 구조·데이터 변경 및 Git 커밋·Push 없음.
- 검증: tests/test_player_management.py (mock DB), tests/browser_record_admin.cjs (mock API), 기존 unit tests 및 browser_design_refresh.cjs, browser_match_video_creation.cjs 통과.
- 실행: main.py 변경으로 서버 재시작/자동 reload 필요. 화면 캐시가 남으면 Ctrl+F5.
