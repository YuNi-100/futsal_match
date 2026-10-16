# ⚽ WGH Futsal Match

**We Go High (WGH)** 풋살팀의 경기 결과·일정·선수 누적 기록과 경기 영상을 관리하는 웹 프로젝트입니다. 현재 실행 구성은 **FastAPI + MySQL + HTML/CSS/JavaScript**입니다.

> 2026-10-16 로컬 `main`(기준 커밋 `3c61c4e` 및 커밋 전 작업 상태)의 코드 확인 기준입니다. Node.js의 `server.js`, `package.json`, `package-lock.json`은 로컬 `legacy_node/`로 보관하고 GitHub에서는 제외할 예정입니다. 관련 삭제와 `.gitignore`, `public/index.html` 변경은 스테이징되어 있으나 아직 커밋·푸시되지 않았습니다. 원격 저장소에는 반영 전 파일이 남아 있을 수 있습니다. 이 문서의 실행 기준은 FastAPI입니다.

## 구현된 기능과 범위

| 영역 | 현재 구현 | 범위·제한 |
| --- | --- | --- |
| 경기 결과 | 목록 조회, 등록·수정·삭제, 점수에 따른 승·무·패 판정 | MySQL 저장. 최근 5경기/전체 전환과 경기 수·승무패·승률·총 득실점은 화면에서 계산 |
| 선수 기록 | 이름·등번호·포지션·누적 출전·득점·도움 조회 | `match_player`에 이미 저장된 기록 집계. 선수 관리 CRUD API는 없음 |
| 경기 일정 | 등록·조회·수정·삭제 API, 다음 일정·예정 일정 화면 | 오늘 포함 이후 날짜 기준. 일정 편집 화면에는 아래 알려진 제약이 있음 |
| YouTube 영상 | 제목·링크·경기 날짜 등록, 목록 조회, 선택 영상 임베드 재생 | 메타데이터는 MySQL, 원본은 YouTube 보관. 동일 영상 ID 중복 등록 차단 |
| 영상과 경기 연결 | 등록 API가 선택적인 `match_id`를 검증·저장 | 현재 등록 화면은 `match_id: null` 전송. 경기별 상세 화면 연결은 향후 구현 |
| 로컬 영상 | 파일 업로드·목록·파일 응답 API 유지 | 현재 `video.html`은 YouTube 방식 사용. 로컬 파일과 JSON 목록은 별도 저장 |
| AI 피드백 시범 기능 | `feedback.html`에서 등록된 YouTube 영상의 1~180초 구간을 Gemini로 분석 요청 | 팀 유니폼 설명·동의 필요. 시간·응답 형식 검증 및 JSON 다운로드 지원. DB 결과 저장·자동 하이라이트는 없음 |
| 경기 기사 초안 | `article.html`에서 선택 경기의 DB 기록으로 템플릿 또는 OpenAI 초안 생성 | 검수용 초안·JSON 다운로드. 선수별 득점 장면이나 영상 분석에 근거한 기사는 아님. DB 저장 없음 |

`main.py`에는 Gemini 연결 테스트와 로컬 영상 압축·분석 API도 있습니다. 이는 코드가 존재하는 시범 기능이며, 전체 경기 분석·득점자 식별·분석 이력 관리·하이라이트 자동 제작이 완성되었다는 의미는 아닙니다. 외부 AI의 응답 성공과 품질은 키·모델 접근 권한·사용량·영상 상태에 따라 달라집니다.

### 입력·화면 동작

- 경기·일정 날짜는 브라우저 날짜 입력창을 사용하며 지원 브라우저에서는 달력 열기를 제공합니다.
- 일정 시간은 `2000` 입력 후 `20:00`으로 변환하는 처리가 있습니다. 종료 시간은 시작 시간보다 늦어야 하며 자정을 넘는 일정은 현재 검증 방식으로 지원하지 않습니다.
- 기본 선수 카드와 화면 너비별 CSS 규칙이 있습니다. 확장된 선수 소개 카드와 전 화면 모바일 최적화는 향후 작업입니다.

