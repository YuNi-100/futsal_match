# WGH Futsal Match · We Go High

여자 풋살 클럽 위고하이의 경기·선수 기록·일정·영상과 검수된 AI 피드백을 관리하는 웹 서비스입니다.

- [서비스](https://futsal-match-theta.vercel.app/) · [GitHub](https://github.com/YuNi-100/futsal_match)
- 문서 기준: 2026-10-19. 실제 코드·최종 승인 대화·Notion 기획서 내보내기를 대조했습니다.

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

<a id="section-01"></a>

## 01. 프로젝트 개요 및 개발 목적

경기 결과·선수별 기록·일정·영상이 흩어져 있으면 팀 활동을 기록하고 다시 살펴보기 어렵습니다. 운영자는 정보를 한곳에서 관리하고, 선수는 자신의 기록과 해당 경기 영상을 이어서 확인할 수 있도록 구성했습니다. 긴 영상의 복기는 시간별 AI 코멘트로 돕되, 공식 득점·도움 기록은 관리자가 입력한 값을 사용합니다.

주요 사용자는 팀 운영자, 경기 기록 담당자와 선수입니다. 이 문제 정의는 기획 방향이며, 사용자 조사나 정량 성과가 검증되었다는 의미는 아닙니다.

기획서: [We Go High 풋살 매치 프로젝트](https://observant-stranger-324.notion.site/We-Go-High-3f29f6b6a113808a9648d904ab20c6fe). 공개 원문과 사용자가 제공한 Notion 내보내기 파일의 전체 본문을 대조했습니다. 팀 브랜딩·일정·선수 정보의 통합 관리, 실제 팀 활동 자료 활용이라는 기획 방향을 반영했습니다. 초기 기술 구성과 기능 계획은 현재 코드 및 최종 승인 사항을 기준으로 현행화했습니다.

### 초기 기획에서 완성된 내용

| 초기 기획서 | 현재 프로젝트 |
| --- | --- |
| Node.js / Express + MySQL | FastAPI + Supabase PostgreSQL, Vercel 배포 |
| 한 페이지에서 일정·선수 정보 조회 | 홈, 경기 목록·상세, 선수 목록·상세, 다음 경기, WGH TV로 확장 |
| 선수·경기 연결은 향후 확장 | match_player로 참가 선수·득점·도움 저장 및 누적 기록 연결 |
| 경기 결과·선수 기록 관리 확장 예정 | 관리자 등록·수정·삭제와 상세 조회 구현 |
| 팀 로고·손글씨·사진·선수 카드 | 기존 브랜딩 유지, 상단 메뉴·등번호 유니폼 카드·반응형 화면 반영 |

실제 팀 일정·선수·출전 기록을 공식 기록으로 관리합니다. 촬영·제작 이미지는 팀 브랜딩에 활용하고, YouTube 영상과 검수한 AI 코멘트는 복기 자료로 연결합니다. 기획서의 회원 연결·변경·해제, 선수 회원과 관리자 권한 분리, 비회원 영상 제한도 구현 내용에 포함됩니다.

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

비회원은 경기·선수·일정 등 공개 기록을 볼 수 있지만, 경기 영상은 로그인해야 볼 수 있습니다. 등록·수정·삭제와 분석·검수는 관리자 권한으로 보호합니다. 선수 정보에 연결되었다고 관리자 권한이 부여되지는 않습니다.

### 최종 승인한 동작

| 항목 | 확정한 동작 |
| --- | --- |
| 디자인 | 기존 로고·메인 사진·파란색과 파스텔 색감을 유지하고 상단 메뉴와 로그인·내 페이지 배치 |
| 홈 배치 | 메인 사진 → 통계 → 최근 경기 → 다음 경기·팀 공지 → 선수 카드 순서 유지 |
| 경기 이동 | 홈의 최근 경기 카드 전체를 누르면 선택 경기 상세로 이동하고 경기 기록 메뉴 활성화 |
| 경기 목록 | 홈의 흰 카드 디자인과 별도로, 경기 기록 페이지는 간결한 목록과 10개 단위 페이지 이동 |
| 경기 입력 | 경기 등록·수정에 시간 입력을 임의로 추가하지 않음. 일정은 24시간제 HH:MM이며 2000 입력을 20:00으로 변환 |
| 선수 이동 | 홈 선수 카드 전체와 참가 선수 이름은 선수 상세로, 득점 기록의 영상 연결은 해당 경기 영상으로 이동 |
| 선수 디자인 | 파랑·검정 줄무늬 유니폼에 등번호·이름 표시 |
| 다음 경기 | 뒤쪽 일정의 펼친 정보는 목록과 연결된 한 항목으로 보이도록 구성 |
| 관리자 버튼 | 경기·선수·다음 경기의 수정·삭제는 작고 차분한 텍스트 형태로 통일 |
| 영상 등록·분석 | 수동 등록과 AI 분석은 분리. 영상 등록만으로 유료 AI 분석을 실행하지 않음 |
| 분석 공개 | 검수 완료한 결과를 회원용 분석 결과에 게시. 시간 클릭 시 같은 페이지의 영상으로 이동·재생 |
| DB 기준 | 개발 중 완성한 futsaldb_test 데이터를 최종 이전 기준으로 채택. 기존 futsaldb는 삭제하지 않음 |

메뉴는 홈 / 경기 기록 / 선수 정보 / 다음 경기 / WGH TV / 팀 소개입니다. 팀 소개는 현재 홈의 연결 영역이며, 팀 공지는 정적 콘텐츠입니다. 공지 관리 API가 완성된 것으로 설명하지 않습니다.

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

아래 사진은 사용자가 제공한 Notion 내보내기 원본입니다. **초기 개발 화면**이므로 사이드바·원형 등번호 등은 현재 상단 메뉴·유니폼 카드와 다릅니다. 사진은 디자인 변화의 기록으로 사용하고, 현재 동작은 위 기능 정의서를 기준으로 확인합니다.

### 홈과 팀 브랜딩

![초기 홈 화면: WGH 로고·손글씨·메인 사진·통계](docs/images/planning/home-original.png)

기존 팀 이미지·색감을 유지하고 상단 메뉴로 개편했습니다. 홈 배치는 메인 이미지 → 통계 → 최근 경기 → 다음 경기·공지 → 선수 카드입니다.

### 최근 경기 · 다음 경기

![초기 최근 경기 카드와 다음 경기·공지](docs/images/planning/matches-schedule-original.png)

홈의 흰 경기 카드 디자인은 유지합니다. 별도 경기 목록은 10개 단위이며, 다음 경기 전용 화면은 가장 가까운 일정만 큰 카드로 표시합니다.

### 경기 기록 등록 · 일정 등록

| 경기 기록 등록 — 초기 화면 | 일정 등록 — 초기 화면 |
| --- | --- |
| ![경기 결과 입력 팝업](docs/images/planning/match-form-original.png) | ![일정과 24시간 입력 팝업](docs/images/planning/schedule-form-original.png) |

경기 기록은 날짜·상대팀·점수·메모·참가 선수 기록·영상 연결을 관리합니다. 시작·종료 시간은 일정 등록에서 입력하며 두 입력 흐름을 구분합니다.

### 선수 정보

![초기 선수 카드: 원형 등번호와 누적 기록](docs/images/planning/players-original.png)

현재는 원형 등번호 대신 파랑·검정 줄무늬 유니폼에 등번호·이름을 표시하며 선수 상세와 경기·영상 기록으로 연결합니다.

<a id="section-04"></a>

## 04. DB 설계 및 ERD

현재 Supabase PostgreSQL의 `wgh` 스키마를 사용합니다. 아래는 핵심 관계를 추린 ERD이며 전체 17개 테이블과 제약조건은 [운영 스키마 SQL](migrations/postgresql/001_wgh_schema.sql)을 기준으로 합니다.

```mermaid
erDiagram
    app_user ||--o{ futsal_match : creates
    app_user ||--o{ futsal_video : registers
    futsal_player ||--o{ match_player : participates
    futsal_match ||--o{ match_player : records
    futsal_match o|--o{ futsal_video : links
    futsal_video ||--o{ video_analysis : analyses
    video_analysis ||--o{ video_event : scenes
```

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

경기 입력 화면은 시간 필드를 사용하지 않습니다. DB에 남아 있는 `futsal_match.start_time/end_time`과 일정 입력 화면의 시간 사용은 구분합니다.

### 삭제·연결 정책

- 경기 등록 시 기존 영상을 선택하거나, 영상 등록 시 기존 경기를 선택할 수 있습니다. 나중에 연결하거나 해제할 수도 있습니다.
- 경기 삭제 시 해당 경기의 선수별 기록이 제거되어 집계에 반영됩니다. 연결된 영상은 남고 경기 연결이 해제됩니다.
- 홈페이지에서 영상을 삭제해도 경기 결과·선수 득점·도움은 유지됩니다. 영상에 종속된 분석 자료는 함께 삭제됩니다. YouTube 원본은 삭제하지 않습니다.
- YouTube에서 삭제·비공개 처리한 영상은 임베드 재생이 불가능할 수 있습니다. 이를 이유로 공식 경기 기록을 자동 삭제하지 않습니다.
- 기록이나 회원 연결이 있는 선수의 삭제는 제한합니다.
- AI 코멘트는 검수용 피드백이며 공식 경기 점수나 선수 기록을 자동 변경하지 않습니다.

### 초기 설계 자료

![초기 ERD — 현재 운영 스키마가 아님](docs/images/planning/erd-original.png)

위 이미지는 선수·경기를 독립 관리하던 초기 기록입니다. 현재는 `match_player`와 FK로 연결하며 SQL 파일이 최종 기준입니다. RLS·스키마 접근 제한을 적용하고 FastAPI에서 로그인·관리자 권한을 검사합니다. DB 비밀번호는 브라우저에 전달하지 않습니다.

<a id="section-05"></a>

## 05. 데이터 수집 방법

| 데이터 | 수집·입력 방법 | 활용 |
| --- | --- | --- |
| 경기·일정 | 실제 팀 활동 기록을 관리자 입력 | 결과·다음 경기·통계 |
| 선수·참가·득점·도움 | 팀 선수 정보와 경기 후 기록 입력 | 선수 상세·누적 기록 |
| 팀 이미지 | 팀 촬영·제작 자료 | 로고·Hero·브랜딩 |
| 영상 | YouTube 링크 수동 등록·공개 채널 검색 | 회원 재생·경기 연결 |
| AI 피드백 | 영상·유니폼 설명·구간을 Gemini에 전달 | 관리자 검수 후 복기 자료로 게시 |

채널은 `@yuni_andv5909`입니다. 제목에 실제 경기 날짜와 `WGH`, `은평`, `친선경기` 중 조건에 맞는 문구를 사용합니다. 예: `2026-10-19 은평 VS 상대팀`. 날짜는 경기 날짜로 저장하고 화면 제목에서는 분리해 중복 표시를 줄입니다.

현재 수요일·토요일 오후 6시(Asia/Seoul) 검색은 **로컬 Codex 예약 작업**입니다. Vercel 배포만으로 클라우드 예약이 생기지 않으며, 로컬 실행 환경이 꺼져 있으면 실행을 보장하지 않습니다. 실행 도구는 `python youtube_sync.py --apply`입니다. 동일 YouTube ID의 수동 등록 영상은 중복 등록하지 않고, 삭제 영상 재등록 방지 이력은 `.wgh-sync/`에 보관합니다. 공개 피드 범위의 검색이므로 과거 영상 전체 수집을 보장하지 않습니다. 일부공개 영상은 자동 검색 대신 링크로 수동 등록합니다.

Gemini 분석은 관리자 요청으로 실행합니다. 분석 구간은 최대 30분이며 유니폼 설명과 함께 요청합니다. 현재 분석 경로는 공개 YouTube 영상을 전제로 합니다. 결과를 검수·수정하고 검수 완료하면 회원에게 게시합니다. 시간별 코멘트는 영상 위치 이동과 연결됩니다. 모델·키·영상 상태에 따라 실패할 수 있고 API 사용량에 따라 비용이 발생합니다.

**실제 하이라이트 영상 자동 제작은 보류 상태**입니다. 하이라이트 탭의 존재가 제작 기능 완료를 의미하지 않습니다. OpenAI 기사 초안과 기존 로컬 영상 API는 별도 시범 코드로 남아 있으며 핵심 사용자 흐름과 구분합니다.

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

Python 3.14, FastAPI, Uvicorn, Pydantic, psycopg와 순수 HTML/CSS/JavaScript를 사용합니다. 기존 MySQL 연결은 호환·복구용으로 남겨 두었습니다. 현재 서비스의 DB는 Supabase PostgreSQL이며, Supabase Auth 대신 프로젝트의 Google OAuth·서버 세션을 사용합니다. Node.js는 서비스 실행에 필요하지 않습니다.

DB 접속 정보와 AI 키는 서버에서만 사용합니다. Supabase Data API를 통한 브라우저의 직접 DB 접근을 전제로 하지 않습니다. 운영 스키마는 `wgh`이며 RLS와 접근 권한 제한을 적용했습니다.

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

파일 역할은 [PROJECT_FILES.md](PROJECT_FILES.md), 정리 후보는 [FILE_CLEANUP_REVIEW.md](FILE_CLEANUP_REVIEW.md)를 참고합니다.

<a id="section-07"></a>

## 07. 설치 및 실행 방법

### 저장소와 가상환경

```powershell
git clone https://github.com/YuNi-100/futsal_match.git
cd futsal_match
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

Python 3.14를 사용합니다. 기존 프로젝트라면 다시 복제하거나 `.env`를 덮어쓰지 않습니다. PostgreSQL 개발용 SQL 파서가 필요하면 `requirements-postgres-dev.txt`를 설치합니다.

기존 `.env`가 있으면 덮어쓰지 말고 필요한 항목을 확인합니다. `.env.example`의 MySQL 기본값은 호환용이므로 현재 PostgreSQL 실행은 아래 설정을 사용합니다.

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

실제 접속 정보는 Supabase Connect에서 확인합니다. 세션 단위 잠금을 사용하므로 Session pooler(5432) 또는 지원되는 직접 연결을 사용합니다. 쓰기 허용 설정은 검증한 대상 DB에만 적용합니다. `.env.supabase`의 `WGH_MIGRATION_DATABASE_URL`은 이전 도구용이며 런타임 설정을 대신하지 않습니다.

AI 분석에는 서버의 `GEMINI_API_KEY`와 사용할 `GEMINI_FEEDBACK_MODEL` 또는 `GEMINI_MODEL`을 설정합니다. 선택 기능인 기사 초안에는 `OPENAI_API_KEY`, `OPENAI_MODEL`을 사용합니다. 키를 HTML·JavaScript·Git에 넣지 않습니다.

```powershell
.\.venv\Scripts\python.exe -m uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

브라우저는 `http://localhost:8000`으로 접속하고 Google Cloud에 같은 로컬 콜백 주소를 등록합니다. 운영 주소와 로컬 주소를 섞으면 OAuth 상태·쿠키 검증이 실패할 수 있습니다.

### Vercel 운영 배포

완성한 MySQL 테스트 DB를 기준으로 Supabase PostgreSQL 이전과 데이터 대조를 수행했습니다. 이전 스냅샷은 17개 테이블·영속 데이터 70개 행이며, 로그인 세션은 재사용하지 않았습니다. 이 숫자는 현재 운영 데이터 개수를 뜻하지 않습니다. MySQL 원본과 백업은 보존합니다.

- [Supabase 이전 절차](SUPABASE_MIGRATION.md): 내보내기·스키마·검증. 기존 운영 DB에 초기 이전을 반복 실행하지 않습니다.
- [Vercel 배포](VERCEL_DEPLOYMENT.md): FastAPI, 저장소 루트, `python build_vercel.py` 사용.
- 운영 Google 콜백: `https://futsal-match-theta.vercel.app/auth/google/callback`
- Vercel Production에 DB 설정과 Google 인증 정보를 별도 등록합니다. 운영 AI 실행에는 해당 AI 키·모델 설정도 필요합니다.
- 환경변수 변경은 새 배포에 반영합니다. 로컬 `.env` 변경만으로 Vercel 설정이 바뀌지 않습니다.
- 보호 페이지는 FastAPI 권한 검사 후 제공하며, 빌드 시 공개 자산 경로를 보존합니다. `/tmp`는 영속 업로드 저장소가 아닙니다.

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

도구는 체크섬·행 수·전체 행 비교 후 커밋하고, 일회성 세션·OAuth 상태는 제외합니다. 현재 운영은 이전 완료 상태이며 위 명령을 이번 문서 수정에서 실행하지 않았습니다. 상세는 [SUPABASE_MIGRATION.md](SUPABASE_MIGRATION.md)를 참고합니다.

<a id="section-09"></a>

## 09. OpenAI·Gemini API 설정 방법

### 서버 환경변수

기존 `.env`에 아래 이름으로 저장합니다. 예시 문자열을 실제 키·계정에서 사용할 수 있는 모델 ID로 바꿉니다. 로컬 서버는 변경 후 재시작하고 Vercel은 Production 환경변수 저장 후 새 배포가 필요합니다.

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

Gemini 선택 순서는 `GEMINI_FEEDBACK_MODEL` → `GEMINI_MODEL` → 코드 기본값입니다. 모델의 실제 제공 여부·권한은 계정에 따라 달라지므로 사용할 모델을 명시합니다. 영상 분석은 Gemini 경로이며 OpenAI 키만으로 대체되지 않습니다. Google 로그인용 `GOOGLE_CLIENT_ID/SECRET`은 AI API 키와 별개입니다.

### 기능별 사용·확인

1. 관리자로 로그인하여 영상 등록·관리에서 YouTube 링크를 등록합니다.
2. 별도 AI 분석 영역에서 영상·분석 구간·유니폼 설명과 전송 동의를 확인하고 실행합니다.
3. 저장된 결과를 검수 화면에서 수정하고 검수 완료로 게시합니다.
4. 회원용 WGH TV에서 요약·코멘트·시간 이동을 확인합니다.

OpenAI 기사 초안은 별도 시범 화면 `article.html`과 기사 API에서 사용합니다. 템플릿 모드는 OpenAI 호출 없이 DB 경기 기록으로 초안을 생성하며, `openai` 모드만 외부 API를 호출합니다. 자동 게시·공식 득점자 추정 기능으로 설명하지 않습니다.

설정 누락은 서버의 설정 안내, 인증·권한·요청 한도 오류는 해당 API 응답과 서버 로그로 확인합니다. 키 값·토큰·접속 비밀번호를 오류 보고나 화면 캡처에 포함하지 않습니다. 영상 등록·예약 검색은 유료 AI를 자동 호출하지 않으며, 유료 분석은 사용자가 실행할 때 사용량이 발생합니다. 이번 README 검증에서는 외부 AI를 호출하지 않았습니다.

<a id="section-10"></a>

## 10. 기능별 테스트 체크리스트

아래는 배포·정리 이후 재확인할 체크리스트입니다. **체크박스는 이번 문서 수정에서 기능을 새로 실측했다는 표시가 아닙니다.** 별도 테스트 데이터와 권한을 사용하고 운영 기록을 임의로 수정하지 않습니다.

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

일부 기존 테스트는 MySQL 오류·설정 호환을 기준으로 작성되어 있으므로 테스트 프로세스에서만 `DB_ENGINE=mysql`을 설정합니다. 이는 실제 서비스 `.env`나 운영 DB를 변경하지 않습니다. 실제 DB 선택 테스트는 비활성화합니다.

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

기존 검증 기록은 단위 테스트 118개 중 112개 통과·선택 DB 테스트 6개 제외입니다. 실제 PostgreSQL의 인증·CRUD·연결은 격리된 임시 스키마에서 검증하고 롤백했습니다. 이전 당시 17개 테이블·영속 데이터 70개 행을 전체 대조했습니다. 이 숫자는 현재 운영 데이터 수가 아닙니다.

PC·태블릿·모바일 **크기별 브라우저 검증**을 진행했으며 모든 실제 기기의 검증과 같지 않습니다. 유료 AI의 운영 재호출·새 SQL 백업 복원은 이번 문서 수정에서 실행하지 않습니다.

이번 README 수정에서도 위 명령을 일반 실행 환경에서 재실행하여 **118개 실행·112개 통과·6개 선택 DB 테스트 제외**를 확인했습니다. 최초 격리 환경 실행은 응답이 멈춰 중단한 뒤 재실행했습니다. Starlette TestClient의 httpx 관련 사용 중단 예정 경고가 있었지만 테스트 실패는 없었습니다. 문서의 11개 번호 섹션·목차 이동 링크·사진 6개·로컬 문서 링크도 검사했습니다. SQL 백업·복원 예시는 실행하지 않았고 유료 AI 호출도 하지 않았습니다.

### 남은 작업·관련 문서

클라우드 예약 검색·삭제 이력 영속화, 실제 하이라이트 제작, 배포본 실기기 전체 점검은 남은 작업입니다. Notion 원본 온라인 수정은 편집 접근 권한 확보가 필요합니다.

[로그인·권한](AUTH_SETUP.md) · [관리자 관리](ADMIN_RECORD_MANAGEMENT.md) · [디자인](DESIGN_REFRESH.md) · [AI 검수](VIDEO_REVIEW_SETUP.md) · [YouTube 검색](YOUTUBE_SYNC.md) · [Supabase 이전](SUPABASE_MIGRATION.md) · [Vercel 배포](VERCEL_DEPLOYMENT.md)

위 단계별 문서에 과거 MySQL 상태·배포 전 설명이 남아 있다면 현재 구성·완료 상태는 이 README와 실제 환경을 기준으로 확인합니다.
