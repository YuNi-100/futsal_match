"""Video-viewing approval is separate from administrator privileges."""
from fastapi import APIRouter, HTTPException, Request, Path
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field
from src.auth import auth, auth_store
from src.api.account_routes import member, SafeAccountRoute

router = APIRouter(prefix='/auth/video-access', route_class=SafeAccountRoute, tags=['영상 회원 승인'])


def response(data):
    return JSONResponse(data, headers={'Cache-Control': 'no-store'})


class Decision(BaseModel):
    model_config = ConfigDict(extra='forbid')
    approved: bool = Field(strict=True)
    revision: int = Field(ge=0, strict=True)


@router.get('')
def status(request: Request):
    user = member(request, consent=False)
    return response({'approved': bool(user['role']=='admin' or user.get('video_approved',False)), 'is_admin': user['role']=='admin'})


@router.get('/members')
def members(request: Request):
    member(request, admin=True)
    with auth_store.transaction() as db, db.cursor() as cur:
        cur.execute('''SELECT u.user_id,u.name,u.email,
                       CASE WHEN r.role='admin' THEN true ELSE COALESCE(a.approved,false) END AS approved,
                       CASE WHEN r.role='admin' THEN true ELSE false END AS is_admin,
                       COALESCE(a.revision,0) AS revision
                       FROM app_user u JOIN wgh_google_identity g ON g.user_id=u.user_id
                       LEFT JOIN wgh_user_role r ON r.user_id=u.user_id
                       LEFT JOIN wgh_video_access a ON a.user_id=u.user_id
                       ORDER BY u.user_id DESC''')
        rows = cur.fetchall()
    return response({'members': rows})


@router.post('/members/{user_id}')
def decide(payload: Decision, request: Request, user_id: int = Path(gt=0)):
    actor = member(request, admin=True)
    with auth_store.transaction() as db, db.cursor() as cur:
        # Lock the user first, including when no approval row exists yet.
        cur.execute('SELECT user_id FROM app_user WHERE user_id=%s FOR UPDATE', (user_id,))
        if not cur.fetchone(): raise HTTPException(404, '회원을 찾을 수 없습니다.')
        cur.execute('SELECT user_id FROM wgh_google_identity WHERE user_id=%s', (user_id,))
        if not cur.fetchone(): raise HTTPException(404, '가입 회원을 찾을 수 없습니다.')
        cur.execute("SELECT user_id FROM wgh_user_role WHERE user_id=%s AND role='admin'", (user_id,))
        if cur.fetchone(): raise HTTPException(409, '관리자의 영상 이용 권한은 이곳에서 변경하지 않습니다.')
        cur.execute('SELECT revision FROM wgh_video_access WHERE user_id=%s FOR UPDATE', (user_id,))
        row = cur.fetchone()
        if payload.revision != (row['revision'] if row else 0):
            raise HTTPException(409, '승인 상태가 변경되었습니다. 목록을 다시 불러와 주세요.')
        if row:
            cur.execute('''UPDATE wgh_video_access SET approved=%s,revision=revision+1,
                           updated_by=%s,updated_at=CURRENT_TIMESTAMP WHERE user_id=%s''',
                        (payload.approved, actor['user_id'], user_id))
        else:
            cur.execute('INSERT INTO wgh_video_access(user_id,approved,updated_by) VALUES (%s,%s,%s)',
                        (user_id, payload.approved, actor['user_id']))
    return response({'success': True})