### 알려진 제약

- 경기 등록창의 참가 선수·득점·도움 입력 UI와 달리, 현재 경기 저장 요청·API에는 선수별 기록 저장 처리가 없습니다. 경기 결과 저장만으로 선수 누적 기록이 갱신되지는 않습니다.
- `public/app.js`에 정의되지 않은 `loadScheduleForEdit()` 호출이 남아 있어 일정 편집 화면 동작에 추가 점검이 필요합니다. 수정 API 구현과 화면의 완성도는 구분합니다.
- YouTube 영상 수정·삭제 API는 없습니다. 임베드 재생은 YouTube의 공개 상태와 임베드 허용 여부 등에 영향을 받습니다.
- 영상 페이지의 AI 하이라이트 탭과 분석 결과 목록은 준비 영역입니다. 별도 피드백 페이지의 결과가 그 목록에 자동 저장되거나 연결되지 않습니다.
- 로그인·서버 권한 검사는 미구현이며 임시 `user_id = 1`을 사용합니다. 화면 버튼을 숨기는 것은 관리자 인증을 대신하지 못합니다.

## 기술 구성

| 구분 | 기술 |
| --- | --- |
| 서버 | Python, FastAPI, Uvicorn, Pydantic |
| DB 연결 | MySQL, PyMySQL, python-dotenv |
| 화면 | HTML, CSS, JavaScript, 같은 서버의 상대 경로 API 호출 |
| AI 시범 연동 | Google Gen AI SDK, OpenAI SDK |
| 로컬 영상 분석 | FFmpeg 외부 실행 파일, 로컬 파일·JSON |
| 버전 관리 | Git, GitHub |

Node.js 설치나 `npm` 실행은 현재 서비스 실행에 필요하지 않습니다.

## 폴더 구조

```text
futsal_match/
├── main.py                 # FastAPI, 경기·선수·일정, 로컬 영상·AI, 정적 파일 제공
├── youtube_videos.py       # YouTube 등록·목록 API와 URL 검증
├── video_repository.py     # YouTube 메타데이터 MySQL 접근
├── youtube_feedback.py     # YouTube 구간별 Gemini 피드백
├── article_routes.py       # 경기 기사 생성 API
├── article_generation.py   # DB 사실 기반 템플릿/AI 기사 초안
├── requirements.txt
├── public/
│   ├── index.html          # 메인 화면
│   ├── app.js
│   ├── style.css
│   ├── images/
│   ├── video.html
│   ├── video.js            # YouTube 등록·목록·재생
│   ├── feedback.html
│   ├── feedback.js
│   └── article.html
├── uploads/                # 로컬 전용, Git 제외 규칙
│   └── videos/             # 원본·분석용 압축 파일·videos.json
├── legacy_node/            # 이전 Node.js 파일의 로컬 보관, Git 제외 규칙
├── .env                    # 개발 PC에서 별도 관리, Git 제외
├── .gitignore
└── README.md
```

`main_backup.py`, `public/*_backup*` 등은 과거 작업 보관 파일이며 현재 서버 진입점은 `main.py`입니다. Git 제외 폴더와 `.env`는 새로 복제한 저장소에 자동 제공되지 않습니다.

## 로컬 실행·환경설정

기존 작업자는 **현재 저장소를 그대로 사용**합니다. 프로젝트를 재생성하거나 기존 스테이징 변경을 초기화할 필요가 없습니다. MySQL 서버와 기존 스키마·데이터가 준비되어 있어야 합니다.

### 1. Python 환경

저장소 최상위 폴더에서 실행합니다. 아래는 Windows PowerShell 예시입니다. 기존 `.venv`가 있으면 가상환경 생성 명령은 생략합니다.

```powershell
py -3 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m pip install python-multipart google-genai
```

현재 `requirements.txt`에는 `python-multipart`, `google-genai`, `openai`가 빠져 있습니다. 파일 업로드 라우트와 최상위 Gemini import 때문에 앞의 두 패키지는 서버 시작에도 필요합니다. 기사 생성의 OpenAI 모드를 사용할 때만 아래 패키지도 설치합니다.

