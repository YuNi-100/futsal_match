"""Authentication storage. Never creates or migrates tables at application startup."""
import hashlib
import secrets
from contextlib import contextmanager
from fastapi import HTTPException
from video_repository import connect


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
            COALESCE(r.role,'user') AS role FROM wgh_login_session s
            JOIN app_user u ON u.user_id=s.user_id
            LEFT JOIN wgh_user_role r ON r.user_id=u.user_id
            WHERE s.token_hash=%s AND s.expires_at>UTC_TIMESTAMP()''', (digest(token),))
        return cur.fetchone()


def delete_session(token):
    with transaction() as db, db.cursor() as cur:
        cur.execute('DELETE FROM wgh_login_session WHERE token_hash=%s', (digest(token),))
