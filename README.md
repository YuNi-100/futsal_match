# WGH Futsal Match · We Go High

여자 풋살 클럽 위고하이의 경기·선수 기록·일정·영상과 검수된 AI 피드백을 관리하는 웹 서비스입니다.

- [서비스](https://futsal-match-theta.vercel.app/) · [GitHub](https://github.com/YuNi-100/futsal_match)
- 문서 기준: 2026-10-19. 실제 코드·최종 승인 대화·Notion 기획서 내보내기 대조

## 목차

- [01. 프로젝트 개요 및 개발 목적](#section-01)
- [02. 기능정의서](#section-02)
- [03. 화면구성도 및 화면별 설계](#section-03)
- [04. DB 설계 및 ERD](#section-04)
- [05. 데이터 수집 방법](#section-05)
- [06. 개발 환경 및 기술 스택](#section-06)
- [07. 설치 및 실행 방법](#section-07)
- [08. PostgreSQL SQL 파일 생성·복원 방법](#section-08)
- [09. OpenAI·Gemini API 설정 방법](#section-09)
- [10. 기능별 테스트 체크리스트](#section-10)
- [11. 오류 수정 내역 및 테스트 결과](#section-11)
- [12. 이용 조건 및 자료 출처](#section-12)

<a id="section-01"></a>

## 01. 프로젝트 개요 및 개발 목적

풋살을 시작한 후 팀원들과 함께 경기를 뛰면서 매주 2~3회 경기 영상을 촬영하고 있습니다. 하지만 촬영한 영상을 개인적으로 보관하기에는 파일 용량이 너무 크고, 팀원들에게 매번 영상을 공유하는 과정도 번거로웠습니다. 이러한 불편함을 겪으면서 단순히 유튜브 링크를 공유하는 것보다 경기 영상과 일정, 선수 기록을 한곳에서 확인하고, AI를 활용한 경기 분석과 피드백까지 받을 수 있다면 좋겠다는 생각을 하게 되었습니다. 이러한 경험을 바탕으로 WGH(We Go High) 풋살팀을 위한 경기 기록 및 AI 영상 분석 웹사이트를 개발하게 되었습니다. 이 프로젝트는 팀원들이 경기 영상과 기록을 편리하게 공유하고, AI 분석을 통해 함께 경기를 돌아보며 성장할 수 있는 공간을 만드는 것을 목표로 합니다.

주요 사용자는 팀 운영자, 경기 기록 담당자와 선수입니다. 사용자 조사나 정량 성과 검증 전의 기획 방향입니다.

기획서: [We Go High 풋살 매치 프로젝트](https://observant-stranger-324.notion.site/We-Go-High-3f29f6b6a113808a9648d904ab20c6fe)

공개 원문과 제공된 Notion 내보내기를 대조했습니다. 팀 브랜딩과 일정·선수 정보의 통합 관리, 실제 팀 활동 자료 활용을 반영했습니다. 기술 구성과 기능은 현재 코드·최종 승인 사항을 기준으로 정리했습니다.

### 초기 기획에서 완성된 내용

| 초기 기획서 | 현재 프로젝트 |
| --- | --- |
| Node.js / Express + MySQL | FastAPI + Supabase PostgreSQL, Vercel 배포 |
| 한 페이지에서 일정·선수 정보 조회 | 홈, 경기 목록·상세, 선수 목록·상세, 다음 경기, WGH TV로 확장 |
| 선수·경기 연결은 향후 확장 | match_player로 참가 선수·득점·도움 저장 및 누적 기록 연결 |
| 경기 결과·선수 기록 관리 확장 예정 | 관리자 등록·수정·삭제와 상세 조회 구현 |
| 팀 로고·손글씨·사진·선수 카드 | 기존 브랜딩 유지, 상단 메뉴·등번호 유니폼 카드·반응형 화면 반영 |

실제 팀 일정·선수·출전 기록을 공식 기록으로 관리합니다. 팀 이미지는 브랜딩에, YouTube 영상과 검수된 AI 코멘트는 경기 복기에 활용합니다. 회원 연결·변경·해제, 선수 회원·관리자 권한 분리, 비회원 영상 제한을 구현했습니다.

<a id="section-02"></a>

## 02. 기능정의서

| No. | 구분 | 기능명 | 기능 설명 | 동작 / 결과 | 상태 |
| --- | --- | --- | --- | --- | --- |
| 01 | 메인 | 홈·브랜딩 | 기존 로고·메인 사진·손글씨·색감 유지 | 홈 접속 시 팀 이미지 표시 | ✅ 완료 |
| 02 | 메인 | 경기 통계 | 전체 경기·승무패·승률·득실점 집계 | 경기 기록 변경 후 통계 반영 | ✅ 완료 |
| 03 | 메인 | 최근 경기 | 최근 5경기를 흰 카드로 표시 | 카드 전체 클릭 시 해당 경기 상세 이동 | ✅ 완료 |
| 04 | UI | 상단 메뉴 | 6개 메뉴·로그인 상태·내 페이지 | 현재 메뉴 활성화·페이지 이동 | ✅ 완료 |
| 05 | 경기 | 경기 목록 | 날짜·팀·점수·장소·결과 정렬 | 10개 단위 페이지 이동 | ✅ 완료 |
| 06 | 경기 | 기록 등록 | 날짜·상대팀·장소·점수·메모 입력 | 관리자 저장 후 DB 반영 | ✅ 완료 |
| 07 | 경기 | 참가 선수 기록 | 경기별 참가·득점·도움 입력 | 선수 누적 기록과 연결 | ✅ 완료 |
| 08 | 경기 | 기록 수정·삭제 | 관리자만 수정·삭제 허용 | 해당 경기 집계·선수 기록 갱신 | ✅ 완료 |
| 09 | 경기 | 경기 상세 | 메모·장소·선수·득점·도움·영상 표시 | 목록에서 선택한 경기 확인 | ✅ 완료 |
| 10 | 선수 | 선수 목록·카드 | 줄무늬 유니폼·등번호·이름 표시 | 카드 전체 클릭 시 선수 상세 이동 | ✅ 완료 |
| 11 | 선수 | 선수 상세 | 프로필·누적 기록·출전 경기 조회 | 경기 상세·해당 영상으로 이동 | ✅ 완료 |
| 12 | 선수 | 선수 관리 | 관리자 등록·수정·삭제 | 기록·회원 연결 선수 삭제 제한 | ✅ 완료 |
| 13 | 선수 | 회원 연결 | Google 회원과 선수 연결·변경·해제 | 선수 회원 표시·관리자 권한 별도 | ✅ 완료 |
| 14 | 일정 | 다음 경기 | 가장 가까운 일정은 큰 카드 | 이후 일정은 날짜·상대팀·장소 목록 | ✅ 완료 |
| 15 | 일정 | 시간·메모 펼치기 | 클릭한 일정 안에서 상세 표시 | 목록과 펼친 정보를 한 항목으로 표현 | ✅ 완료 |
| 16 | 일정 | 시간 입력·검증 | 24시간제·2000을 20:00으로 변환 | 종료 시간이 시작 시간보다 늦어야 저장 | ✅ 완료 |
| 17 | 일정 | 일정 관리 | 관리자 등록·수정·삭제 | 일정 정보 DB 저장·재조회 | ✅ 완료 |
| 18 | 인증 | Google 로그인 | OAuth·12시간 세션·로그아웃 | 회원 상태 유지·만료 검사 | ✅ 완료 |
| 19 | 권한 | 관리자 API 보호 | 서버 권한 검사·CSRF 검증 | 비관리자의 변경 요청 차단 | ✅ 완료 |
| 20 | 영상 | 회원 전용 시청 | 로그인 회원의 목록·임베드 재생 | 비회원 안내·영상 API 접근 차단 | ✅ 완료 |
| 21 | 영상 | 수동 영상 관리 | YouTube 링크 등록·삭제 | 중복 ID 방지·원본 YouTube는 유지 | ✅ 완료 |
| 22 | 영상 | 경기 연결 | 등록 시 선택·나중에 연결·해제 | 경기 기록과 영상 양방향 이동 | ✅ 완료 |
| 23 | AI | 분석 요청 | 등록과 분리된 Gemini 최대 30분 분석 | 관리자가 요청할 때만 실행·결과 저장 | ✅ 완료 |
| 24 | AI | 검수·게시 | 요약·시간·코멘트 편집·임시 저장 | 검수 완료 결과를 회원 화면에 게시 | ✅ 완료 |
| 25 | AI | 코멘트 시간 이동 | 시간별 코멘트와 영상 위치 연결 | 같은 화면에서 영상 이동·재생 요청 | ✅ 완료 |
| 26 | 자동화 | 영상 검색·등록 | 공개 채널 날짜·키워드 검색 | 기존 등록·삭제 이력 고려 | ✅ 완료 |
| 27 | 자동화 | 로컬 예약 | 수·토 18시 Asia/Seoul | 로컬 Codex 실행 환경 필요 | ⚙️ 로컬 구성 |
| 28 | DB | PostgreSQL 이전 | MySQL 완성 데이터를 Supabase로 이전 | 데이터 대조·기존 원본 및 백업 보존 | ✅ 완료 |
| 29 | 배포 | Vercel 배포 | FastAPI·보호 HTML·정적 자산 제공 | 운영 주소·Google 콜백 연결 | ✅ 완료 |
| 30 | UI | 반응형 | PC·태블릿·모바일 크기별 CSS | 브라우저 검증·실기기 전체 점검 남음 | ⚙️ 반영·추가 점검 |
| 31 | 후속 | 클라우드 예약 | PC와 독립된 예약·삭제 이력 영속화 | 별도 구현 필요 | ⏳ 후속 |
| 32 | 후속 | 하이라이트 제작 | 실제 영상 자동 편집·출력 | 사용량 사유로 보류 | ⏸ 보류 |

비회원은 경기·선수·일정을 조회할 수 있습니다. 영상 시청은 로그인이 필요하며, 등록·수정·삭제·분석·검수는 관리자 전용입니다. 선수 회원에게 관리자 권한이 자동 부여되지는 않습니다.

### 최종 승인한 동작

| 항목 | 확정한 동작 |
| --- | --- |
| 디자인 | 기존 로고·메인 사진·파란색·파스텔 색감 유지, 상단 메뉴·로그인·내 페이지 배치 |
| 홈 배치 | 메인 사진 → 통계 → 최근 경기 → 다음 경기·팀 공지 → 선수 카드 순서 유지 |
| 경기 이동 | 홈 최근 경기 카드 클릭 시 선택 경기 상세 이동·경기 기록 메뉴 활성화 |
| 경기 목록 | 홈의 흰 카드 디자인과 별도로, 경기 기록 페이지는 간결한 목록과 10개 단위 페이지 이동 |
| 경기 입력 | 경기 등록·수정의 시간 입력 제외. 일정은 24시간제 HH:MM, 2000 입력 시 20:00 변환 |
| 선수 이동 | 홈 선수 카드 전체와 참가 선수 이름은 선수 상세로, 득점 기록의 영상 연결은 해당 경기 영상으로 이동 |
| 선수 디자인 | 파랑·검정 줄무늬 유니폼에 등번호·이름 표시 |
| 다음 경기 | 이후 일정의 목록·펼친 정보를 한 항목으로 표시 |
| 관리자 버튼 | 경기·선수·다음 경기의 수정·삭제는 작고 차분한 텍스트 형태로 통일 |
| 영상 등록·분석 | 수동 등록·AI 분석 분리. 영상 등록 시 유료 AI 자동 실행 없음 |
| 분석 공개 | 검수 완료한 결과를 회원용 분석 결과에 게시. 시간 클릭 시 같은 페이지의 영상으로 이동·재생 |
| DB 기준 | 완성된 futsaldb_test 기준 이전. 기존 futsaldb 보존 |

메뉴는 홈 / 경기 기록 / 선수 정보 / 다음 경기 / WGH TV / 팀 소개입니다. 팀 소개는 홈의 연결 영역이며, 팀 공지는 정적 콘텐츠입니다. 공지 관리 API는 미구현 상태입니다.

<a id="section-03"></a>

## 03. 화면구성도 및 화면별 설계

### 전체 화면 구성도

```text
상단 메뉴 · 로그인 · 내 페이지
├── 홈: Hero → 통계 → 최근 5경기 → 다음 경기·공지 → 선수 카드
├── 경기 기록: 10개씩 목록 → 선택 경기 상세 → 선수·영상 연결
├── 선수 정보: 유니폼 카드 목록 → 프로필·누적 기록·출전 경기
├── 다음 경기: 가장 가까운 일정 큰 카드 → 이후 일정 펼치기
├── WGH TV: 경기 영상 / 분석 결과 / 하이라이트(제작 보류)
│   └── 관리자: 영상 등록·관리 → AI 분석 → 결과 검수·게시
└── 팀 소개: 홈 연결 영역
```

| 화면 | 파일 | 주요 동작 |
| --- | --- | --- |
| 홈 | `public/index.html` | 통계·최근 경기·일정·공지·선수 카드 |
| 경기 목록·상세 | `public/matches.html`, `match.html` | 페이지 이동·관리자 수정/삭제·선수/영상 연결 |
| 선수 목록·상세 | `public/players.html`, `player.html` | 유니폼 카드·누적 기록·출전 경기 |
| 다음 경기 | `public/schedules.html` | 가까운 일정 강조·시간/메모 펼치기·관리 |
| 회원 영상 | `public/video.html` | 영상 선택 재생·게시 분석·시간별 코멘트 |
| 영상 등록·관리 | `public/video-register.html` | 관리자 수동 등록·분석 요청·연결/해제 |
| 분석 검수 | `public/feedback-review.html` | 요약·시간·코멘트 수정·검수 완료 게시 |
| 내 페이지 | `public/account.html` | 로그인 회원 정보·동의·권한 관련 기능 |

아래 사진은 제공된 Notion 내보내기의 **초기 개발 화면**입니다. 현재 상단 메뉴·유니폼 카드와 차이가 있으며, 디자인 변화의 기록으로 활용합니다. 현재 기능은 위 기능정의서 기준입니다.

### 홈과 팀 브랜딩

![초기 홈 화면: WGH 로고·손글씨·메인 사진·통계](docs/images/planning/home-original.png)

기존 팀 이미지·색감을 유지하고 상단 메뉴를 개편했습니다. 홈은 메인 이미지 → 통계 → 최근 경기 → 다음 경기·공지 → 선수 카드 순서입니다.

### 최근 경기 · 다음 경기

![초기 최근 경기 카드와 다음 경기·공지](docs/images/planning/matches-schedule-original.png)

홈의 흰 경기 카드 디자인을 유지했습니다. 경기 목록은 10개 단위로 표시하며, 다음 경기 화면은 가장 가까운 일정만 큰 카드로 보여줍니다.

### 경기 기록 등록 · 일정 등록

| 경기 기록 등록 — 초기 화면 | 일정 등록 — 초기 화면 |
| --- | --- |
| ![경기 결과 입력 팝업](docs/images/planning/match-form-original.png) | ![일정과 24시간 입력 팝업](docs/images/planning/schedule-form-original.png) |

경기 기록은 날짜·상대팀·점수·메모·참가 선수·연결 영상을 관리합니다. 시작·종료 시간은 일정 등록에서만 입력합니다.

### 선수 정보

![초기 선수 카드: 원형 등번호와 누적 기록](docs/images/planning/players-original.png)

현재 선수 카드는 파랑·검정 줄무늬 유니폼에 등번호·이름을 표시합니다. 선수 상세와 경기·영상 기록으로 연결됩니다.

<a id="section-04"></a>

## 04. DB 설계 및 ERD

운영 DB는 Supabase PostgreSQL의 `wgh` 스키마입니다. 아래 ERD는 핵심 관계이며, 전체 17개 테이블·제약조건은 [운영 스키마 SQL](migrations/postgresql/001_wgh_schema.sql) 기준입니다.

관계 설명과 연결선을 구분하기 쉽도록 두 도표를 가로 방향으로 배치했습니다. 두 도표에 반복되는 이름은 같은 테이블입니다.

### 경기·선수 기록 관계

```mermaid
erDiagram
    direction LR
    app_user ||--o{ futsal_match : 등록
    futsal_match ||--o{ match_player : 기록
    futsal_player ||--o{ match_player : 참가
```

### 영상·AI 분석 관계

```mermaid
erDiagram
    direction LR
    app_user ||--o{ futsal_video : 등록
    futsal_match o|--o{ futsal_video : 연결
    futsal_video ||--o{ video_analysis : 분석
    video_analysis ||--o{ video_event : 장면
```

### 주요 테이블

| 테이블 | 주요 키·필드 | 역할 |
| --- | --- | --- |
| app_user | user_id PK, email | 회원 |
| futsal_player | player_id PK, back_number UNIQUE | 선수·등번호·포지션 |
| futsal_match | match_id PK, user_id FK | 완료 경기·날짜·점수·장소·메모 |
| match_player | match_player_id PK, match_id/player_id FK, 경기·선수 쌍 UNIQUE | 참가·득점·도움, 선수와 경기 다대다 연결 |
| futsal_schedule | schedule_id PK, match_date, start_time/end_time | 다음 경기 일정 |
| futsal_video | video_id PK, match_id FK(선택), youtube_id UNIQUE | 영상 메타데이터·경기 연결 |
| video_analysis / video_event | analysis_id / event_id PK, 상위 자료 FK | 분석·시간별 장면 |
| wgh_google_identity / wgh_user_role | google_sub / user_id | Google 계정 연결·역할 |
| wgh_login_session / wgh_oauth_state | token_hash / state_hash | 세션·일회성 OAuth 검증 |
| wgh_account_consent / wgh_admin_request / wgh_role_history | 회원 연결·신청·이력 키 | 동의·관리자 신청·권한 이력 |
| wgh_player_account | 선수·회원 연결 키 | 선수 회원 연결 |
| player | player_id PK | 이전 데이터 보존용 구 테이블 |

경기 입력 화면에는 시간 필드가 없습니다. DB의 `futsal_match.start_time/end_time`은 남아 있는 필드이며, 일정 입력 시간과는 별개입니다.

### 삭제·연결 정책

- 경기 등록 시 기존 영상 선택, 영상 등록 시 기존 경기 선택 가능. 나중에 연결하거나 해제 가능
- 경기 삭제 시 해당 경기의 선수별 기록 삭제·집계 반영, 연결된 영상 보존 후 경기 연결 해제
- 홈페이지 영상 삭제 시 경기 결과·선수 득점·도움 유지. 영상에 종속된 분석 자료 함께 삭제, YouTube 원본 보존
- YouTube 삭제·비공개 영상의 임베드 재생 제한 가능. 공식 경기 기록 자동 삭제 없음
- 기록·회원 연결이 있는 선수 삭제 제한
- AI 코멘트는 검수용 피드백. 공식 경기 점수·선수 기록 자동 변경 없음

### 초기 설계 자료

![초기 ERD — 현재 운영 스키마가 아님](docs/images/planning/erd-original.png)

위 이미지는 선수·경기를 독립 관리하던 초기 ERD입니다. 현재는 `match_player`와 FK로 연결하며, 최종 구조는 SQL 파일 기준입니다. RLS·스키마 접근 제한과 FastAPI 권한 검사를 적용했습니다. DB 비밀번호는 서버에서만 사용합니다.

<a id="section-05"></a>

## 05. 데이터 수집 방법

| 데이터 | 수집·입력 방법 | 활용 |
| --- | --- | --- |
| 경기·일정 | 실제 팀 활동 기록을 관리자 입력 | 결과·다음 경기·통계 |
| 선수·참가·득점·도움 | 팀 선수 정보와 경기 후 기록 입력 | 선수 상세·누적 기록 |

수요일·토요일 오후 6시(Asia/Seoul) 검색은 **로컬 Codex 예약 작업**입니다. 로컬 실행 환경이 필요하며, Vercel 배포만으로 클라우드 예약이 생성되지는 않습니다. 실행 명령은 `python youtube_sync.py --apply`입니다.

동일 YouTube ID는 중복 등록에서 제외하며, 삭제 영상의 재등록 방지 이력은 `.wgh-sync/`에 보관합니다. 검색 범위는 공개 피드로, 과거 영상 전체 수집은 보장되지 않습니다. 일부공개 영상은 링크로 수동 등록합니다.

**실제 하이라이트 영상 자동 제작은 보류 상태**입니다. 하이라이트 탭만 구성되어 있습니다. OpenAI 기사 초안과 기존 로컬 영상 API는 별도 시범 코드입니다.

<a id="section-06"></a>

## 06. 개발 환경 및 기술 스택

```text
브라우저 · HTML/CSS/JavaScript
    → Vercel · FastAPI
        → Supabase · PostgreSQL (wgh 스키마)
        → Google OAuth · 로그인
        → YouTube · 원본 영상/임베드
        → Gemini · 관리자 요청 시 영상 분석
```

Python 3.14·FastAPI·Uvicorn·Pydantic·psycopg와 HTML/CSS/JavaScript를 사용합니다. 기존 MySQL에서 Supabase PostgreSQL로 전환을 완료했으며, 현재 운영 DB로 사용합니다. 기존 MySQL 연결은 호환·복구용입니다. 인증은 Google OAuth·서버 세션 방식으로, Supabase Auth는 사용하지 않습니다. 서비스 실행에 Node.js는 필요하지 않습니다.

DB 접속 정보와 AI 키는 서버에서만 사용합니다. 브라우저의 Supabase Data API 직접 접근은 사용하지 않습니다. 운영 `wgh` 스키마에는 RLS·접근 권한 제한을 적용했습니다.

| 구분 | 기술·도구 | 용도 |
| --- | --- | --- |
| 개발·버전 관리 | VS Code·Git·GitHub | 코드 작성·변경 관리 |
| 화면 | HTML5·CSS3·JavaScript | 레이아웃·상호작용·API 호출 |
| 서버 | Python 3.14·FastAPI·Uvicorn·Pydantic | API·입력 검증·페이지 제공 |
| DB | Supabase PostgreSQL·psycopg | 현재 운영 데이터 |
| 호환 | PyMySQL | 이전·복구용 MySQL 연결 및 오류 호환 |
| 인증 | Google OAuth·서버 세션·CSRF | 로그인·권한 보호 |
| AI | Google Gen AI SDK·OpenAI SDK | 영상 분석·선택 기사 초안 |
| 배포 | Vercel·uv·build_vercel.py | 의존성 고정·FastAPI 배포 |
| 검증 | unittest·Playwright 브라우저 스크립트 | 서버·화면 검증 |

Python 코드는 `src/`, 설명 문서는 `docs/`에 정리했습니다. 루트 `main.py`와 CLI 연결 파일은 기존 실행 명령·Vercel·Docker 설정을 유지합니다.

파일별 역할은 [PROJECT_FILES.md](docs/PROJECT_FILES.md), 정리 후보는 [FILE_CLEANUP_REVIEW.md](docs/FILE_CLEANUP_REVIEW.md)에 정리되어 있습니다.

<a id="section-07"></a>

## 07. 설치 및 실행 방법

### 저장소와 가상환경

```powershell
git clone https://github.com/YuNi-100/futsal_match.git
cd futsal_match
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

Python 3.14 기준입니다. 기존 프로젝트와 `.env`는 유지합니다. PostgreSQL 개발용 SQL 파서는 `requirements-postgres-dev.txt`로 설치할 수 있습니다.

기존 `.env`에는 필요한 항목만 추가합니다. `.env.example`의 MySQL 기본값은 호환용이며, 현재 PostgreSQL 설정은 아래와 같습니다.

```dotenv
DB_ENGINE=postgres
DATABASE_URL=postgresql://USER:URL_ENCODED_PASSWORD@HOST:5432/postgres
POSTGRES_EXPECTED_DATABASE=postgres
PG_SSLMODE=require
WGH_ALLOW_ANALYSIS_WRITES=true
WGH_ALLOW_SYNC_WRITES=true
GOOGLE_CLIENT_ID=YOUR_CLIENT_ID
GOOGLE_CLIENT_SECRET=YOUR_CLIENT_SECRET
GOOGLE_REDIRECT_URI=http://localhost:8000/auth/google/callback
```

접속 정보는 Supabase Connect에서 확인할 수 있습니다. 세션 단위 잠금을 위해 Session pooler(5432) 또는 지원되는 직접 연결이 필요합니다. 쓰기 허용 설정은 검증된 대상 DB에만 적용합니다. `WGH_MIGRATION_DATABASE_URL`은 이전 도구용으로, 런타임 설정과 별개입니다.

AI 분석에는 서버의 `GEMINI_API_KEY`와 `GEMINI_FEEDBACK_MODEL` 또는 `GEMINI_MODEL`이 필요합니다. 기사 초안은 `OPENAI_API_KEY`·`OPENAI_MODEL`을 사용합니다. 키는 HTML·JavaScript·Git에 저장하지 않습니다.

```powershell
.\.venv\Scripts\python.exe -m uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

로컬 접속 주소는 `http://localhost:8000`입니다. Google Cloud에도 동일한 로컬 콜백 주소가 필요합니다. 운영·로컬 주소 혼용 시 OAuth 상태·쿠키 검증이 실패할 수 있습니다.

### Vercel 운영 배포

완성된 MySQL 테스트 DB를 Supabase PostgreSQL로 이전하고 데이터를 대조했습니다. 이전 당시 스냅샷은 17개 테이블·영속 데이터 70개 행으로, 현재 운영 데이터 수와는 별개입니다. 로그인 세션은 재사용하지 않았으며, MySQL 원본·백업은 보존했습니다.

- [Supabase 이전 절차](docs/SUPABASE_MIGRATION.md): 내보내기·스키마·검증. 기존 운영 DB 초기 이전 반복 실행 금지
- [Vercel 배포](docs/VERCEL_DEPLOYMENT.md): FastAPI, 저장소 루트, `python build_vercel.py` 사용.
- 운영 Google 콜백: `https://futsal-match-theta.vercel.app/auth/google/callback`
- Vercel Production에 DB 설정·Google 인증 정보 별도 등록. 운영 AI 키·모델 설정 필요
- 환경변수 변경 후 재배포 필요. 로컬 `.env`·Vercel 설정 별도 관리
- FastAPI 권한 검사 후 보호 페이지 제공, 빌드 시 공개 자산 경로 보존. `/tmp` 영속 저장 불가

<a id="section-08"></a>

## 08. PostgreSQL SQL 파일 생성·복원 방법

### SQL 종류 구분

| 자료 | 내용 | 용도 |
| --- | --- | --- |
| `migrations/postgresql/001_wgh_schema.sql` | 테이블·제약·인덱스·RLS 등 구조, 운영 데이터 없음 | 빈 대상에 초기 스키마 생성 |
| `postgres_migrate.py export` 결과 | schema.sql + data.json + manifest.json | 기존 MySQL에서 PostgreSQL로 최초 이전 |
| PostgreSQL `pg_dump` SQL | 현재 PostgreSQL 구조·데이터 | 전환 이후 백업·복원 |

MySQL dump SQL을 PostgreSQL SQL Editor에 그대로 실행하지 않습니다. 최초 이전 도구는 이미 존재하는 `wgh` 스키마에 덮어쓰지 않으며, 전환 이후의 PostgreSQL 변경분을 백업하는 도구도 아닙니다.

### A. 빈 DB에 구조만 생성

PostgreSQL 클라이언트 `psql`을 설치하고, **운영 데이터가 없는 별도 대상 DB**에 실행합니다. `--single-transaction`으로 파일 전체를 한 트랜잭션에 적용합니다.

```powershell
$env:PGSSLMODE = "require"
psql --host=TARGET_HOST --port=5432 --username=TARGET_USER --dbname=TARGET_DB --password --set=ON_ERROR_STOP=1 --single-transaction --file=migrations/postgresql/001_wgh_schema.sql
```

HOST·USER·DB는 실제 대상 값으로 바꾸고 비밀번호는 프롬프트에 입력합니다. 현재 Supabase 운영 `wgh`에는 이미 적용되어 있으므로 다시 실행하지 않습니다.

### B. 현재 PostgreSQL SQL 백업 생성

서버 버전과 호환되는 `pg_dump` 클라이언트를 사용합니다. 아래는 `wgh` 스키마의 구조·데이터를 SQL로 저장하고 로그인 세션·OAuth 상태 데이터는 제외하는 예시입니다.

```powershell
New-Item -ItemType Directory -Path C:\wgh-private-backups -Force
$env:PGSSLMODE = "require"
pg_dump --host=SOURCE_HOST --port=5432 --username=SOURCE_USER --dbname=SOURCE_DB --password --format=plain --schema=wgh --no-owner --exclude-table-data=wgh.wgh_login_session --exclude-table-data=wgh.wgh_oauth_state --file=C:\wgh-private-backups\wgh-backup.sql
```

백업에는 회원·Google 식별자·분석 자료가 포함될 수 있으므로 GitHub에 올리지 않습니다. `--no-owner`는 소유권 복원을 생략하며, 기존 접근 권한·RLS 정의는 백업에 유지합니다. DB 역할이 다른 환경에서는 ACL 참조와 복원 권한을 별도로 확인합니다.

### C. SQL 백업 복원

먼저 별도의 빈 대상 DB에서 복원합니다. A의 구조 생성과 C의 구조 포함 백업 복원은 대안이며 같은 대상에서 연달아 실행하지 않습니다.

```powershell
$env:PGSSLMODE = "require"
psql --host=TARGET_HOST --port=5432 --username=TARGET_USER --dbname=TARGET_DB --password --set=ON_ERROR_STOP=1 --single-transaction --file=C:\wgh-private-backups\wgh-backup.sql
```

복원 후 17개 테이블 존재·행 수·FK·시퀀스·RLS·권한과 주요 화면을 원본과 대조합니다. 세션을 제외했으므로 다시 로그인합니다. 예시 쿼리는 `SELECT COUNT(*) FROM wgh.futsal_match;`, `SELECT COUNT(*) FROM wgh.match_player;`입니다. 운영 DB를 DROP하거나 TRUNCATE하는 절차는 포함하지 않습니다.

### D. 기존 MySQL에서 최초 이전하는 경우

소스가 검토된 `futsaldb_test`이고 대상 `wgh`가 없는 경우에만 사용합니다. 접속 정보는 비공개 `.env`의 MySQL 설정과 `.env.supabase`의 `WGH_MIGRATION_DATABASE_URL`을 사용합니다. 생성할 내보내기 폴더는 새 경로여야 합니다.

```powershell
.\.venv\Scripts\python.exe postgres_migrate.py export --directory C:\wgh-private-backups\mysql-final-export
.\.venv\Scripts\python.exe postgres_migrate.py import --directory C:\wgh-private-backups\mysql-final-export --apply-new-schema
.\.venv\Scripts\python.exe postgres_migrate.py verify --directory C:\wgh-private-backups\mysql-final-export
```

도구는 체크섬·행 수·전체 행 비교 후 커밋하고, 일회성 세션·OAuth 상태는 제외합니다. 현재 운영은 이전 완료 상태이며 위 명령을 이번 문서 수정에서 실행하지 않았습니다. 상세는 [SUPABASE_MIGRATION.md](docs/SUPABASE_MIGRATION.md)를 참고합니다.

<a id="section-09"></a>

## 09. OpenAI·Gemini API 설정 방법

### 서버 환경변수

아래 항목은 기존 `.env`에 저장합니다. 값은 실제 키와 계정에서 사용 가능한 모델 ID입니다. 변경 후 로컬 서버 재시작 또는 Vercel Production 재배포가 필요합니다.

```dotenv
GEMINI_API_KEY=YOUR_GEMINI_API_KEY
GEMINI_FEEDBACK_MODEL=YOUR_AVAILABLE_GEMINI_VIDEO_MODEL
OPENAI_API_KEY=YOUR_OPENAI_API_KEY
OPENAI_MODEL=YOUR_AVAILABLE_OPENAI_MODEL
```

| 설정 | 현재 코드의 사용 방식 |
| --- | --- |
| GEMINI_API_KEY | 관리자 YouTube 영상 분석 호출에 사용 |
| GEMINI_FEEDBACK_MODEL | 영상 분석 모델을 우선 지정 |
| GEMINI_MODEL | 위 설정이 없을 때 사용하는 대체 설정 |
| OPENAI_API_KEY / OPENAI_MODEL | 선택 기능인 경기 기사 초안 생성에 사용 |

Gemini 모델 선택 순서는 `GEMINI_FEEDBACK_MODEL` → `GEMINI_MODEL` → 코드 기본값입니다. 모델 제공 여부·권한은 계정별로 다릅니다. 영상 분석은 Gemini 방식으로, OpenAI 키만으로 대체할 수 없습니다. Google 로그인용 `GOOGLE_CLIENT_ID/SECRET`과 AI 키는 별개입니다.

### 기능별 사용·확인

1. 관리자 로그인 → 영상 등록·관리에서 YouTube 링크 등록
2. AI 분석 영역에서 영상·분석 구간·유니폼 설명·전송 동의 확인 후 실행
3. 검수 화면에서 저장 결과 수정 후 검수 완료·게시
4. 회원용 WGH TV에서 요약·코멘트·시간 이동 확인

OpenAI 기사 초안은 시범 화면 `article.html`·기사 API에서 사용합니다. 템플릿 모드는 DB 기록으로 생성하며, `openai` 모드만 외부 API를 호출합니다. 자동 게시·공식 득점자 추정 기능은 없습니다.

설정 누락은 서버 안내, 인증·권한·요청 한도 오류는 API 응답·서버 로그로 확인할 수 있습니다. 보고·캡처에는 키·토큰·비밀번호를 포함하지 않습니다. 영상 등록·예약 검색은 유료 AI를 자동 호출하지 않으며, 분석 실행 시 사용량이 발생합니다. 이번 문구 수정에서는 외부 AI를 호출하지 않았습니다.

<a id="section-10"></a>

## 10. 기능별 테스트 체크리스트

배포·정리 후 재확인용 체크리스트입니다. **체크박스는 이번 문구 수정의 기능 실측 결과가 아닙니다.** 별도 테스트 데이터·권한을 사용하며, 운영 기록은 임의로 수정하지 않습니다.

| 확인 | 영역 | 테스트 동작 | 기대 결과 | 관련 자동 테스트 |
| --- | --- | --- | --- | --- |
| ☐ | 홈·메뉴 | 카드·메뉴 이동·선택 상태 | 해당 상세·메뉴 활성화 | browser_navigation, browser_design_refresh |
| ☐ | 경기 목록 | 11개 이상 자료에서 페이지 이동 | 페이지당 최대 10개·중복 없음 | browser_match_pagination |
| ☐ | 경기 관리 | 등록→선수 득점 수정→삭제 | 기록 유지·집계 반영 | test_match_player_records, browser_record_admin |
| ☐ | 경기 상세 | 선수·영상 연결 클릭 | 선택 선수·해당 경기 영상 이동 | test_match_detail, browser_match_detail |
| ☐ | 선수 | 등록·수정·상세·삭제 제한 | 기록·회원 연결 선수 보호 | test_player_management, test_player_detail |
| ☐ | 회원 연결 | 연결·변경·해제 | 선수 회원 표시·관리자 권한 별도 | test_account, browser_account |
| ☐ | 일정 | 2000 입력·잘못된 종료 시간·펼치기 | 20:00 변환·검증·한 항목으로 표시 | browser_record_admin, browser_design_refresh |
| ☐ | 로그인 | 로그인·로그아웃·세션 만료 | 올바른 회원 상태·만료 후 접근 제한 | test_auth, test_session_diagnostics |
| ☐ | 권한 | 비회원 영상·일반 회원 수정 요청 | 조회·변경 권한 검사 | test_auth, test_account |
| ☐ | 영상 | 등록·중복·연결·해제·삭제 | 중복 거절·공식 경기 기록 유지 | test_video_delete, test_video_match_link |
| ☐ | 분석 | 저장·편집·검수 완료·회원 조회 | 게시한 결과만 회원에게 표시 | test_feedback_review, browser_feedback_review |
| ☐ | 시간 이동 | 게시 코멘트 시간 클릭 | 같은 페이지 영상 위치·스크롤·재생 요청 | browser_video_feedback, browser_feedback_review |
| ☐ | 자동 검색 | 같은 ID·삭제 이력·제목 날짜 처리 | 중복 제외·날짜 분리 | test_youtube_sync |
| ☐ | PostgreSQL | 변환·바인딩·쓰기 대상 검사 | 정상 변환·잘못된 대상 거절 | test_postgres |
| ☐ | 배포·반응형 | 보호 페이지·CSS·이미지·각 화면 크기 | 접근 제한 유지·화면 깨짐 없음 | browser_design_refresh 및 배포 점검 |

### 단위 테스트 실행

기존 MySQL 호환 테스트를 위해 테스트 프로세스에만 `DB_ENGINE=mysql`을 설정합니다. 서비스 `.env`·운영 DB에는 영향이 없습니다. 실제 DB 선택 테스트는 비활성화 상태입니다.

```powershell
.\.venv\Scripts\python.exe -c "import os,unittest; os.environ['DB_ENGINE']='mysql'; os.environ['WGH_TEST_PLAYER_DB']='0'; suite=unittest.defaultTestLoader.discover('tests'); result=unittest.TextTestRunner(verbosity=1).run(suite); raise SystemExit(not result.wasSuccessful())"
```

`tests/test_*.py`는 unittest, `tests/browser_*.cjs`는 Playwright 기반 브라우저 검증입니다. 브라우저 스크립트는 Node.js·Playwright 등 별도 개발 환경과 각 스크립트의 실행 조건이 필요합니다. `WGH_TEST_PLAYER_DB=1`은 분리된 테스트 DB를 준비한 경우에만 사용합니다.

<a id="section-11"></a>

## 11. 오류 수정 내역 및 테스트 결과

### 오류 수정 내역

| 문제 | 수정한 내용 | 확인 근거·범위 |
| --- | --- | --- |
| 경기 수정에서 선수 득점·도움이 표시·유지되지 않음 | 경기별 참가 기록 조회·저장 연결 | 기록 관련 테스트와 사용자 저장 확인 |
| 로그인 상태와 영상 목록 접근 상태 불일치 | 세션·로그인 상태 확인·API 실패 처리 보완 | 인증·세션 테스트 및 사용자 재로그인 확인 |
| 일정·경기 목록에서 관리자 버튼 소실·정렬 변경 | 권한별 표시 복구·텍스트 버튼·정렬 보완 | 관리자 화면 브라우저 검증·사용자 확인 |
| 검수 결과 게시·시간 이동·재생 흐름 문제 | 게시 결과 조회·시간 이동·스크롤·자동 재생 요청 | 검수 테스트·사용자 코멘트 확인. 실제 자동 재생은 브라우저 정책 영향 |
| PostgreSQL 변환 중 current_database() 재변환 | DATABASE() 변환에 단어 경계 적용 | test_postgres 회귀 검증 |
| Vercel에서 pyproject.toml project 테이블 누락 | 프로젝트 메타데이터·의존성·uv.lock 구성 | 후속 빌드가 의존성 설치 단계 통과 |
| Vercel 이미지 경로 ENOENT | public 자산 이동 대신 복사·원본 경로 보존 | 사본 빌드·자산 경로 검증·배포 완료 |
| WGH TV에서 CSS·로고가 깨짐 | 보호 HTML의 CSS·JS·이미지 주소를 루트 기준으로 변경 | 보호 경로 PC·모바일 검사·후속 배포 |

### 검증 결과와 제한

기존 검증 결과는 118개 중 112개 통과·선택 DB 테스트 6개 제외입니다. PostgreSQL 인증·CRUD·연결은 임시 스키마에서 검증 후 롤백했습니다. 이전 당시 17개 테이블·70개 행을 대조했으며, 현재 운영 데이터 수와는 별개입니다.

PC·태블릿·모바일 **화면 크기별 브라우저 검증**을 진행했습니다. 모든 실제 기기의 검증은 완료되지 않았습니다. 이번 문구 수정에서는 운영 유료 AI 재호출·새 SQL 백업 복원을 실행하지 않았습니다.

이전 README 검증에서는 **118개 실행·112개 통과·선택 DB 테스트 6개 제외**를 확인했습니다. 최초 격리 환경의 응답 정지 후 일반 환경에서 재실행한 결과입니다. Starlette TestClient의 httpx 관련 경고가 있었으나 실패는 없었습니다. 번호 섹션 11개·목차 링크·사진 6개·로컬 문서 링크도 검사했습니다. SQL 백업·복원 예시와 유료 AI는 실행하지 않았습니다. 이번 문구 수정에서는 기능 테스트를 재실행하지 않았습니다.

### 남은 작업·관련 문서

클라우드 기반 영상 자동 검색, 삭제한 영상의 재등록 방지를 위한 기록 보관, 하이라이트 영상 제작 기능

[로그인·권한](docs/AUTH_SETUP.md) · [관리자 관리](docs/ADMIN_RECORD_MANAGEMENT.md) · [디자인](docs/DESIGN_REFRESH.md) · [AI 검수](docs/VIDEO_REVIEW_SETUP.md) · [YouTube 검색](docs/YOUTUBE_SYNC.md) · [Supabase 이전](docs/SUPABASE_MIGRATION.md) · [Vercel 배포](docs/VERCEL_DEPLOYMENT.md)

단계별 문서에 과거 설명이 남아 있을 수 있습니다. 현재 구성·완료 상태는 이 README와 실제 환경 기준입니다.

<a id="section-12"></a>

## 12. 이용 조건 및 자료 출처

본 프로젝트는 수업 실습을 목적으로 제작한 사이트입니다.

- **프로젝트 코드**: 홈페이지 화면, 경기·선수 기록 관리, 영상 연결, AI 피드백 등의 기능을 구현한 소스 코드입니다. 프로젝트 자체 코드의 라이선스는 현재 미지정이며, 사용한 외부 라이브러리는 각각의 라이선스를 따릅니다.
- **경기 영상**: 경기 영상은 팀 활동을 직접 촬영한 후 YouTube에 업로드한 자료입니다. 홈페이지에는 영상 ID·제목·경기 날짜 등의 정보를 저장하고 YouTube 임베드로 재생합니다. 수집 채널은 `@yuni_andv5909`입니다. 영상 제목에는 실제 경기 날짜와 검색 조건에 맞는 `WGH`·`은평`·`친선경기` 문구를 사용합니다. 예시는 `2026-10-19 은평 VS 상대팀`입니다. 날짜는 경기 날짜로 저장하고 화면 제목에서 분리합니다.
- **손글씨 이미지**: 제작자가 직접 드로잉한 손글씨를 디지털 이미지로 옮겨 화면에 적용했습니다.
- **메인 이미지**: 제작자가 첨부한 참고 이미지를 바탕으로 AI를 사용해 생성했습니다. 사용한 AI 도구와 생성 날짜는 확인 후 추가할 예정입니다.
- **브랜드 로고**: 제작자가 제공한 위고하이 오피셜·여자풋살클럽 위고하이·위필드·위고하이 은평의 로고 원본을 사용했습니다. 현재 각 로고의 사용 허가는 받지 않은 상태이며, 향후 상용화 시 해당 로고를 삭제하거나 권리자의 사용 허가를 받을 예정입니다.
- **AI 영상 피드백**: Gemini 분석은 관리자 요청 시 실행됩니다. 공개 YouTube 영상의 최대 30분 구간과 유니폼 설명을 사용합니다. 검수·수정한 결과를 회원에게 게시하며, 시간별 코멘트는 영상 위치로 연결됩니다. 모델·키·영상 상태에 따라 실패할 수 있으며, API 사용량에 따른 비용이 발생합니다.

코드에 관한 라이선스와 영상·이미지·로고 등 개별 자료의 이용 조건은 별개입니다. 본 저장소에 포함되거나 사이트에 표시된 자료의 재사용을 일괄적으로 허용하는 것은 아닙니다.