```powershell
.\.venv\Scripts\python.exe -m pip install openai
```

저장소에 Python 버전 지정 파일은 없습니다. 위 명령은 설치 안내이며 새 환경에서 고정 의존성 전체의 설치·실행을 검증한 보장은 아닙니다. 로컬 영상 압축·분석은 별도로 설치한 `ffmpeg`가 PATH에서 실행 가능해야 합니다. YouTube 등록·재생에는 FFmpeg가 필요하지 않습니다.

### 2. 환경 변수

저장소 최상위 `.env`에 기존 MySQL 연결값을 설정합니다. 아래 값은 형식 예시이며 실제 비밀번호·키를 문서나 소스에 기록하지 않습니다. 기존 `.env`를 덮어쓰지 마세요.

```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=your_mysql_user
DB_PASSWORD=your_mysql_password
DB_NAME=your_existing_database
```

AI 기능을 사용한다면 서버 환경에 다음 변수도 설정합니다.

| 변수 | 용도 |
| --- | --- |
| `GEMINI_API_KEY` | Gemini 연결 테스트·영상 분석·YouTube 피드백 |
| `GEMINI_MODEL` | 로컬 영상 분석 모델, YouTube 피드백의 대체 설정 |
| `GEMINI_FEEDBACK_MODEL` | YouTube 피드백 모델 우선 설정 |
| `OPENAI_API_KEY` | 기사 초안의 OpenAI 모드 |
| `OPENAI_MODEL` | 기사 초안 모델 |

키 없이도 기본 경기·선수·일정·YouTube 기능과 템플릿 기사 생성은 사용할 수 있습니다. 모델 기본 문자열은 코드에 있으나 현재 계정에서 사용 가능한 모델인지는 별도 확인이 필요합니다. 환경 변수를 변경하면 서버를 재시작합니다.

### 3. 서버 시작

