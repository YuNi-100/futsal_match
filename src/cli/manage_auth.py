"""Local operator tool. No HTTP endpoint can grant roles or link legacy accounts."""
import argparse
from dotenv import load_dotenv
from src.paths import PROJECT_ROOT
load_dotenv(PROJECT_ROOT / ".env")
from src.auth import auth_store as store


def main():
    parser = argparse.ArgumentParser(description='WGH 계정 연결 및 관리자 승인 (DB 변경 도구)')
    parser.add_argument('action', choices=['link', 'grant', 'revoke'])
    parser.add_argument('--user-id', type=int, required=True)
    parser.add_argument('--google-sub', help='Google 로그인 콜백이 검증 후 표시한 식별자; link에서만 사용')
    args = parser.parse_args()
    if args.user_id <= 0 or (args.action == 'link' and not args.google_sub):
        parser.error('유효한 사용자 번호와 link용 Google 식별자가 필요합니다.')
    with store.transaction() as db, db.cursor() as cur:
        cur.execute('SELECT user_id FROM app_user WHERE user_id=%s', (args.user_id,))
        if not cur.fetchone():
            raise SystemExit('기존 사용자 번호를 찾지 못했습니다. 변경하지 않았습니다.')
        if args.action == 'link':
            cur.execute('INSERT INTO wgh_google_identity (google_sub,user_id) VALUES (%s,%s)', (args.google_sub, args.user_id))
        elif args.action == 'grant':
            cur.execute('SELECT user_id FROM wgh_google_identity WHERE user_id=%s', (args.user_id,))
            if not cur.fetchone():
                raise SystemExit('Google 계정 연결을 먼저 확인해 주세요.')
            cur.execute("INSERT INTO wgh_user_role (user_id,role) VALUES (%s,'admin') ON DUPLICATE KEY UPDATE role='admin'", (args.user_id,))
        else:
            cur.execute("UPDATE wgh_user_role SET role='user' WHERE user_id=%s", (args.user_id,))
            cur.execute('DELETE FROM wgh_login_session WHERE user_id=%s', (args.user_id,))
    print(f'{args.action} 완료: 사용자 {args.user_id}')


if __name__ == '__main__':
    main()
