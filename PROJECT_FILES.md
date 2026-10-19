# WGH 프로젝트 파일 안내

실행하는 프로젝트: `C:\workspace\futsal_match`.
기존 FastAPI·MySQL·HTML/CSS/JavaScript 프로젝트를 유지한다.
코드 추가는 Git 커밋·Push나 원본 DB 적용을 의미하지 않는다.

## 이번 메뉴 정리에서 추가한 파일

| 파일 | 역할 |
|---|---|
| `public/navigation.js` | 사이드바의 여섯 메뉴와 이동 주소, 현재 메뉴 선택 상태를 공통 관리 |
| `public/schedules.html` | 다음 경기 일정 목록 페이지 |
| `public/schedules.js` | 기존 `/api/schedules`를 읽어 날짜·24시간 형식의 시간·상대팀·장소·메모 표시 |
| `PROJECT_FILES.md` | 이 파일. 프로젝트에서 사용하는 파일 역할 안내 |

다음 경기 페이지는 기존 일정을 조회한다. 기존 홈의 일정 등록·수정·삭제 동작은 유지한다.
페이지마다 따로 있던 메뉴를 `navigation.js`로 통일해 메뉴가 서로 달라지는 문제를 방지한다.
팀 소개는 기존 홈의 `#team` 영역으로 연결하고 통계는 홈 상단에 유지한다.

## 서버와 데이터 처리

| 파일 | 역할 |
|---|---|
| `main.py` | 서버 진입점. 경기·일정·선수 집계 API, 라우터 연결, 정적 파일 제공 |
| `auth.py`, `auth_store.py` | Google 로그인·세션·로그아웃·API 관리자 검사와 인증 DB 접근 |
| `manage_auth.py` | 서버에서만 실행하는 기존 계정 연결·관리자 승인·회수 도구 |
| `match_player_records.py` | 경기별 참가 선수·득점·도움 저장·조회 |
| `match_detail_routes.py` | 경기 상세 공개 조회 API |
| `player_detail_routes.py` | 선수 정보·누적 기록·출전 경기 조회 API |
| `youtube_videos.py`, `video_repository.py` | YouTube URL 등록·목록 API와 DB 접근 |
| `video_match_link.py` | 관리자의 기존 영상 경기 연결·변경·해제 API |
| `youtube_feedback.py` | Gemini 영상 구간 피드백 시범 기능 |
| `article_routes.py`, `article_generation.py` | 경기 기록 기반 기사 초안 시범 기능 |
| `requirements.txt` | 서버 실행에 필요한 Python 패키지 목록 |
| `.env` | DB 연결·Google 로그인·AI 비밀 설정. 내용은 공개하지 않음 |
| `.env.example` | 설정 항목 이름과 형식 예시. 실제 비밀값 없음 |

## 화면 파일

| 파일 | 역할 |
|---|---|
| `public/index.html`, `app.js`, `style.css` | 홈, 최근 경기 5개·통계·공지·선수 기록·일정 입력과 공통 디자인 |
| `public/matches.html`, `matches.js`, `matches.css` | 전체 경기 목록, 10개씩 페이지 이동 |
| `public/match.html`, `match-detail.js`, `match-detail.css` | 특정 경기 상세와 선수·영상 연결 |
| `public/players.html`, `players.js`, `players.css` | 별도 선수 목록 |
| `public/player.html`, `player.js`, `player.css` | 특정 선수 프로필·누적 기록·경기별 기록 |
| `public/video.html`, `video.js` | 로그인 회원용 영상 목록·재생 |
| `public/video-register.html`, `video-register.js` | 관리자 전용 영상 등록·경기 연결 관리·기존 AI 결과 목록 영역 |
| `public/video.css` | 기존 영상 페이지의 디자인을 두 페이지에서 공유 |
| `public/auth.js`, `auth.css` | 로그인 상태 표시·로그아웃·관리자 화면 표시·CSRF 헤더 처리 |
| `public/feedback.html`, `feedback.js` | Gemini 피드백 시범 화면 |
| `public/article.html` | 경기 기사 초안 시범 화면 |
| `public/images/` | 기존 WGH 로고·배경·이미지 |

## 검증·DB 준비·보관 파일

| 파일·폴더 | 역할 |
|---|---|
| `tests/test_*.py` | 서버 검증. 실제 DB 테스트는 별도 테스트 DB 설정으로 명시적으로 실행 |
| `tests/browser_*.cjs` | 가상 데이터를 이용한 브라우저 화면·이동 검증 |
| `migrations/001_google_auth.sql` | 인증용 테이블 4개를 추가하는 수동 적용 SQL. 자동 실행 안 함 |
| `AUTH_SETUP.md` | 로그인 설정·계정 연결·관리자 승인 절차 |
| `README.md` | 프로젝트 실행·기능 안내 |
| `main_backup.py`, `public/*_backup*` | 과거 보관 파일. 현재 페이지에서 사용하지 않으며 이번에 삭제하지 않음 |
| `legacy_node/` | 이전 Node.js 파일의 로컬 보관 |
| `uploads/` | 기존 로컬 영상 파일·목록. 소스 정리 대상으로 삭제하지 않음 |
| `.venv/`, `.venv-1/`, `__pycache__/` | 가상환경·실행 캐시. 실제 사용 환경 확인 없이 삭제하지 않음 |

