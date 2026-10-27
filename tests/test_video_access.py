import unittest
from unittest.mock import MagicMock, patch
from fastapi import FastAPI, Depends
import httpx
from src.auth import auth, auth_store as store
from src.api import video_access as access, tv

async def run():
 app=FastAPI(dependencies=[Depends(auth.require_admin_for_request)]);app.include_router(access.router)
 @app.get('/api/youtube-videos')
 def videos():return {'youtube_id':'private'}
 @app.get('/api/youtube-videos/1/analysis')
 def analysis():return {'data':'private'}
 @app.get('/api/videos/1')
 def download():return {'data':'private'}
 @app.get('/api/tv/catalog',dependencies=[Depends(tv.member)])
 def catalog():return {'data':'private'}
 user=None
 db=MagicMock();cur=db.cursor.return_value.__enter__.return_value
 with patch.object(auth,'current_user',side_effect=lambda req:user),patch.object(store,'transaction') as tx:
  tx.return_value.__enter__.return_value=db
  async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app),base_url='http://test') as c:
   for identity,status in [(None,401),({'user_id':4,'role':'user','consent_required':False,'video_approved':False,'csrf_token':'csrf'},403),({'user_id':4,'role':'player','video_approved':True,'csrf_token':'csrf'},200),({'user_id':4,'role':'admin','video_approved':False,'csrf_token':'csrf'},200)]:
    user=identity
    for path in ['/api/youtube-videos','/api/youtube-videos/1/analysis','/api/videos/1','/api/tv/catalog']:
     resp=await c.get(path);assert resp.status_code==status,(path,resp.text)
   user={'user_id':4,'role':'user','video_approved':False,'csrf_token':'csrf'}
   assert (await c.get('/auth/video-access')).json()['approved'] is False
   assert (await c.get('/auth/video-access/members')).status_code==403
   user={'user_id':4,'role':'admin','video_approved':True,'csrf_token':'csrf'}
   payload={'approved':True,'revision':0};path='/auth/video-access/members/5'
   assert (await c.post(path,json=payload)).status_code==403
   cur.fetchone.side_effect=[{'user_id':5},{'user_id':5},None,None]
   assert (await c.post(path,json=payload,headers={'X-CSRF-Token':'csrf'})).status_code==200
   cur.fetchone.side_effect=[{'user_id':5},{'user_id':5},None,{'revision':2}]
   assert (await c.post(path,json=payload,headers={'X-CSRF-Token':'csrf'})).status_code==409
   cur.fetchone.side_effect=[{'user_id':5},{'user_id':5},{'user_id':5}]
   assert (await c.post(path,json=payload,headers={'X-CSRF-Token':'csrf'})).status_code==409
   assert (await c.post(path,json={'approved':'yes','revision':0},headers={'X-CSRF-Token':'csrf'})).status_code==422
 print('PASS: 23 approval/access/admin/CSRF/revision scenarios')

class VideoAccessTests(unittest.IsolatedAsyncioTestCase):
    async def test_approval_and_management_permissions(self):
        await run()

    def test_video_permission_is_separate_from_role(self):
        self.assertFalse(auth.video_allowed(None))
        self.assertFalse(auth.video_allowed({'role':'player','video_approved':False}))
        self.assertTrue(auth.video_allowed({'role':'user','video_approved':True}))
        self.assertTrue(auth.video_allowed({'role':'admin'}))
        self.assertFalse(auth.video_allowed({'role':'admin','consent_required':True}))

if __name__ == '__main__':
    unittest.main()
