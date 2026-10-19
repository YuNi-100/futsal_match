"""Private account information, consent and administrator review."""
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, StrictBool
import auth
import pymysql
from fastapi.routing import APIRoute
import auth_store as store

class SafeAccountRoute(APIRoute):
    def get_route_handler(self):
        handler=super().get_route_handler()
        async def safe(request):
            try: return await handler(request)
            except pymysql.MySQLError:
                return JSONResponse({'detail':'계정 정보를 저장하거나 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.'},status_code=503,headers={'Cache-Control':'no-store'})
        return safe

router=APIRouter(route_class=SafeAccountRoute,prefix='/auth/account',tags=['내 페이지'])
VERSION='2026-10-19'

def member(request, admin=False, consent=True):
    user=auth.current_user(request)
    if not user: raise HTTPException(401,'로그인해 주세요.')
    if consent and user.get('consent_required',False): raise HTTPException(403,'내 페이지에서 최초 이용 동의를 완료해 주세요.')
    if admin and user['role']!='admin': raise HTTPException(403,'관리자만 처리할 수 있습니다.')
    auth.check_csrf(request,user)
    return user

def response(data):
    return JSONResponse(data,headers={'Cache-Control':'no-store'})

class Consent(BaseModel):
    terms: StrictBool
    privacy: StrictBool
    version: str

class Application(BaseModel):
    reason: str=Field(min_length=1,max_length=1000)

class Review(BaseModel):
    decision: str=Field(pattern='^(approved|rejected)$')
    note: str=Field(min_length=1,max_length=1000)

class Revocation(BaseModel):
    note: str=Field(min_length=1,max_length=1000)

@router.get('')
def account(request:Request):
    user=member(request,consent=False)
    with store.transaction() as db, db.cursor() as cur:
        cur.execute("SELECT u.name,u.email,DATE_FORMAT(u.created_at,'%%Y-%%m-%%d') AS joined_at,p.player_id,p.player_name,p.back_number,p.position FROM app_user u LEFT JOIN wgh_player_account a ON a.user_id=u.user_id LEFT JOIN futsal_player p ON p.player_id=a.player_id WHERE u.user_id=%s",(user['user_id'],))
        profile=cur.fetchone()
        cur.execute("SELECT terms_version,privacy_version,DATE_FORMAT(accepted_at,'%%Y-%%m-%%d %%H:%%i') accepted_at FROM wgh_account_consent WHERE user_id=%s",(user['user_id'],))
        consent=cur.fetchone()
        cur.execute("SELECT request_id,reason,status,review_note,DATE_FORMAT(requested_at,'%%Y-%%m-%%d %%H:%%i') requested_at FROM wgh_admin_request WHERE user_id=%s ORDER BY request_id DESC LIMIT 1",(user['user_id'],))
        application=cur.fetchone()
    return response(dict(profile=profile,role=user['role'],consent=consent,version=VERSION,application=application))

@router.post('/consent')
def consent(body:Consent,request:Request):
    user=member(request,consent=False)
    if not body.terms or not body.privacy or body.version!=VERSION: raise HTTPException(422,'현재 이용약관과 개인정보 처리 안내에 모두 동의해 주세요.')
    with store.transaction() as db,db.cursor() as cur:
        cur.execute('INSERT IGNORE INTO wgh_account_consent(user_id,terms_version,privacy_version) VALUES(%s,%s,%s)',(user['user_id'],VERSION,VERSION))
    return response({'success':True})

@router.post('/requests')
def apply(body:Application,request:Request):
    user=member(request)
    if user['role']=='admin': raise HTTPException(409,'이미 관리자입니다.')
    reason=body.reason.strip()
    if not reason: raise HTTPException(422,'신청 사유를 입력해 주세요.')
    with store.transaction() as db,db.cursor() as cur:
        cur.execute('SELECT user_id FROM app_user WHERE user_id=%s FOR UPDATE',(user['user_id'],))
        cur.execute("SELECT request_id FROM wgh_admin_request WHERE user_id=%s AND status='pending'",(user['user_id'],))
        if cur.fetchone(): raise HTTPException(409,'이미 승인 대기 중인 신청이 있습니다.')
        cur.execute('INSERT INTO wgh_admin_request(user_id,reason) VALUES(%s,%s)',(user['user_id'],reason))
    return response({'success':True})

