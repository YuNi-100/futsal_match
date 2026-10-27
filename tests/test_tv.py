import sys,importlib.util,asyncio,json
from pathlib import Path
from unittest.mock import MagicMock,patch
import httpx
from fastapi import FastAPI,Depends,HTTPException
from src.api import tv
from src.auth import auth
import unittest
async def run():
 app=FastAPI(dependencies=[Depends(auth.require_admin_for_request)]);app.include_router(tv.router)
 db=MagicMock();cur=db.cursor.return_value.__enter__.return_value
 user={'user_id':4,'role':'user','csrf_token':'csrf'}
 with patch.object(tv.auth,'current_user',side_effect=lambda req:user),patch.object(auth,'current_user',side_effect=lambda req:user),patch.object(tv.videos,'connect',return_value=db):
  async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app),base_url='http://test') as client:
   body={'content':'댓글','time_seconds':65};path='/api/tv/videos/21/comments';headers={'X-CSRF-Token':'csrf'}
   user=None;assert (await client.get(path)).status_code==401
   user={'user_id':4,'role':'user','csrf_token':'csrf','consent_required':True};assert (await client.get(path)).status_code==403
   user={'user_id':4,'role':'user','csrf_token':'csrf'};assert (await client.post(path,json=body)).status_code==403
   cur.fetchone.side_effect=[{'video_id':21},{'comment_id':7}];resp=await client.post(path,json=body,headers=headers);assert resp.status_code==201,resp.text
   for bad in [{'content':'   '},{'content':'a'*1001},{'content':'test','time_seconds':-1},{'content':'test','author_id':1}]:assert (await client.post(path,json=bad,headers=headers)).status_code==422
   for method,owner,role,expected in [('PATCH',4,'user',200),('PATCH',5,'admin',403),('DELETE',5,'user',403),('DELETE',5,'admin',200)]:
    user={'user_id':4,'role':role,'csrf_token':'csrf'};cur.fetchone.side_effect=[{'video_id':21},{'author_id':owner,'revision':1}]
    kw={'json':{'content':'변경','revision':1}} if method=='PATCH' else {}
    resp=await client.request(method,path+'/7',headers=headers,**kw);assert resp.status_code==expected,resp.text
   cur.fetchone.side_effect=[{'video_id':21},{'author_id':4,'revision':2}];resp=await client.patch(path+'/7',headers=headers,json={'content':'변경','revision':1});assert resp.status_code==409
   cur.fetchone.side_effect=[{'video_id':21}];cur.fetchall.return_value=[{'comment_id':20-i,'author_id':4,'content':'x'} for i in range(11)];resp=await client.get(path);assert len(resp.json()['data']['items'])==10;assert resp.json()['data']['next_before']==11
   cur.fetchone.side_effect=[None];assert (await client.get(path)).status_code==404
   db.cursor.side_effect=RuntimeError('secret');resp=await client.get(path);assert resp.status_code==503 and 'secret' not in resp.text;db.rollback.assert_called()
 print('PASS: 16 API scenarios covering member/CSRF/validation/ownership/admin/edit revision/pagination/not-found/rollback')
class TVAPITests(unittest.IsolatedAsyncioTestCase):
    async def test_member_comments_permissions_validation_and_rollback(self):
        await run()

if __name__ == '__main__':
    unittest.main()

