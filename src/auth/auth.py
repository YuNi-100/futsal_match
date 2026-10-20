"""Google OIDC authorization code flow and WGH session authorization."""
import base64
import hashlib
import hmac
import os
import secrets
from urllib.parse import urlencode, urlsplit

import httpx
import pymysql
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import JSONResponse, RedirectResponse
from google.auth.transport.requests import Request as GoogleRequest
from google.oauth2.id_token import verify_oauth2_token
from src.auth import auth_store as store

router = APIRouter(prefix='/auth', tags=['로그인'])


def settings():
    client = os.getenv('GOOGLE_CLIENT_ID', '').strip()
    secret = os.getenv('GOOGLE_CLIENT_SECRET', '').strip()
    redirect = os.getenv('GOOGLE_REDIRECT_URI', '').strip()
    parsed = urlsplit(redirect)
    if not client or not secret or parsed.path != '/auth/google/callback' or not parsed.hostname or parsed.query or parsed.fragment:
        raise HTTPException(503, 'Google 로그인 환경설정을 확인해 주세요.')
    local = parsed.hostname in ('localhost', '127.0.0.1', '::1')
    if parsed.scheme != 'https' and not (local and parsed.scheme == 'http'):
        raise HTTPException(503, '운영 로그인에는 HTTPS가 필요합니다.')
    return client, secret, redirect, parsed.scheme == 'https'


def session_cookie():
    return '__Host-wgh_session' if settings()[3] else 'wgh_session'


def current_user(request):
    if not request.cookies.get('wgh_session') and not request.cookies.get('__Host-wgh_session'):
        return None
    token = request.cookies.get(session_cookie())
    if not token:
        return None
    try:
        return store.get_session(token)
    except pymysql.MySQLError:
        raise HTTPException(503, '로그인 저장소를 사용할 수 없습니다.') from None


def require_admin_for_request(request: Request):
    path=request.url.path.rstrip('/')
    video_read = request.method in ('GET','HEAD') and (path=='/api/youtube-videos' or path.startswith('/api/youtube-videos/') or path=='/api/videos' or path.startswith('/api/videos/'))
    if video_read:
        user=current_user(request)
        if not user:raise HTTPException(401,'경기 영상은 로그인 후 볼 수 있습니다.')
        if user.get('consent_required',False): raise HTTPException(403,'내 페이지에서 최초 이용 동의를 완료해 주세요.')
        request.state.wgh_user=user
        return
    protected = request.url.path.startswith('/api') and (
        request.method not in ('GET', 'HEAD', 'OPTIONS')
        or request.url.path.startswith('/api/admin/')
        or request.url.path in ('/api/ai/test', '/api/db-test')
    )
    if not protected:
        return
    user = current_user(request)
    if not user:
        raise HTTPException(401, 'Google 로그인이 필요합니다.')
    if user.get('consent_required',False): raise HTTPException(403,'내 페이지에서 최초 이용 동의를 완료해 주세요.')
    if user['role'] != 'admin':
        raise HTTPException(403, '승인된 관리자만 사용할 수 있습니다.')
    request.state.wgh_user=user
    check_csrf(request, user)


def check_csrf(request, user):
    if request.method not in ('GET', 'HEAD', 'OPTIONS'):
        supplied = request.headers.get('x-csrf-token', '')
        if not supplied or not hmac.compare_digest(supplied, user['csrf_token']):
            raise HTTPException(403, '요청을 확인할 수 없습니다. 화면을 새로고침해 주세요.')


@router.get('/google/login')
def login():
    client, _, redirect, secure = settings()
    state, nonce, verifier = (secrets.token_urlsafe(32) for _ in range(3))
    try:
        store.save_oauth(state, nonce, verifier)
    except pymysql.MySQLError as error:
        code = error.args[0] if error.args and isinstance(error.args[0], int) else 0
        print(f'WGH login DB failure: code={code}, database={os.getenv("DB_NAME", "unset")}', flush=True)
        raise HTTPException(503, f'로그인 DB 연결 오류입니다. 오류 번호: {code}') from None
    challenge = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).rstrip(b'=').decode()
    response = RedirectResponse('https://accounts.google.com/o/oauth2/v2/auth?' + urlencode({
        'client_id': client, 'redirect_uri': redirect, 'response_type': 'code',
        'scope': 'openid email profile', 'state': state, 'nonce': nonce,
        'code_challenge': challenge, 'code_challenge_method': 'S256',
        'prompt': 'select_account',
    }), status_code=302)
    response.set_cookie('wgh_oauth_state', state, max_age=600, httponly=True, secure=secure, samesite='lax', path='/auth/google')
    response.headers['Cache-Control'] = 'no-store'
    return response


