# GitHub 파일 정리 검토 목록

2026-10-19 문서화 단계의 검토 목록에 2026-10-20 폴더 정리 적용 결과를 추가했습니다. 현재 구조는 [PROJECT_FILES.md](PROJECT_FILES.md)를 참고합니다.

| 대상 | 제안 | 먼저 확인할 내용 |
| --- | --- | --- |
| `main_backup.py` | 별도 백업 보관 후 저장소 제거 검토 | 실행·도구 참조 여부와 보존할 Git 이력 |
| `public/app_backup.js`, `index_backup.html`, `style_backup.css`, `style_backup2.css` | 중복 백업 정리 검토 | HTML·CSS·테스트의 참조 확인 |
| `public/video_backup.html` | 호환 경로 처리와 함께 검토 | `main.py`, `build_vercel.py`가 보호 페이지로 참조하므로 파일만 삭제하면 안 됨 |
| 루트의 기능·배포 문서 | `docs/`로 이동 완료 | README·문서 간 상대 링크와 이미지·SQL 링크 갱신 |
| `.vscode/settings.json` | 팀 공용 설정인지 검토 | 개인 환경 전용 값은 공개할 필요가 있는지 확인 |
| `public/feedback.html`, `feedback.js` | 유지 후 호환 정책 검토 | 기존 주소에서 이동·권한 검사 처리. 이름만 보고 미사용으로 판단하지 않음 |
| 기사 초안·로컬 영상 시범 코드 | 현 단계 유지 | 연결된 API가 있어 삭제는 기능 제거에 해당. 범위 결정 필요 |

## 유지할 자료

- `tests/`, SQL 마이그레이션과 PostgreSQL 이전 도구는 검증·복구 자료이므로 유지합니다.
- `legacy_node/`, 가상환경, 업로드 폴더는 로컬 보관 자료입니다. GitHub 목록 정리와 디스크 정리는 구분합니다.
- `.wgh-sync/` 실행 상태와 비공개 DB 백업·환경 파일은 삭제하지 않고 Git 제외 상태를 유지합니다.
- 기존 `futsaldb`와 `futsaldb_test`는 문서 정리 대상이 아닙니다. 현재 운영은 이전 완료한 Supabase PostgreSQL입니다.

## 2026-10-19 문서화 범위

README와 파일 역할 안내를 현행화하고 이 검토 목록을 작성합니다. 공개 Notion 원문과 제공된 내보내기 본문을 대조했습니다. 원본 페이지 온라인 수정은 편집 접근 권한이 필요하며, NOTION_FINAL.md에 최종 기획서 내용을 준비했습니다. 코드 기능 변경·DB 변경·파일 삭제·이동·커밋·푸시는 별도로 진행합니다.

## 2026-10-20 폴더 정리 범위

- Python 구현 20개를 `src/`의 기능별 패키지로 옮기고 내부 import와 테스트 참조를 갱신했습니다.
- README를 제외한 Markdown 문서 10개를 `docs/`로 옮겼습니다.
- 기존 서버·빌드·관리 도구 명령을 유지하도록 루트에 연결 파일 5개를 남겼습니다.
- 환경 파일·업로드·동기화 이력·정적 파일 경로를 저장소 루트로 고정했습니다.
- `public/`, SQL, DB, 의존성과 Vercel·Docker 설정은 변경하지 않습니다.
