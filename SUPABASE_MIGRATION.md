# WGH PostgreSQL / Supabase 이전

## 현재 완료한 부분과 남은 부분

- 최종 기준: 현재 `futsaldb_test`, 최신 `C:\workspace\futsal_match` 코드.
- 기존 `futsaldb`와 `futsaldb_test`는 삭제/수정하지 않음. 실제 `.env`도 유지.
- PostgreSQL 런타임, 17개 테이블용 스키마, 새 스키마에만 적용하는 이전 도구 준비.
- 이전 자료: `C:\workspace\wgh-backups\wgh-postgres-export-20261019-01`.
- 자료는 17개 테이블, 70개 행. 세션 1개는 제외했으며 새 환경에서 다시 로그인해야 함.
- 회원, Google 식별자 연결, 역할, 동의, 선수 회원 연결, 경기, 득점/도움, 일정, 영상, 분석 원본/검수 게시 결과와 ID를 보존.
- `player` 구 테이블도 보존. 업로드 폴더는 사용자가 비웠으며 업로드 영상은 이전 대상에 없음.
- 실제 PostgreSQL 서버로 가져오기/실제 PostgreSQL API 검증/웹 서버 배포는 아직 수행하지 않음.
- 코드 테스트 117개 중 111개 통과, MySQL 실제 데이터 선택 테스트 6개 제외. 생성 스키마 82개 문장 PostgreSQL 문법 파싱 통과.
- MySQL 실제 경기/선수/일정 GET 조회, 비회원 영상 제한을 읽기 전용으로 재확인.

## 1. Supabase 프로젝트 생성

1. https://supabase.com/dashboard 접속 후 로그인.
2. 조직이 없으면 Create an organization: 이름 WGH, Free 플랜.
3. New project: 이름 `wgh-production`, 지역은 가능한 서울.
4. DB 비밀번호는 별도로 보관. 채팅/브라우저 코드/Git에 입력하지 않음.
5. 생성이 끝나면 상단 Connect → Session pooler 선택.
6. 정확한 host/user를 화면에서 복사. Session pooler는 5432이며 IPv4 환경에서도 사용 가능.
7. 본 프로젝트는 AI 분석 중 세션 단위 advisory lock을 사용하므로 Transaction pooler(6543)를 사용하지 않음.

## 2. 비공개 이전 접속 정보

`.env.supabase.example`을 `.env.supabase`로 복사하고 아래 값만 저장:

```dotenv
WGH_MIGRATION_DATABASE_URL=postgresql://postgres.PROJECT_REF:URL_ENCODED_PASSWORD@EXACT_POOLER_HOST:5432/postgres?sslmode=require
```

host/user는 Dashboard Connect에서 받은 실제 값 사용. 암호의 @, #, :, / 등 예약 문자는 URL 인코딩 필요.
이 파일은 Git에서 제외하며, 만들기만 해서는 현재 홈페이지 연결이 바뀌지 않음.
환경변수 `WGH_MIGRATION_DATABASE_URL`이 있으면 그 값이 파일보다 우선함.

## 3. 데이터 이전

기존 MySQL과 홈페이지를 그대로 두고 새 Supabase 프로젝트에만 적용:

```powershell
cd C:\workspace\futsal_match
.\.venv\Scripts\python.exe postgres_migrate.py import --directory C:\workspace\wgh-backups\wgh-postgres-export-20261019-01 --apply-new-schema
.\.venv\Scripts\python.exe postgres_migrate.py verify --directory C:\workspace\wgh-backups\wgh-postgres-export-20261019-01
```

- `wgh` 스키마가 이미 있으면 중단. DROP/TRUNCATE/기존 데이터 덮어쓰기 없음.
- 모든 테이블을 하나의 트랜잭션에서 생성하고 입력. 전체 행 내용과 외래키 검증 후 커밋.
- ID 및 MySQL의 다음 AUTO_INCREMENT 값까지 고려하여 PostgreSQL identity sequence 설정.
- 임시 로그인/OAuth 상태는 제외. Google 계정 연결과 관리자 역할은 유지.
- 자료 SHA-256 검증 실패 시 중단. DB 비밀번호나 개인정보 행을 콘솔 오류에 출력하지 않음.
- CLI는 데이터 생성·이전 도구이며 앱 시작 시 자동으로 실행되지 않음.
- 새 이전 자료가 필요하면 `export --directory 새_폴더` 사용. 이때도 원본 MySQL에는 읽기만 수행.
- 원본 MySQL에서는 아직 정상 운영 가능. 최종 이전 직전에는 수정·등록을 잠시 멈추고 새 자료를 만들어 변경 누락을 방지.
- 초기 verify는 로그인/새 등록을 시작하기 전에 실행. 이후에는 새 세션/행이 생겨 스냅샷과 달라질 수 있음.