## 테스트 후 원본 DB 복구 시 주의

현재 검증 대상은 `futsaldb_test`이며 원본은 `futsaldb`다.
원본에 필요한 인증 테이블과 경기 시간 NULL 허용 변경은 사용자 승인을 받은 뒤 별도로 적용한다.
전환할 때 `.env`의 `DB_NAME`과 터미널의 `$env:DB_NAME`을 함께 확인하고 서버를 재시작한다.
테스트 DB에서 확인한 계정 연결·관리자 권한이 원본에 자동 복사되는 것은 아니다.
기존 데이터와 백업은 보존하고 사용자 승인 없이 커밋·Push하지 않는다.

## 기존 파일 내 관리자 등록 기능

새 파일 없이 navigation.js에 공통 등록창을 추가했다. 경기 기록·선수 정보·다음 경기 페이지의 관리자 추가 버튼과 홈의 선수 등록 버튼이 사용한다. main.py의 POST /api/players는 이름·등번호·포지션·입단일을 저장하며 중복 등번호는 409로 거부한다. 등록 후 각 목록을 다시 조회한다. 홈의 기존 경기·일정 등록창은 유지한다.

## 선수 회원 연결·비회원 영상 제한

- 새 파일 `migrations/002_player_accounts.sql`: 선수-회원 일대일 연결 테이블 추가용. 기존 테이블 변경 없음.
- 기존 `main.py`, `auth_store.py`: 관리자 회원 목록, 선수 등록 시 연결, 기존 선수 연결·해제 API와 세션의 선수 회원 표시.
- 기존 `auth.py`, `main.py`: 비회원 영상 페이지·YouTube/로컬 영상 API 차단. 일반·선수·관리자 회원은 영상 조회 가능.
- 기존 `match_detail_routes.py`: 비회원 경기 상세에 영상 주소·YouTube ID를 반환하지 않음.
- 기존 `navigation.js`, `player.html`, `player.js`, `auth.js`: 등록창의 회원 선택, 기존 선수의 회원 연결 관리, 선수 회원 상태 표시.
- 회원 정보 선택 목록은 관리자 전용이며 공개 선수 정보에 회원 이메일을 포함하지 않는다.
- 연결해도 관리자 권한을 부여하지 않는다. 한 회원과 한 선수만 연결 가능하다.
- 현재 적용은 테스트 DB에만 수행하며 기존 선수·회원 연결은 자동 추정하거나 변경하지 않는다.

## 내 페이지 및 관리자 승인
- public/account.html, account.js, account.css: 로그인 안내, 최초 동의, 내 정보·연결 선수, 관리자 신청과 처리 화면.
- account_routes.py: 본인 정보 조회, 동의 저장, 관리자 신청·승인·반려·권한 해제 및 처리 이력.
- migrations/003_account_management.sql: 동의·신청·처리 이력 테이블 추가. 기존 데이터 변경 없음.
- 승인 작업은 기존 관리자만 가능하며 마지막 관리자 해제를 차단합니다. 원본 DB 전환은 별도 승인 후 진행합니다.

## 영상 조회·등록 페이지 분리

영상 조회는 기존 회원 로그인·동의 정책을 유지한다. 관리자만 조회 페이지의 영상 등록·관리 버튼으로 별도 페이지를 열 수 있다. video-register.html 직접 접근도 서버에서 검사하며 비로그인 401, 비관리자 또는 동의 미완료 403으로 차단하고 폼을 내려주지 않는다. 기존 등록 API와 연결 API의 관리자·CSRF 검사는 유지한다. AI 분석 결과 목록은 기존 준비 영역을 옮긴 것이며 새 분석 기능을 구현한 것은 아니다. 경기 기록 추가는 기존 홈·경기 목록의 등록창을 유지하고 별도 경기 등록 페이지는 생성하지 않았다.

## 영상 등록 우선과 경기 등록 시 영상 선택

영상 등록·AI 카드가 첫 번째이고 사후 연결·해제 관리는 그 아래에 있다. 공통 경기 추가 팝업은 기존 등록 영상 중 미연결 영상을 선택해 경기·선수 기록과 같은 트랜잭션에서 연결한다. 다른 경기에 연결된 영상은 선택을 막으며 서버도 409로 거부한다. 영상 조회 실패 시 연결 없이 등록할 수 있고 사후 관리에서 연결한다. 기존 경기 수정은 영상 연결을 임의 변경하지 않으며 사후 관리의 연결 저장·연결 해제 버튼을 사용한다. 스키마 변경은 없다.

## 홈페이지 영상 삭제

관리자 영상 등록·관리의 기존 영상 선택 후 홈페이지 영상 삭제 버튼을 사용한다. 확인창에는 제목·분석 자료 삭제·경기와 선수 기록 및 YouTube 원본 보존을 표시한다. DELETE /api/youtube-videos/{video_id}는 공통 관리자·CSRF 검사를 거쳐 futsal_video의 해당 WGH 행만 삭제한다. 현재 DB의 기존 CASCADE 규칙에 따라 해당 영상의 분석 자료도 삭제될 수 있다. 경기·match_player·선수 데이터에는 삭제 쿼리를 실행하지 않는다. 원본 YouTube에는 요청하지 않는다.
