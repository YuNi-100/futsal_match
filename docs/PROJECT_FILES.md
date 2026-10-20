# WGH 프로젝트 파일 안내

현재 실행 구성은 FastAPI + Supabase PostgreSQL + HTML/CSS/JavaScript입니다. 2026-10-20에 Python 구현을 `src/`의 기능별 패키지로, README 이외의 설명 문서를 `docs/`로 이동했습니다.

## 폴더 구성

| 위치 | 담는 내용 |
| --- | --- |
| `src/app.py` | 기존 FastAPI 서버 구현 |
| `src/api/` | 계정·경기·선수·영상·분석 API |
| `src/auth/` | Google 로그인·세션·권한 |
| `src/db/` | DB 연결과 데이터 저장·조회 |
| `src/services/` | 기사 생성과 경기 참가 기록 처리 |
| `src/cli/` | Vercel 빌드·계정 관리·DB 이전·YouTube 동기화 도구 |
| `src/paths.py` | 저장소 루트 기준의 공통 경로 |
| `docs/` | 기능·설정·배포·기획 문서와 기존 이미지 |
| `public/` | 기존 웹페이지·스타일·JavaScript·이미지 |
| `tests/`, `migrations/` | 기존 테스트와 SQL 이력 |

## 기존 실행 방식 유지

아래 명령은 **저장소 루트에서 실행**합니다. 문서가 `docs/`로 이동해도 작업 폴더를 `docs/`로 바꾸지 않습니다.

| 루트 연결 파일 | 실제 구현 | 기존 명령·설정 |
| --- | --- | --- |
| `main.py` | `src/app.py` | `python -m uvicorn main:app --reload` 및 Vercel·Docker 진입점 |
| `build_vercel.py` | `src/cli/build_vercel.py` | Vercel의 `python build_vercel.py` |
| `manage_auth.py` | `src/cli/manage_auth.py` | `python manage_auth.py --help` |
| `postgres_migrate.py` | `src/cli/postgres_migrate.py` | `python postgres_migrate.py --help` |
| `youtube_sync.py` | `src/cli/youtube_sync.py` | `python youtube_sync.py --help` 및 기존 예약 작업 |

루트의 Python 5개는 실행 호환용 연결 파일입니다. 실제 기능을 수정할 때는 `src/`의 구현을 수정합니다. 각 구현을 파일 경로로 직접 실행하는 대신 위 연결 명령을 사용합니다.

`.env`, `.env.supabase`, `uploads/`, `.wgh-sync/`, `public/`, Vercel 빌드 결과 `wgh_web/`는 계속 저장소 루트를 기준으로 찾습니다. `Dockerfile`, `vercel.json`, `pyproject.toml`, 의존성 잠금 파일과 SQL은 그대로 유지합니다.

## 폴더 정리 검증

- 기존 테스트: 정리 전후 123개 모두 같은 결과(별도 DB가 필요한 6개 제외).
- 경로·실행 연결·Vercel 사본 빌드 회귀 테스트 4개 추가: 총 127개 통과, 6개 제외.
- 정리 전후 OpenAPI 전체 정의와 API 경로 38개 동일.
- `public/` 파일 48개의 내용과 비로그인·회원·관리자 조건에서 페이지·자산 응답 144개 동일. 상태 코드·본문·캐시·리다이렉트·콘텐츠 형식을 비교했습니다.
- Python 3.14 환경에서 검증했습니다. 운영 DB 쓰기·실제 Google 로그인·유료 AI 분석 호출은 이 검증에 포함하지 않습니다.

## 기능별 파일

