# ⚽ WGH Futsal Match

**We Go High (WGH)** 풋살팀의 경기 일정, 경기 결과, 선수별 누적 기록을 관리하는 웹 프로젝트입니다. HTML·CSS·JavaScript로 화면을 구성하고, 경기와 선수 데이터는 MySQL에서 조회합니다.

**Node.js + Express 개발 환경을 기준으로 시작한 프로젝트**이며, 저장소에는 Python FastAPI 구현도 추가되어 있습니다. 두 서버가 지원하는 기능은 서로 다릅니다.

> 현재 `public/app.js`는 FastAPI에 추가된 전체 일정 API를 사용합니다. `node server.js`만 실행하면 경기 기록과 선수 조회 API는 사용할 수 있지만, 화면의 다음 경기 조회와 영상 업로드까지 모두 동작하지는 않습니다. 아래 지원 범위와 실행 방법을 확인해 주세요.

이 문서는 2026-10-16에 저장소 `main`의 코드(`9f08bb1`)를 기준으로 정리했습니다.

## 주요 기능과 구현 상태

| 기능 | Node.js · `server.js` | FastAPI · `main.py` |
| --- | --- | --- |
| 경기 결과 조회·등록·수정·삭제 | API 구현 | API 구현 |
| 점수에 따른 승·무·패 자동 판정 | 구현 | 구현 |
| 최근 5경기 / 전체 경기 전환 | 공통 프런트엔드에서 처리 | 공통 프런트엔드에서 처리 |
| 경기 수·승·무·패·승률·총 득점·총 실점 | 조회한 경기로 프런트엔드에서 계산 | 조회한 경기로 프런트엔드에서 계산 |
| 경기 일정 등록 / 가장 가까운 일정 1건 조회 | API 구현 | API 구현 |
| 예정된 전체 일정 조회·수정·삭제 | API 없음 | API 구현, 현재 화면에서 사용 |
| 선수 이름·등번호·포지션·누적 출전·득점·도움 조회 | API 구현 | API 구현 |
| 영상 파일 업로드·목록 조회·재생 | API 없음 | API 구현 |
| AI 분석·코치 피드백·하이라이트 자동 제작 | 미구현 | 미구현, 준비 화면만 있음 |

공통 화면에는 WGH 로고, 손글씨 타이틀 이미지, 경기 등록 팝업과 선수 카드가 포함되어 있습니다. CSS에는 화면 너비에 따른 반응형 규칙이 있습니다.

### 날짜와 시간 입력

- 경기 날짜는 브라우저의 날짜 입력창을 사용합니다. `showPicker()`를 지원하는 브라우저에서는 입력창을 클릭하면 달력을 열도록 작성되어 있습니다.
- 일정 시간에 `2000`을 입력한 뒤 입력칸에서 벗어나면 `20:00`으로 변환합니다.
- 시간은 `00:00`~`23:59` 형식이며, 종료 시간은 시작 시간보다 늦어야 합니다. 자정을 넘기는 일정 입력은 현재 검증 방식에서 지원하지 않습니다.
- 새 일정 등록창을 열면 이전 입력값과 날짜·요일 표시를 초기화합니다.

## 기술 구성

| 구분 | 사용 기술 |
| --- | --- |
| 프런트엔드 | HTML, CSS, JavaScript |
| Node.js 서버 | Express 5, `mysql2/promise`, dotenv, CommonJS |
| 추가된 Python 서버 | FastAPI, Uvicorn, PyMySQL, Pydantic, python-dotenv |
| 데이터베이스 | MySQL |
| 영상 저장 · FastAPI | 로컬 파일 + JSON 목록 |
| 개발·버전 관리 | VS Code, Git, GitHub |

Node.js 패키지는 `package.json`과 `package-lock.json`, Python 패키지는 `requirements.txt`에서 관리합니다. `package-lock.json`에 기록된 Express의 Node.js 최소 요구 버전은 18입니다.

## 프로젝트 구조

```text
futsal_match/
├── public/
│   ├── images/
│   │   ├── hero-bg.jpg
│   │   ├── pink-ball.png
│   │   ├── we-go-high.png
│   │   └── wgh-logo.png
│   ├── index.html       # 메인 화면: 경기·일정·선수·통계
│   ├── app.js           # 메인 화면의 API 호출 및 이벤트 처리
│   ├── style.css        # 공통 스타일과 반응형 규칙
│   └── video.html       # 영상 시청·업로드 화면, 자체 스크립트 포함
├── uploads/
│   └── videos/
│       ├── videos.json  # FastAPI 영상 목록·파일 정보
│       └── *.mp4        # 저장된 영상 파일 예시
├── server.js            # Node.js / Express 서버
├── main.py              # Python / FastAPI 서버
├── package.json
├── package-lock.json
├── requirements.txt
├── .gitignore
└── README.md
```

`public/`에는 이전 작업을 보관한 `*_backup*` 파일도 있습니다. 메인 화면에서 실제로 불러오는 파일은 `app.js`와 `style.css`입니다. `.env`는 각 개발 PC에서 별도로 생성합니다.

## 데이터베이스와 저장 방식