시간: 기존 MySQL 시각은 +09:00 기준으로 읽어 화면 표시 시각을 보존. 로그인 만료는 기존처럼 UTC 기준 timestamp로 처리.
이메일은 lower(email) 고유 인덱스와 대소문자 무시 조회를 사용. ASCII Google 이메일을 전제로 하며 기존 MySQL의 모든 언어 accent-insensitive 정렬을 일반적으로 재현하는 것은 아님.

## 4. 홈페이지 연결 전환과 검증

이전 성공 후에만 서버 환경에 설정:

```dotenv
DB_ENGINE=postgres
DATABASE_URL=위와_같은_실제_PostgreSQL_접속_URL
POSTGRES_EXPECTED_DATABASE=postgres
PG_SSLMODE=require
WGH_ALLOW_ANALYSIS_WRITES=false
WGH_ALLOW_SYNC_WRITES=false
```

기존 MySQL의 DB_HOST/DB_NAME 등은 롤백용으로 보관. DB_ENGINE이 없거나 mysql이면 기존 연결 사용.
PostgreSQL 선택 시 연결 실패해도 MySQL로 자동 우회하지 않음. 잘못된 DB로 쓰는 것을 방지하기 위함.
서버 재시작 후 다음을 확인:

- 홈, 경기 목록/상세, 선수 목록/상세, 다음 경기, 날짜/시간 표시.
- 실제 Google 로그인·로그아웃, 관리자/일반 회원, 동의와 회원 연결.
- 관리자 등록·수정·삭제와 비관리자 API 403 차단, CSRF 누락 차단.
- 경기 수정창의 기존 득점/도움, 영상 연결/해제, 삭제 시 기존 FK 동작.
- AI 검수 원본/게시 결과 조회와 타임스탬프 클릭. 새 유료 분석 호출은 별도 승인 후 수행.

확인 후 `WGH_ALLOW_ANALYSIS_WRITES=true`, `WGH_ALLOW_SYNC_WRITES=true`로 허용.
이 두 기능은 DB 이름과 wgh 스키마도 확인하며 기본은 쓰기 차단.
검증 없이 현재 로컬 `.env`를 PostgreSQL로 바꾸지 않음.

## 5. 보안과 배포

- 이 앱은 기존 FastAPI Google OAuth/서버 세션을 유지. Supabase Auth로 임의 교체하지 않음.
- 앱 테이블은 public이 아닌 비공개 wgh 스키마에 생성, PUBLIC 권한 회수, 모든 테이블 RLS 활성화.
- Supabase API 설정에서 wgh를 exposed schemas에 추가하지 않음. 프런트에서 Supabase DB에 직접 접근하지 않음.
- DB 소유자 연결을 사용하는 신뢰된 FastAPI 서버에서만 DB 조회/수정. 실제 사용자 권한은 FastAPI가 검사.
- Supabase만으로 기존 Python FastAPI 홈페이지를 그대로 호스팅하는 구성은 아님. 별도 컨테이너/웹 서버에 배포.
- Dockerfile과 .dockerignore 준비. .env, .wgh-sync, 업로드, 가상환경이 이미지에 포함되지 않음.
- Docker build 및 외부 서버 배포는 아직 실행하지 않았음. 배포 대상/플랜 선택이 필요.
- 서버 실행: `uvicorn main:app --host 0.0.0.0 --port $PORT` (호스팅 환경의 PORT 사용).
- 서버 secret 설정에 DB URL, Google OAuth, Gemini/OpenAI 기존 키·모델을 넣음. 비밀키를 코드/이미지에 복사하지 않음.
- 최종 HTTPS 주소가 정해지면 Google Cloud 승인된 리디렉션 URI에 `https://도메인/auth/google/callback` 추가.
- 서버 GOOGLE_REDIRECT_URI도 같은 주소로 지정. HTTPS에서는 기존 Secure/__Host- 세션 쿠키 자동 사용.
- 로그인은 프런트와 FastAPI를 같은 도메인에서 서비스하는 현재 방식 유지.

## 6. 자동 영상 등록

- 현재 수·토 18시 Asia/Seoul 작업은 로컬 Codex 자동화이며 PC가 켜져 있어야 실행됨.
- Supabase로 DB를 옮겨도 이 예약이 자동으로 클라우드 작업이 되지는 않음.
- 클라우드 서버에서 스케줄러를 별도로 구성해야 함. UTC 스케줄러라면 수·토 09:00 UTC.
- 명령: `python youtube_sync.py --apply`, DB_ENGINE=postgres와 쓰기 허용 환경변수 필요.
- `.wgh-sync/youtube-state.json`은 삭제한 영상의 재등록 방지 이력이라 영속 볼륨에 이전/보관.
- 여러 인스턴스에서 같은 예약을 중복 실행하지 않음. 기존 로컬 작업은 새 예약 검증 후 정리.

## 7. 롤백