| 구분 | 파일·폴더 | 역할 |
| --- | --- | --- |
| 서버 | `src/app.py`, `main.py` | 서버 구현 및 기존 실행 진입점 |
| DB | `src/db/database.py` | PostgreSQL 연결·호환 처리·쓰기 대상 확인, MySQL 복구용 연결 |
| 인증 | `src/auth/auth.py`, `src/auth/auth_store.py`, `src/api/account_routes.py`, `manage_auth.py` | Google OAuth·세션·CSRF·계정·관리자 관리 |
| 경기 | `src/api/match_detail_routes.py`, `src/services/match_player_records.py` | 경기 상세와 참가 선수 기록 |
| 선수 | `src/api/player_detail_routes.py`, `src/api/player_management.py` | 선수 상세·집계·관리 |
| 영상 | `src/api/youtube_videos.py`, `src/db/video_repository.py`, `src/api/video_match_link.py` | YouTube 메타데이터·등록·삭제·경기 연결 |
| 분석 | `src/api/youtube_feedback.py`, `src/db/feedback_store.py` | Gemini 분석·저장·검수·게시 |
| 검색 | `src/cli/youtube_sync.py`, `youtube_sync.py` | 채널 검색·조건 확인·중복 방지 등록 및 기존 명령 |
| 시범 기능 | `src/api/article_routes.py`, `src/services/article_generation.py` | 경기 기록 기반 기사 초안 |
| 홈 | `public/index.html`, `app.js`, `style.css` | 홈 콘텐츠·통계·공통 디자인 |
| 공통 화면 | `public/navigation.js`, `auth.js`, `auth.css`, 계정 관련 파일 | 상단 메뉴·로그인 상태·계정 UI |
| 경기 화면 | `public/matches.*`, `match.html`, `match-detail.*` | 경기 목록·상세 |
| 선수 화면 | `public/players.*`, `player.*` | 선수 목록·상세 |
| 일정 화면 | `public/schedules.html`, `schedules.js` | 다음 경기와 일정 관리 |
| 영상 화면 | `public/video.html`, `video.js`, `video.css`, `video-published.js` | 회원용 WGH TV·게시 결과 |
| 영상 관리 | `public/video-register.*`, `video-analysis-form.js`, `video-review-layout.css` | 관리자 등록·분석·연결 관리 |
| 검수 화면 | `public/feedback-review.*` | 분석 결과 편집·검수 완료 게시 |
| 호환 화면 | `public/feedback.html`, `feedback.js`, `video_backup.html` | 기존 경로 호환·권한 처리 참조 확인 필요 |
| 이미지 | `public/images/` | 로고·배경·브랜드 이미지 |
| 배포 | `src/cli/build_vercel.py`, `build_vercel.py`, `vercel.json`, `pyproject.toml`, `uv.lock`, `.python-version`, `.vercelignore` | Vercel 빌드·의존성·자산·보호 페이지 처리 |
| 의존성 | `requirements.txt`, `requirements-postgres-dev.txt` | 실행·개발 의존성 |
| 이전 | `src/cli/postgres_migrate.py`, `postgres_migrate.py`, `migrations/postgresql/` | 안전한 신규 스키마 이전·검증 |
| 과거 SQL | `migrations/001_google_auth.sql` 등 | MySQL 단계의 수동 마이그레이션 이력 |
| 검증 | `tests/` | 서버 단위·선택 DB·브라우저 검증 |
| 설정 예시 | `.env.example`, `.env.supabase.example` | 비밀값 없는 설정 형식. 실제 값은 비공개 파일·서버 환경변수에 저장 |

## 로컬 자료

`.env`, `.env.supabase`, `.wgh-sync/`, 백업·DB 내보내기는 공개 저장소에 올리지 않습니다. `.wgh-sync/`에는 영상 재등록 방지 등 실행 상태가 있으므로 캐시처럼 지우면 안 됩니다. `.venv/`, `.venv-1/`, `legacy_node/`, `uploads/`도 용도를 확인하기 전 삭제하지 않습니다.

`main_backup.py`, `public/*_backup*` 등 과거 정리 후보와 이번 적용 범위는 [FILE_CLEANUP_REVIEW.md](FILE_CLEANUP_REVIEW.md)에 구분했습니다. DB 변경과 기존 웹페이지 삭제는 이번 폴더 정리에 포함하지 않습니다.
