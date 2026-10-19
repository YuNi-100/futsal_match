# WGH Vercel 기존 프로젝트 재연결

현재 상태: Supabase 연결 완료. Vercel 배포 준비 파일 추가 및 사본 빌드 테스트 통과. 실제 배포/프로젝트 설정 변경/커밋/Push는 아직 하지 않았음.

1. 기존 futsal-match 프로젝트 Settings → Build and Deployment 확인.
   - Framework Preset: FastAPI
   - Root Directory: 저장소에서 main.py/requirements.txt가 있는 폴더. 현재 로컬 구조는 저장소 루트.
   - Build Command: python build_vercel.py (파일 vercel.json에도 설정됨)
   - 예전 정적 사이트용 Output Directory/개별 SPA rewrite 설정이 있다면 FastAPI 구성과 충돌 여부를 먼저 확인.
2. Vercel 서버 환경변수에 DB_ENGINE=postgres, DATABASE_URL(비공개), POSTGRES_EXPECTED_DATABASE=postgres, PG_SSLMODE=require 설정.
   - WGH_ALLOW_ANALYSIS_WRITES, WGH_ALLOW_SYNC_WRITES는 검증된 운영 환경에만 true.
   - Google 클라이언트 ID/Secret, 기존 Gemini/OpenAI 키·모델은 서버 환경변수로 설정.
   - .env / .env.supabase 파일 자체는 업로드하지 않음.
3. 최종 주소가 기존 주소라면 GOOGLE_REDIRECT_URI=https://futsal-match-theta.vercel.app/auth/google/callback.
   - Google Cloud 승인된 redirect URI에 같은 HTTPS 주소 추가. 기존 localhost 주소는 로컬 확인용으로 유지.
4. GitHub로 자동배포하는 경우 최신 코드 commit/push가 있어야 반영되므로 사용자 별도 승인 필요.
   - Git 커밋 없이 배포하려면 Vercel CLI 로그인 후 기존 프로젝트에 로컬 코드 연결/배포 가능. 아직 CLI 설치·로그인·배포하지 않았음.
   - 기존 Git 연동을 끊거나 기존 프로젝트를 삭제하지 않음.
5. 배포 후 /api/matches, /auth/me, 로그인·권한·CRUD·영상/게시분석 조회, 정적 보호 경로 확인.
   - Preview는 검증 전 WGH_ALLOW_ANALYSIS_WRITES=false, WGH_ALLOW_SYNC_WRITES=false 권장.
   - 실제 빌드에서는 public을 wgh_web으로 이름 변경하여 FastAPI를 통해 정적 화면 제공. 로컬 public은 유지.
   - 서버리스 읽기 전용 파일시스템에 대응하여 legacy 업로드 경로는 /tmp 사용. /tmp는 영속 저장소가 아니며 현재 영상 UI는 YouTube 링크/PostgreSQL을 사용.
   - AI 분석 API는 유료이며 자동 실행하지 않음. 현재 maxDuration=300으로 준비했으며 실제 Vercel 플랜/Fluid Compute 설정과 시간제한을 확인해야 함.
6. 수·토 18시 자동등록은 현재 로컬 Codex 작업. Vercel 배포만으로 서버 예약이 자동 이전되지 않음.
   - Cron 도입은 별도 작업. 중복 실행 금지 및 삭제 영상 재등록 방지 이력의 영속 저장 필요.

변경 파일: main.py, build_vercel.py, pyproject.toml, vercel.json, .python-version, .vercelignore.
검증: 118 unit tests 중 112 통과/6 선택 DB 테스트 제외. 별도 사본에서 VERCEL=1 빌드 및 홈/정적파일/비회원 관리자 페이지 401/영상 API 401 확인.
공식 안내: https://vercel.com/docs/frameworks/backend/fastapi
