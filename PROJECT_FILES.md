# WGH 프로젝트 파일 안내

현재 실행 구성은 FastAPI + Supabase PostgreSQL + HTML/CSS/JavaScript입니다. 파일의 실제 위치를 유지한 역할 안내이며, 디렉터리 이동을 수행한 문서가 아닙니다.

| 구분 | 파일·폴더 | 역할 |
| --- | --- | --- |
| 서버 | `main.py` | FastAPI 진입점, 공통 API·라우터·정적 파일·보호 페이지 제공 |
| DB | `database.py` | PostgreSQL 연결·호환 처리·쓰기 대상 확인, MySQL 복구용 연결 |
| 인증 | `auth.py`, `auth_store.py`, `account_routes.py`, `manage_auth.py` | Google OAuth·세션·CSRF·계정·관리자 관리 |
| 경기 | `match_detail_routes.py`, `match_player_records.py` | 경기 상세와 참가 선수 기록 |
| 선수 | `player_detail_routes.py`, `player_management.py` | 선수 상세·집계·관리 |
| 영상 | `youtube_videos.py`, `video_repository.py`, `video_match_link.py` | YouTube 메타데이터·등록·삭제·경기 연결 |
| 분석 | `youtube_feedback.py`, `feedback_store.py` | Gemini 분석·저장·검수·게시 |
| 검색 | `youtube_sync.py` | 채널 검색·조건 확인·중복 방지 등록 |
| 시범 기능 | `article_routes.py`, `article_generation.py` | 경기 기록 기반 기사 초안 |
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
| 배포 | `build_vercel.py`, `vercel.json`, `pyproject.toml`, `uv.lock`, `.python-version`, `.vercelignore` | Vercel 빌드·의존성·자산·보호 페이지 처리 |
| 의존성 | `requirements.txt`, `requirements-postgres-dev.txt` | 실행·개발 의존성 |
| 이전 | `postgres_migrate.py`, `migrations/postgresql/` | 안전한 신규 스키마 이전·검증 |
| 과거 SQL | `migrations/001_google_auth.sql` 등 | MySQL 단계의 수동 마이그레이션 이력 |
| 검증 | `tests/` | 서버 단위·선택 DB·브라우저 검증 |
| 설정 예시 | `.env.example`, `.env.supabase.example` | 비밀값 없는 설정 형식. 실제 값은 비공개 파일·서버 환경변수에 저장 |

## 로컬 자료

`.env`, `.env.supabase`, `.wgh-sync/`, 백업·DB 내보내기는 공개 저장소에 올리지 않습니다. `.wgh-sync/`에는 영상 재등록 방지 등 실행 상태가 있으므로 캐시처럼 지우면 안 됩니다. `.venv/`, `.venv-1/`, `legacy_node/`, `uploads/`도 용도를 확인하기 전 삭제하지 않습니다.

`main_backup.py`, `public/*_backup*` 등 정리 후보는 [FILE_CLEANUP_REVIEW.md](FILE_CLEANUP_REVIEW.md)에 구분했습니다. 기존 MySQL을 지우거나 테스트 DB로 되돌리는 작업은 이번 문서 정리에 포함하지 않습니다.