@router.get('/management')
def management(request:Request):
    member(request,admin=True)
    with store.transaction() as db,db.cursor() as cur:
        cur.execute("SELECT r.request_id,r.user_id,u.name,u.email,r.reason,r.status,r.review_note,DATE_FORMAT(r.requested_at,'%Y-%m-%d %H:%i') requested_at FROM wgh_admin_request r JOIN app_user u ON u.user_id=r.user_id ORDER BY r.request_id DESC LIMIT 100")
        requests=cur.fetchall()
        cur.execute("SELECT u.user_id,u.name,u.email FROM wgh_user_role r JOIN app_user u ON u.user_id=r.user_id WHERE r.role='admin'")
        admins=cur.fetchall()
        cur.execute("SELECT u.name,a.name actor,h.action,h.note,DATE_FORMAT(h.created_at,'%Y-%m-%d %H:%i') created_at FROM wgh_role_history h JOIN app_user u ON u.user_id=h.user_id JOIN app_user a ON a.user_id=h.actor_id ORDER BY h.history_id DESC LIMIT 100")
        history=cur.fetchall()
    return response(dict(requests=requests,admins=admins,history=history))

def lock_admins(cur,actor_id):
    # Serialize all approval/revocation operations, then recheck the actor under lock.
    cur.execute("SELECT user_id FROM wgh_user_role WHERE role='admin' ORDER BY user_id FOR UPDATE")
    admins={row['user_id'] for row in cur.fetchall()}
    if actor_id not in admins: raise HTTPException(403,'관리자 권한이 해제되었습니다.')
    return admins

@router.post('/requests/{request_id}/review')
def review(request_id:int,body:Review,request:Request):
    actor=member(request,admin=True)
    note=body.note.strip()
    if not note: raise HTTPException(422,'처리 사유를 입력해 주세요.')
    with store.transaction() as db,db.cursor() as cur:
        lock_admins(cur,actor['user_id'])
        cur.execute('SELECT user_id,status FROM wgh_admin_request WHERE request_id=%s FOR UPDATE',(request_id,))
        row=cur.fetchone()
        if not row: raise HTTPException(404,'신청을 찾을 수 없습니다.')
        if row['status']!='pending': raise HTTPException(409,'이미 처리된 신청입니다.')
        if row['user_id']==actor['user_id']: raise HTTPException(403,'본인의 신청은 승인할 수 없습니다.')
        if body.decision=='approved':
            cur.execute("INSERT INTO wgh_user_role(user_id,role) VALUES(%s,'admin') ON DUPLICATE KEY UPDATE role='admin'",(row['user_id'],))
        cur.execute('UPDATE wgh_admin_request SET status=%s,reviewed_by=%s,review_note=%s,reviewed_at=CURRENT_TIMESTAMP WHERE request_id=%s',(body.decision,actor['user_id'],note,request_id))
        cur.execute('INSERT INTO wgh_role_history(user_id,actor_id,action,note) VALUES(%s,%s,%s,%s)',(row['user_id'],actor['user_id'],body.decision,note))
    return response({'success':True})

@router.post('/admins/{user_id}/revoke')
def revoke(user_id:int,body:Revocation,request:Request):
    actor=member(request,admin=True)
    note=body.note.strip()
    if not note: raise HTTPException(422,'해제 사유를 입력해 주세요.')
    with store.transaction() as db,db.cursor() as cur:
        admins=lock_admins(cur,actor['user_id'])
        if user_id not in admins: raise HTTPException(409,'이미 관리자 권한이 없습니다.')
        if len(admins)<=1: raise HTTPException(409,'마지막 관리자는 해제할 수 없습니다.')
        cur.execute("UPDATE wgh_user_role SET role='user' WHERE user_id=%s",(user_id,))
        cur.execute("INSERT INTO wgh_role_history(user_id,actor_id,action,note) VALUES(%s,%s,'revoked',%s)",(user_id,actor['user_id'],note))
    return response({'success':True})