| 저장 대상 | 저장 위치 | 코드에서 사용하는 정보 |
| --- | --- | --- |
| 경기 결과 | MySQL · `futsal_match` | 경기 ID, 사용자 ID, 날짜, 상대팀, 점수, 장소, 결과, 메모 |
| 경기 일정 | MySQL · `futsal_schedule` | 일정 ID, 사용자 ID, 날짜, 시작·종료 시간, 상대팀, 장소, 메모 |
| 선수 정보 | MySQL · `futsal_player` | 선수 ID, 이름, 등번호, 포지션 |
| 선수별 경기 기록 | MySQL · `match_player` | 출전 기록과 득점·도움 집계에 사용 |
| 업로드 영상 · FastAPI | `uploads/videos/` | ID 기반 파일명으로 저장한 원본 영상 |
| 영상 목록 · FastAPI | `uploads/videos/videos.json` | `video_id`, `filename`, `stored_name`, `url` |

테이블명과 컬럼명은 영문으로 관리하며, 화면의 항목명과 포지션은 한글로 표시합니다. `GK`, `FIXO`, `ALA`, `PIVO`는 각각 골키퍼, 픽소, 아라, 피보로 변환합니다.

**저장소에는 DB 생성·테이블 생성 SQL이나 DB 덤프가 포함되어 있지 않습니다.** 새 PC에서는 기존 프로젝트의 DB 백업을 별도로 복원하거나 실제 스키마를 준비해야 합니다. 서버를 실행해도 DB와 테이블을 자동으로 만들지 않습니다.

현재 경기·일정 등록은 테스트 사용자 `user_id = 1`을 사용합니다. 기존 DB에 사용자 외래 키가 설정되어 있다면 해당 사용자 데이터도 필요합니다.

## Node.js로 로컬 실행

Windows 11의 VS Code 터미널에서 실행하는 순서입니다. MySQL 서버와 위 테이블이 준비되어 있어야 합니다.

### 1. 저장소 복제 및 패키지 설치

```powershell
git clone https://github.com/YuNi-100/futsal_match.git
cd futsal_match
npm ci
```

### 2. 환경 변수 설정

프로젝트 최상위 폴더에 `.env` 파일을 만들고 본인의 MySQL 연결 정보를 입력합니다.

```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=your_mysql_user
DB_PASSWORD=your_mysql_password
DB_NAME=futsaldb
```

`DB_NAME`은 실제로 준비한 DB 이름과 일치해야 합니다. `.env`는 Git에서 제외되므로 다른 PC에서도 별도로 설정해야 합니다.

### 3. 서버 실행

`server.js`가 있는 프로젝트 최상위 폴더에서 실행합니다.

```powershell
node server.js
```

- 홈페이지: <http://localhost:3000/>
- 경기 목록 API: <http://localhost:3000/api/matches>
- 선수 목록 API: <http://localhost:3000/api/players>

DB 연결에 성공하면 터미널에 `MySQL 연결 성공!`이 표시됩니다. API의 정상 응답은 `success: true`와 `data` 배열을 포함합니다. 데이터가 없으면 배열은 비어 있을 수 있습니다.

현재 Express 포트는 코드에 `3000`으로 고정되어 있습니다. `package.json`에는 명시적인 `start` 스크립트가 없어 여기서는 `node server.js`로 안내합니다. `npm test`는 실제 테스트가 아닌 기본 오류 출력 명령입니다.

**Node.js 실행 시의 제약:** 현재 메인 화면은 `GET /api/schedules`를 호출하지만 Express에는 이 경로가 없습니다. 따라서 다음 경기 영역은 DB에 일정이 있어도 갱신되지 않습니다. `GET /api/schedules/next`는 별도로 구현되어 있습니다. 영상 페이지 파일은 열 수 있지만 업로드·목록·재생 API는 지원하지 않습니다.

HTML을 직접 열거나 Live Server만 실행하면 `/api/...` 요청을 처리할 백엔드가 연결되지 않습니다. 위 서버 주소로 접속해 주세요.

## FastAPI로 실행하는 경우

현재 화면이 사용하는 전체 일정 API와 영상 업로드 API를 사용하려면 `main.py`를 실행합니다. Express와 FastAPI는 같은 화면을 제공하는 **대체 서버**이며, 현재 코드에는 두 서버 사이의 자동 연결이나 프록시 설정이 없습니다.

프로젝트 최상위 폴더에서 다음 명령을 실행합니다. `.env`와 MySQL 준비는 Node.js 실행과 같습니다.

```powershell
py -3.10 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m pip install python-multipart
.\.venv\Scripts\python.exe -m uvicorn main:app --reload --port 8000
```

`py -3.10`은 Python 3.10이 설치된 경우의 Windows 명령 예시입니다. 저장소에 Python 실행 버전 지정 파일은 없으며, 고정된 의존성 전체를 Python 3.10.10에서 설치·실행 검증한 상태는 아닙니다.

> 영상 업로드의 `UploadFile` / `File(...)` 처리에는 `python-multipart`가 필요하지만, 현재 `requirements.txt`에는 누락되어 있어 별도로 설치합니다.

