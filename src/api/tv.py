"""Member-only WGH TV catalog and video comments; existing APIs stay unchanged."""
from fastapi import APIRouter, Depends, HTTPException, Request, Query, Path
from pydantic import BaseModel, Field, ConfigDict
from src.auth import auth
from src.db import video_repository as videos
from src.db import feedback_store


def member(request: Request):
    user = auth.current_user(request)
    if not user:
        raise HTTPException(401, '로그인이 필요합니다.')
    if user.get('consent_required', False):
        raise HTTPException(403, '내 페이지에서 이용 동의를 완료해 주세요.')
    auth.check_csrf(request, user)
    request.state.wgh_user = user
    return user


router = APIRouter(prefix='/api/tv', dependencies=[Depends(member)], tags=['WGH TV'])


class CommentInput(BaseModel):
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=True)
    content: str = Field(min_length=1, max_length=1000)
    time_seconds: int | None = Field(default=None, ge=0, le=86400, strict=True)


class CommentEdit(CommentInput):
    revision: int = Field(ge=1, strict=True)


def ensure_video(cur, video_id):
    cur.execute('SELECT video_id FROM futsal_video WHERE video_id=%s AND user_id=1', (video_id,))
    if not cur.fetchone():
        raise HTTPException(404, '영상을 찾을 수 없습니다.')


def transaction(operation):
    db = None
    try:
        db = videos.connect()
        result = operation(db)
        db.commit()
        return {'success': True, 'data': result}
    except HTTPException:
        if db: db.rollback()
        raise
    except Exception:
        if db: db.rollback()
        raise HTTPException(503, '요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.') from None
    finally:
        if db: db.close()


@router.get('/catalog')
def catalog():
    def read(db):
        rows = videos.list_videos(db, 1)
        # Fetch once, avoiding one request per video. Decode through existing publication rules.
        with db.cursor() as cur:
            cur.execute('''SELECT a.analysis_id,a.video_id,a.feedback FROM video_analysis a
                           JOIN futsal_video v ON v.video_id=a.video_id WHERE v.user_id=1
                           ORDER BY a.analysis_id DESC''')
            published = set()
            for row in cur.fetchall():
                if (feedback_store.decode(row) or {}).get('review', {}).get('publication'):
                    published.add(row['video_id'])
        return [{**row, 'has_published_analysis': row['video_id'] in published} for row in rows]
    return transaction(read)


@router.get('/videos/{video_id}/comments')
def list_comments(request: Request, video_id: int = Path(gt=0), before: int | None = Query(default=None, gt=0)):
    def read(db):
        with db.cursor() as cur:
            ensure_video(cur, video_id)
            condition = ' AND c.comment_id<%s' if before is not None else ''
            params = (video_id, before) if before is not None else (video_id,)
            cur.execute('''SELECT c.comment_id,c.content,c.time_seconds,c.revision,c.created_at,c.updated_at,
                           c.author_id,u.name AS author_name FROM video_comment c
                           JOIN app_user u ON u.user_id=c.author_id WHERE c.video_id=%s'''
                        + condition + ' ORDER BY c.comment_id DESC LIMIT 11', params)
            rows = cur.fetchall()
        user = request.state.wgh_user
        items = []
        for row in rows[:10]:
            own = row.pop('author_id') == user['user_id']
            items.append({**row, 'can_edit': own, 'can_delete': own or user['role'] == 'admin'})
        return {'items': items, 'next_before': items[-1]['comment_id'] if len(rows)>10 else None}
    return transaction(read)


@router.post('/videos/{video_id}/comments', status_code=201)
def add_comment(payload: CommentInput, request: Request, video_id: int = Path(gt=0)):
    def write(db):
        with db.cursor() as cur:
            ensure_video(cur, video_id)
            cur.execute('''INSERT INTO video_comment(video_id,author_id,content,time_seconds)
                           VALUES (%s,%s,%s,%s) RETURNING comment_id''',
                        (video_id, request.state.wgh_user['user_id'], payload.content, payload.time_seconds))
            return {'comment_id': cur.fetchone()['comment_id']}
    return transaction(write)


def change_comment(db, request, video_id, comment_id, payload=None):
    with db.cursor() as cur:
        ensure_video(cur, video_id)
        cur.execute('SELECT author_id,revision FROM video_comment WHERE video_id=%s AND comment_id=%s FOR UPDATE', (video_id, comment_id))
        row = cur.fetchone()
        if not row: raise HTTPException(404, '댓글을 찾을 수 없습니다.')
        user = request.state.wgh_user
        own = row['author_id'] == user['user_id']
        if not own and (payload is not None or user['role'] != 'admin'):
            raise HTTPException(403, '이 댓글을 변경할 권한이 없습니다.')
        if payload is None:
            cur.execute('DELETE FROM video_comment WHERE video_id=%s AND comment_id=%s', (video_id, comment_id))
        else:
            if payload.revision != row['revision']:
                raise HTTPException(409, '다른 창에서 수정된 댓글입니다. 새로 불러온 후 수정해 주세요.')
            cur.execute('''UPDATE video_comment SET content=%s,time_seconds=%s,revision=revision+1,
                           updated_at=CURRENT_TIMESTAMP WHERE video_id=%s AND comment_id=%s''',
                        (payload.content, payload.time_seconds, video_id, comment_id))
    return {'comment_id': comment_id}


@router.patch('/videos/{video_id}/comments/{comment_id}')
def edit_comment(payload: CommentEdit, request: Request, video_id: int = Path(gt=0), comment_id: int = Path(gt=0)):
    return transaction(lambda db: change_comment(db, request, video_id, comment_id, payload))


@router.delete('/videos/{video_id}/comments/{comment_id}')
def delete_comment(request: Request, video_id: int = Path(gt=0), comment_id: int = Path(gt=0)):
    return transaction(lambda db: change_comment(db, request, video_id, comment_id))
