"""Authentication storage. Never creates or migrates tables at application startup."""
import hashlib
import secrets
from contextlib import contextmanager
from fastapi import HTTPException
from src.db.video_repository import connect


def digest(value):
    return hashlib.sha256(value.encode()).hexdigest()


@contextmanager
def transaction():
    connection = connect()
    try:
        yield connection
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()


def save_oauth(state, nonce, verifier):
    with transaction() as db, db.cursor() as cur:
        cur.execute('DELETE FROM wgh_oauth_state WHERE expires_at <= UTC_TIMESTAMP()')
        cur.execute('INSERT INTO wgh_oauth_state (state_hash, nonce, verifier, expires_at) VALUES (%s,%s,%s,DATE_ADD(UTC_TIMESTAMP(), INTERVAL 10 MINUTE))', (digest(state), nonce, verifier))


def consume_oauth(state):
    with transaction() as db, db.cursor() as cur:
        cur.execute('SELECT nonce, verifier FROM wgh_oauth_state WHERE state_hash=%s AND expires_at>UTC_TIMESTAMP() FOR UPDATE', (digest(state),))
        row = cur.fetchone()
        if row:
            cur.execute('DELETE FROM wgh_oauth_state WHERE state_hash=%s', (digest(state),))
        return row


def resolve_user(claims):
    with transaction() as db, db.cursor() as cur:
        cur.execute('SELECT user_id FROM wgh_google_identity WHERE google_sub=%s', (claims['sub'],))
        identity = cur.fetchone()
        if identity:
            return identity['user_id']
        # Email is contact data, never an automatic account-linking credential.
        cur.execute('SELECT user_id FROM app_user WHERE email=%s', (claims['email'],))
        if cur.fetchone():
            raise HTTPException(409, detail={
                'message': '기존 계정이 있습니다. 운영자가 Google 계정 연결을 확인해야 합니다.',
                'google_sub': claims['sub'],
            })
        cur.execute('INSERT INTO app_user (name,email) VALUES (%s,%s)', ((claims.get('name') or claims['email'])[:50], claims['email']))
        user_id = cur.lastrowid
        cur.execute('INSERT INTO wgh_google_identity (google_sub,user_id) VALUES (%s,%s)', (claims['sub'], user_id))
        return user_id


def create_session(user_id, ttl, previous=None):
    token, csrf = secrets.token_urlsafe(32), secrets.token_urlsafe(32)
    with transaction() as db, db.cursor() as cur:
        cur.execute('DELETE FROM wgh_login_session WHERE expires_at<=UTC_TIMESTAMP()')
        if previous:
            cur.execute('DELETE FROM wgh_login_session WHERE token_hash=%s', (digest(previous),))
        cur.execute('INSERT INTO wgh_login_session (token_hash,user_id,csrf_token,expires_at) VALUES (%s,%s,%s,DATE_ADD(UTC_TIMESTAMP(), INTERVAL %s SECOND))', (digest(token), user_id, csrf, ttl))
    return token


def get_session(token):
    with transaction() as db, db.cursor() as cur:
        # Read role on every request so revocation takes effect immediately.
        cur.execute('''SELECT u.user_id,u.name,s.csrf_token,
            CASE WHEN r.role='admin' THEN 'admin' WHEN pa.player_id IS NOT NULL THEN 'player' ELSE 'user' END AS role,
            pa.player_id, (c.user_id IS NULL) AS consent_required,
            COALESCE(va.approved, false) AS video_approved FROM wgh_login_session s
            JOIN app_user u ON u.user_id=s.user_id
            LEFT JOIN wgh_user_role r ON r.user_id=u.user_id
            LEFT JOIN wgh_player_account pa ON pa.user_id=u.user_id
            LEFT JOIN wgh_account_consent c ON c.user_id=u.user_id
            LEFT JOIN wgh_video_access va ON va.user_id=u.user_id
            WHERE s.token_hash=%s AND s.expires_at>UTC_TIMESTAMP()''', (digest(token),))
        return cur.fetchone()


def delete_session(token):
    with transaction() as db, db.cursor() as cur:
        cur.execute('DELETE FROM wgh_login_session WHERE token_hash=%s', (digest(token),))


def set_player_member(cursor, player_id, user_id, actor_id=None):
    """Caller must hold the player row lock; linking never grants administrator rights."""
    if user_id is not None:
        cursor.execute('SELECT u.user_id FROM app_user u JOIN wgh_google_identity g ON g.user_id=u.user_id WHERE u.user_id=%s FOR UPDATE',(user_id,))
        if cursor.fetchone() is None:
            raise HTTPException(404,'Google 가입 회원을 찾을 수 없습니다.')
        cursor.execute('SELECT player_id FROM wgh_player_account WHERE user_id=%s FOR UPDATE',(user_id,))
        existing=cursor.fetchone()
        if existing and existing['player_id']!=player_id:
            raise HTTPException(409,'이미 다른 선수에 연결된 회원입니다.')
    cursor.execute('DELETE FROM wgh_player_account WHERE player_id=%s',(player_id,))
    if user_id is not None:
        cursor.execute('INSERT INTO wgh_player_account (player_id,user_id,linked_by) VALUES (%s,%s,%s)',(player_id,user_id,actor_id))