- 홈페이지: <http://localhost:8000/>
- 경기 영상: <http://localhost:8000/video.html>
- API 문서: <http://localhost:8000/docs>
- 서버 확인: <http://localhost:8000/api>
- DB 연결 확인: <http://localhost:8000/api/db-test>

`public/`와 `uploads/videos/`는 현재 작업 폴더를 기준으로 참조하므로 프로젝트 최상위 폴더에서 서버를 실행해야 합니다. 메인 화면에는 아직 영상 페이지 링크가 없어 위 영상 주소로 직접 접속합니다.

## API 지원 목록

경로의 `{id}`는 실제 경기·일정·영상 ID로 바꿉니다. Express 코드에서는 `:id`, FastAPI에서는 `{match_id}` 등의 매개변수 이름을 사용합니다.

| Method | 경로 | 기능 | Express | FastAPI |
| --- | --- | --- | --- | --- |
| GET | `/api/matches` | 경기 목록 조회 | 지원 | 지원 |
| POST | `/api/matches` | 경기 결과 등록 | 지원 | 지원 |
| PUT | `/api/matches/{id}` | 경기 결과 수정 | 지원 | 지원 |
| DELETE | `/api/matches/{id}` | 경기 결과 삭제 | 지원 | 지원 |
| GET | `/api/players` | 선수 정보와 누적 기록 조회 | 지원 | 지원 |
| POST | `/api/schedules` | 일정 등록 | 지원 | 지원 |
| GET | `/api/schedules/next` | 오늘 날짜 이후(오늘 포함)의 가장 가까운 일정 1건 | 지원 | 지원 |
| GET | `/api/schedules` | 오늘 날짜 이후(오늘 포함)의 전체 일정 | 없음 | 지원 |
| PUT | `/api/schedules/{id}` | 일정 수정 | 없음 | 지원 |
| DELETE | `/api/schedules/{id}` | 일정 삭제 | 없음 | 지원 |
| POST | `/api/videos/upload` | 영상 업로드 · multipart의 `file` 필드 | 없음 | 지원 |
| GET | `/api/videos` | 업로드 영상 목록 | 없음 | 지원 |
| GET | `/api/videos/{id}` | 영상 파일 응답 | 없음 | 지원 |
| GET | `/api` | 서버 응답 확인 | 없음 | 지원 |
| GET | `/api/db-test` | DB 연결 확인 | 없음 | 지원 |

## 현재 제한 사항

- **선수 기록 입력:** 경기 등록창에 참가 선수·득점·도움 입력 UI는 있지만, 현재 전송 데이터와 경기 등록·수정 API에는 해당 기록을 저장하는 처리가 없습니다. 선수 카드의 누적 기록은 DB에 이미 저장된 `match_player` 데이터를 집계합니다. 선수 등록·수정·삭제 API도 없습니다.
- **일정 편집:** 프런트엔드에 정의되지 않은 `loadScheduleForEdit()` 호출이 남아 있습니다. 일정 수정 API 구현과 별개로 편집 버튼 동작은 추가 점검이 필요합니다.
- **영상:** 현재는 파일 업로드 방식입니다. 영상 정보에 경기 ID나 경기 날짜를 연결하는 처리는 없으며, YouTube 링크 등록도 구현되어 있지 않습니다.
- **AI:** 분석 실행 버튼은 비활성 상태입니다. AI 하이라이트 탭과 분석 결과 영역은 준비 화면이며, 분석·피드백 저장·자동 편집 API는 없습니다.
- **로그인·권한:** 로그인과 관리자 권한 검사가 구현되어 있지 않습니다. 고정된 `user_id = 1`은 인증 기능이 아니며, 현재 등록·수정·삭제 API에도 관리자 제한이 없습니다.

## 배포와 데이터 보관

저장소에 등록된 홈페이지 주소는 <https://futsal-match-theta.vercel.app/>입니다. 이 README에서는 해당 배포의 현재 동작 여부를 검증하지 않았습니다.

저장소에는 Vercel 전용 설정이나 서버리스 진입점이 없습니다. 실제 서비스에 배포하려면 선택한 백엔드의 실행 방식, 배포 환경 변수, 배포 서버에서 접근 가능한 MySQL 연결을 별도로 구성해야 합니다. 정적 화면을 배포하는 것만으로 DB API까지 연결되지는 않습니다.

FastAPI 영상 업로드는 실행 서버의 로컬 디스크를 사용합니다. 재배포 후에도 영상을 보관하려면 파일과 `videos.json`을 함께 유지할 저장소가 필요합니다. 새 PC로 옮길 때도 Git 소스, MySQL 백업, `.env`, 영상 파일·목록을 각각 확인해야 합니다.

현재 `.gitignore`는 `.env`, `node_modules`, `.venv/`, `__pycache__/`를 제외합니다. `uploads/videos/`는 제외되어 있지 않고 영상 파일도 저장소에 포함되어 있으므로, 영상을 커밋하기 전 공개 범위와 촬영 대상자의 동의 여부를 확인해 주세요. 실제 DB 비밀번호는 코드나 README에 넣지 않습니다.