배포 직후 문제 발생 시 등록/수정을 중단하고 마지막 이전 이후 변경분을 별도 보존.
서버 DB_ENGINE=mysql로 되돌리면 기존 futsaldb_test 연결을 사용할 수 있으나, 전환 후 PostgreSQL에 추가한 데이터는 자동 역이전되지 않음.
기존 원본/테스트 MySQL 및 백업 파일은 삭제하지 않음. Git 커밋/Push는 별도 승인 필요.

## 주요 변경 파일

- database.py: 두 엔진 연결, 기존 정적 SQL의 한정된 PostgreSQL 변환, RETURNING, 충돌 오류 호환.
- main.py / video_repository.py: 중앙 DB 연결 사용.
- feedback_store.py / youtube_sync.py: PostgreSQL 검수/분석/동기화 쓰기 확인.
- postgres_migrate.py: 읽기 전용 MySQL export / 새 PostgreSQL 스키마 import / 전체 행 verify.
- migrations/postgresql/001_wgh_schema.sql: 17개 테이블, 제약조건, 인덱스, RLS, 역할 수정 시각 트리거.
- requirements.txt / requirements-postgres-dev.txt: psycopg 드라이버, 선택적 SQL 파서.
- .env.example / .env.supabase.example / .gitignore: 전환 환경변수와 비공개 접속 정보 분리.
- tests/test_postgres.py: SQL 변환, 파라미터 바인딩, 쓰기 잠금 기본 차단, 안전한 이전 테스트.
- Dockerfile / .dockerignore: 비밀키와 로컬 대용량 자료를 제외한 배포 준비.

공식 문서:
- https://supabase.com/docs/guides/database/connecting-to-postgres
- https://supabase.com/docs/guides/platform/migrating-to-supabase/mysql
- https://supabase.com/docs/guides/api/securing-your-api
- https://www.psycopg.org/psycopg3/docs/basic/params.html

## 실제 Supabase 이전 완료 기록 — 2026-10-19

- 사용자 설정의 Session pooler 5432로 연결 성공. 클라이언트→pooler TLS 활성 확인.
- 최신 원본 자료: C:\workspace\wgh-backups\wgh-postgres-export-20261019-02. 첫 추출본과 durable data 동일.
- 새 Supabase wgh 스키마에 17개 테이블 / 70개 행 이전 및 커밋 완료.
- 별도 연결로 전체 행 verify 통과. 기존 MySQL DB는 유지.
- 실제 PostgreSQL 읽기 전용 쿼리로 경기/선수/일정 목록, 경기/선수 상세, 영상, 회원 목록, 분석 목록, 내 페이지/권한 관리 조회 통과.
- 비회원 영상 401 확인. 관리자 조회 경로는 테스트에서 관리자 identity만 대체했으며 실제 Google OAuth 로그인을 수행한 것은 아님.
- 실제 홈페이지 .env는 아직 MySQL. Google 재로그인, 관리자 실제 저장 검증, 연결 전환, FastAPI 웹 서버 배포는 남아 있음.
- 위 본문의 초기 '실제 PostgreSQL 이전 미수행' 상태는 이 완료 기록으로 갱신됨. 배포 명령의 export 경로는 -02를 사용.

## 로컬 홈페이지 Supabase 연결 전환 완료 — 2026-10-19

- 기존 .env는 .wgh-sync/mysql-env-before-postgres-날짜.env에 비공개 백업.
- 현재 .env DB_ENGINE=postgres, DATABASE_URL=Supabase Session pooler, PG_SSLMODE=require.
- POSTGRES_EXPECTED_DATABASE=postgres, 분석/자동등록 쓰기 허용 플래그 true.
- 기존 MySQL 호스트/DB 설정은 롤백용으로 유지. futsaldb와 futsaldb_test 삭제하지 않음.
- 별도 임시 스키마에서 실제 PostgreSQL OAuth 상태 저장/1회 소비, 신규 사용자 저장, 세션 생성/조회/로그아웃, 12시간 만료, CSRF, 일반 회원 거절 검증.
- 같은 임시 스키마에서 경기/선수/일정/영상 등록·수정·삭제, 득점·도움 유지, 경기 삭제 시 영상 연결 해제, 출전 선수 삭제 차단, 동의 upsert와 advisory lock 검증. 전부 트랜잭션 롤백.
- 운영 wgh 전체 70개 데이터 행은 스냅샷과 동일함을 다시 확인.
- database.py의 DATABASE() 변환에 단어 경계를 추가하여 기존 current_database()를 재변환하지 않도록 수정, 회귀 테스트 추가.
- 실제 localhost 서버에서 120초 검증 세션으로 /api/db-test의 database=postgres 확인. 검증 세션은 즉시 삭제.
- 실제 사용자 브라우저의 Google 재로그인/화면 확인은 사용자 확인 필요.
- Vercel은 사용자 요청으로 검토/배포 보류. 코드 커밋·Push 없음.
- AI 유료 분석 및 실제 자동 영상 등록은 호출하지 않음. 기존 로컬 수·토 예약은 유지.