def exchange_claims(code, verifier, client, secret, redirect):
    with httpx.Client(timeout=15) as transport:
        response = transport.post('https://oauth2.googleapis.com/token', data={
            'code': code, 'client_id': client, 'client_secret': secret,
            'redirect_uri': redirect, 'grant_type': 'authorization_code', 'code_verifier': verifier,
        })
        response.raise_for_status()
        token = response.json()['id_token']
    return verify_oauth2_token(token, GoogleRequest(), audience=client)


@router.get('/google/callback')
def callback(request: Request):
    client, secret, redirect, secure = settings()
    state = request.query_params.get('state', '')
    cookie_state = request.cookies.get('wgh_oauth_state', '')
    if not state or not cookie_state or not hmac.compare_digest(state, cookie_state):
        raise HTTPException(400, '로그인 요청이 일치하지 않습니다. 다시 로그인해 주세요.')
    try:
        pending = store.consume_oauth(state)
        if not pending:
            raise HTTPException(400, '만료되었거나 이미 사용한 로그인 요청입니다.')
        if request.query_params.get('error'):
            response = RedirectResponse('/?login=cancelled', status_code=303)
        else:
            code = request.query_params.get('code')
            if not code:
                raise HTTPException(400, 'Google 인증 코드가 없습니다.')
            try:
                claims = exchange_claims(code, pending['verifier'], client, secret, redirect)
                if (not claims.get('sub') or len(claims['sub']) > 255
                    or not claims.get('email') or len(claims['email']) > 100
                    or claims.get('email_verified') is not True
                    or claims.get('nonce') != pending['nonce']):
                    raise ValueError('Invalid identity claims')
            except Exception:
                raise HTTPException(400, 'Google 인증을 검증하지 못했습니다. 다시 로그인해 주세요.') from None
            user_id = store.resolve_user(claims)
            ttl = 60 * 60 * 12
            token = store.create_session(user_id, ttl, request.cookies.get(session_cookie()))
            response = RedirectResponse('/', status_code=303)
            response.set_cookie(session_cookie(), token, max_age=ttl, httponly=True, secure=secure, samesite='lax', path='/')
    except HTTPException as error:
        response = JSONResponse({'detail': error.detail}, status_code=error.status_code)
    except pymysql.MySQLError:
        response = JSONResponse({'detail': '로그인 저장에 실패했습니다. DB 설정을 확인해 주세요.'}, status_code=503)
    response.delete_cookie('wgh_oauth_state', path='/auth/google', secure=secure, httponly=True, samesite='lax')
    response.headers['Cache-Control'] = 'no-store'
    response.headers['Referrer-Policy'] = 'no-referrer'
    return response


@router.get('/me')
def me(request: Request):
    user = current_user(request)
    return JSONResponse({'user': None if not user else {
        'user_id': user['user_id'], 'name': user['name'], 'role': user['role'], 'player_id': user.get('player_id'), 'consent_required': bool(user.get('consent_required',False))
    }, 'csrf_token': user['csrf_token'] if user else None}, headers={'Cache-Control': 'no-store'})


@router.get('/session-check')
def session_check(request: Request):
    """Read-only diagnostics: never return session tokens or CSRF values."""
    expected = session_cookie()
    received = bool(request.cookies.get(expected))
    alternate = 'wgh_session' if expected == '__Host-wgh_session' else '__Host-wgh_session'
    user = current_user(request)
    return JSONResponse({
        'cookie_received': received,
        'other_cookie_received': bool(request.cookies.get(alternate)),
        'signed_in': user is not None,
        'host_matches_login': request.url.hostname == urlsplit(settings()[2]).hostname,
    }, headers={'Cache-Control': 'no-store'})


@router.post('/logout')
def logout(request: Request):
    user = current_user(request)
    if user:
        check_csrf(request, user)
        store.delete_session(request.cookies[session_cookie()])
    response = JSONResponse({'success': True}, headers={'Cache-Control': 'no-store'})
    response.delete_cookie(session_cookie(), path='/', secure=settings()[3], httponly=True, samesite='lax')
    return response


def video_login_page():
    return """<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <title>로그인 안내 | WGH</title><link rel="stylesheet" href="/style.css"><link rel="stylesheet" href="/auth.css">
    <link rel="stylesheet" href="/match-detail.css"><script src="/auth.js"></script></head><body>
    <main class="match-detail-page"><section class="detail-panel"><h2>경기 영상은 로그인 후 볼 수 있어요</h2>
    <p class="detail-muted">일반 회원과 선수 회원 모두 시청할 수 있습니다. Google 계정으로 로그인해 주세요.</p>
    <div class="wgh-auth-panel" data-auth-panel></div><a class="detail-back" href="/index.html">홈으로 돌아가기</a>
    </section></main></body></html>"""