```powershell
.\.venv\Scripts\python.exe -m uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

- 홈: <http://localhost:8000/>
- 경기 영상: <http://localhost:8000/video.html>
- YouTube 피드백 시범 화면: <http://localhost:8000/feedback.html>
- 기사 초안 화면: <http://localhost:8000/article.html>
- API 문서: <http://localhost:8000/docs>
- 서버 응답: <http://localhost:8000/api>
- DB 연결 확인: <http://localhost:8000/api/db-test>

`public/`와 `uploads/videos/`는 실행 위치를 기준으로 참조하므로 반드시 저장소 최상위에서 실행합니다. HTML 파일을 직접 열거나 정적 화면만 제공하면 DB API가 연결되지 않습니다. `--reload`는 개발용입니다.

## 데이터베이스와 저장 방식

아래는 SQL 코드가 사용하는 테이블·필드 요약입니다. 실제 운영 DB의 전체 스키마나 제약조건을 조사한 결과는 아닙니다.

| 대상 | 저장 위치 | 코드에서 사용하는 내용 |
| --- | --- | --- |
| 경기 결과 | MySQL `futsal_match` | 경기 ID·사용자 ID·날짜·상대·점수·장소·승무패·메모 |
| 일정 | MySQL `futsal_schedule` | 일정 ID·사용자 ID·날짜·시작/종료 시간·상대·장소·메모 |
| 선수 | MySQL `futsal_player` | 선수 ID·이름·등번호·포지션 |
| 선수별 기록 | MySQL `match_player` | 경기·선수 연결, 출전 행 수와 득점·도움 집계 |
| YouTube 정보 | MySQL `futsal_video` | `video_id`, `user_id`, 선택적 `match_id`, `title`, `youtube_id`, `match_date`, `created_at` |
| YouTube 원본 | YouTube | WGH는 URL·ID 등 메타데이터만 저장 |
| 로컬 업로드 | `uploads/videos/`와 `videos.json` | 원본 파일과 `video_id`, `filename`, `stored_name`, `url` 목록 |
| 기사·YouTube 피드백 | 요청 응답·브라우저 JSON 다운로드 | 현재 DB 영구 저장 없음 |

서버는 DB와 테이블을 자동 생성하지 않습니다. 추적된 저장소에는 스키마 생성 SQL·DB 덤프가 없어 새 PC에서 소스만 복제하면 데이터가 복원되지 않습니다. 기존 DB 백업과 실제 스키마를 별도로 준비해야 합니다. 임시 사용자 1을 참조하므로 기존 외래 키와 사용자 데이터도 유지해야 합니다.

경기 삭제 API는 해당 `match_player` 기록도 삭제합니다. YouTube의 경기 연결과 관련된 실제 외래 키 정책은 운영 스키마 확인이 필요합니다. README 정리 과정에서는 DB 조회·변경·스키마 생성을 수행하지 않았습니다.

## API 목록

`{match_id}`, `{schedule_id}`, `{video_id}`는 실제 ID입니다. 로컬 영상 ID와 MySQL YouTube 영상 ID는 서로 다른 저장 체계입니다.

| Method | 경로 | 역할 |
| --- | --- | --- |
| GET | `/api` | 서버 응답 확인 |
| GET | `/api/db-test` | DB 연결 확인 |
| GET / POST | `/api/matches` | 경기 목록 / 등록 |
| PUT / DELETE | `/api/matches/{match_id}` | 경기 수정 / 삭제 |
| GET | `/api/players` | 선수·누적 기록 조회 |
| GET / POST | `/api/schedules` | 예정 일정 목록 / 등록 |
| GET | `/api/schedules/next` | 오늘 포함 이후 가장 가까운 일정 1건 |
| PUT / DELETE | `/api/schedules/{schedule_id}` | 일정 수정 / 삭제 |
| GET / POST | `/api/youtube-videos` | YouTube 목록 / 등록 |
| POST | `/api/youtube-videos/{video_id}/feedback` | 등록 YouTube 구간별 Gemini 피드백 |
| POST | `/api/matches/{match_id}/article` | 경기 기사 초안 (`template` / `openai`) |
| POST | `/api/videos/upload` | 로컬 영상 업로드 (`multipart`의 `file` 필드) |
| GET | `/api/videos` | 로컬 영상 목록 |
| GET | `/api/videos/{video_id}` | 로컬 영상 파일 응답 |
| GET | `/api/ai/test` | 외부 Gemini 호출 테스트 |
| POST | `/api/videos/{video_id}/analyze` | 로컬 영상 압축·Gemini 분석 |

상세 요청 형식은 `/docs`와 각 라우트의 Pydantic 모델을 확인합니다. AI 테스트·분석·OpenAI 기사 생성은 외부 호출과 비용이 발생할 수 있으므로 단순 서버 확인에는 `/api`를 사용합니다.

## 보안·배포

- `.env`, API 키, DB 비밀번호·덤프, 개인 연락처·비공개 선수 정보는 GitHub나 브라우저 코드에 넣지 않습니다. 외부 공유용 로그·JSON·화면 캡처도 내용을 확인합니다.
- 현재 `.gitignore`는 `.env`, `node_modules`, `.venv/`, `__pycache__/`, `uploads/`, `legacy_node/`를 제외합니다. 이미 추적된 파일에는 제외 규칙만으로 소급 적용되지 않으므로 공개 전 추적 상태를 확인해야 합니다. 다른 이름의 가상환경 폴더는 별도 점검 대상입니다.
- 현재 API는 로그인·관리자 승인·호출 제한이 없는 로컬 개발 상태입니다. 공개 운영 전 서버 인증·인가, AI 비용 제한, 업로드 크기·파일 검증, HTTPS와 비밀값 관리가 필요합니다. 고정 사용자 번호는 인증 기능이 아닙니다.
- AI 요청 시 선택 영상 또는 경기 정보가 외부 제공자에게 전달됩니다. 영상 공개 범위와 이용 동의를 확인하고 결과는 사람이 검수합니다. 피드백의 프로세스 내 잠금은 서비스 전체의 호출 제한을 대신하지 않습니다.
- 정적 호스팅만으로 FastAPI와 MySQL이 실행되지는 않습니다. 서버 실행 환경, DB 접근, 환경 변수, 로컬 영상용 영구 디스크를 별도 구성해야 합니다. 공개 배포의 현재 동작은 이 문서 갱신에서 검증하지 않았습니다.

## 백업·복원과 향후 DB 이전

Git은 소스 이력이며 MySQL 데이터 백업이 아닙니다. DB는 별도 백업이 필요합니다.

1. 기존 MySQL을 관리 도구로 논리 백업하고 스키마·데이터·제약조건·문자셋을 함께 보관합니다. 운영 데이터를 바꾸지 않는 백업 절차를 사용합니다.
2. `.env`는 Git 외부의 접근 제한된 저장소에 보관합니다. 로컬 영상이 있다면 원본과 `videos.json`을 일관된 시점에 함께 백업합니다. YouTube 링크 백업은 원본 영상 백업을 대신하지 않습니다.
3. 복원은 별도 테스트 DB에서 먼저 확인하고 테이블별 건수, 경기·선수·영상 연결, 날짜·시간과 한글 표시를 검증합니다. 공개 저장소에 덤프나 개인정보를 올리지 않습니다.

**향후 계획:** 배포 환경이 정해지면 관리형 MySQL 등 이전 대상을 선정하고 현재 스키마를 기준으로 마이그레이션 절차를 마련합니다. 대상 제품과 다른 DB 엔진으로의 전환은 아직 확정하지 않았습니다. 백업 → 별도 환경 복원 → 관계·건수·CRUD 검증 → 환경 변수 전환 → 롤백용 기존 DB 보존 순서로 진행할 계획입니다. 이 계획은 현재 DB를 변경하라는 실행 지시가 아닙니다.

## 향후 개발 계획

아래 항목은 현재 완성 기능과 구분한 계획입니다.

- **경기 기록 상세 페이지:** 경기별 득점자·영상·하이라이트를 함께 제공하고 경기와 영상 연결 UI를 구현합니다.
- **선수 득점별 경기 연결:** 선수 기록에서 실제 득점 경기를 찾아가도록 상세 기록 저장·조회와 화면을 연결합니다.
- **Google 로그인 + 승인 관리자 권한:** 로그인 사용자와 승인된 관리자를 구분하고 등록·수정·삭제 권한을 서버에서 검증합니다.
- **선수 소개 카드:** 현재 기본 기록 카드에 소개와 프로필 구성을 확장합니다.
- **공지 및 홈 재배치:** 공지 기능을 추가하고 경기·일정·영상·선수 영역의 배치를 개선합니다.
- **모바일 반응형:** 기존 CSS를 기반으로 각 화면의 탐색·입력·재생을 모바일에서 검증하고 개선합니다.
- **AI 경기 분석 및 하이라이트:** 시범 구간 피드백·로컬 분석을 발전시켜 경기별 분석 결과 저장·조회, 검수와 영상 연결, 하이라이트 생성·재생까지 구현합니다. 자동 득점자 판별과 자동 편집은 현재 지원하지 않습니다.

## 문서 확인 근거

현재 기능은 `main.py`, `youtube_videos.py`, `video_repository.py`, `youtube_feedback.py`, `article_routes.py`, `article_generation.py`와 `public/`의 실제 API 호출·화면 코드를 대조했습니다. 실행 안내는 `requirements.txt`의 누락 의존성과 정적 파일 경로를 반영했습니다. Node.js 보관 상태는 로컬 파일 구성과 스테이징 상태를 기준으로 구분했습니다.

이 문서 갱신은 정적 코드 검토입니다. 서버 실행, 실제 DB 데이터 검증, AI 유료 호출과 모바일 실기기 검증은 수행하지 않았으며 기능의 실행 검증 완료를 주장하지 않습니다.