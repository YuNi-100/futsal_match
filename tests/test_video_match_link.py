import os
import unittest
import uuid
from unittest.mock import MagicMock, patch
from fastapi import FastAPI, Depends, HTTPException
from fastapi.testclient import TestClient
import auth
import video_match_link as links


class VideoLinkTests(unittest.TestCase):
    def setUp(self):
        self.db=MagicMock();self.cursor=self.db.cursor.return_value.__enter__.return_value
        app=FastAPI(dependencies=[Depends(auth.require_admin_for_request)]);app.include_router(links.router)
        self.client=TestClient(app)
        self.user={'role':'admin','csrf_token':'csrf'}
        self.auth=patch.object(auth,'current_user',side_effect=lambda request:self.user);self.auth.start();self.addCleanup(self.auth.stop)
        self.store=patch.object(links.repository,'connect',return_value=self.db);self.store.start();self.addCleanup(self.store.stop)

    def request(self,body):return self.client.patch('/api/youtube-videos/3/match',json=body,headers={'X-CSRF-Token':'csrf'})

    def test_admin_link_reassign_unlink_and_noop(self):
        self.cursor.fetchone.return_value={'video_id':3,'match_id':6}
        for value in [6,6,1,None]:
            response=self.request({'match_id':value})
            self.assertEqual(response.status_code,200)
            self.assertEqual(response.json()['data']['match_id'],value)
            sql,params=self.cursor.execute.call_args.args
            self.assertEqual(sql,'UPDATE futsal_video SET match_id=%s WHERE video_id=%s AND user_id=%s')
            self.assertEqual(params,(value,3,1))

    def test_missing_video_or_match_rollback(self):
        for answers in [[None],[{'video_id':3},None]]:
            self.cursor.fetchone.side_effect=answers
            self.assertEqual(self.request({'match_id':6}).status_code,404)
        self.assertEqual(self.db.rollback.call_count,2)
        self.db.commit.assert_not_called()

    def test_omitted_negative_and_fractional_match_ids_rejected(self):
        for body in [{},{'match_id':0},{'match_id':-1},{'match_id':1.5}]:self.assertEqual(self.request(body).status_code,422)
        self.db.commit.assert_not_called()

    def test_guest_user_and_missing_csrf_denied(self):
        for user,code in [(None,401),({'role':'user','csrf_token':'csrf'},403)]:
            self.user=user;self.assertEqual(self.request({'match_id':6}).status_code,code)
        self.user={'role':'admin','csrf_token':'csrf'}
        self.assertEqual(self.client.patch('/api/youtube-videos/3/match',json={'match_id':6}).status_code,403)
        self.db.cursor.assert_not_called()


@unittest.skipUnless(os.getenv('WGH_TEST_PLAYER_DB')=='1','Explicit test DB opt-in required')
class VideoLinkDatabaseTests(unittest.TestCase):
    def test_create_link_change_unlink_and_preserve_existing_rows(self):
        from video_repository import connect
        import youtube_videos
        real=connect()
        class RollbackOnly:
            def cursor(self):return real.cursor()
            def commit(self):pass
            def close(self):pass
            def rollback(self):real.rollback()
        proxy=RollbackOnly()
        try:
            with real.cursor() as cur:
                cur.execute('SELECT DATABASE() AS db_name');self.assertEqual(cur.fetchone()['db_name'],'futsaldb_test')
                cur.execute('SELECT * FROM futsal_video ORDER BY video_id');before=list(cur.fetchall())
                cur.execute('SELECT match_id FROM futsal_match WHERE user_id=1 ORDER BY match_id LIMIT 2');first,second=[r['match_id'] for r in cur.fetchall()]
            with patch.object(links.repository,'connect',return_value=proxy):
                body=youtube_videos.YouTubeVideoCreate(title='temporary video link test',youtube_url='t'+uuid.uuid4().hex[:10],match_date='2026-10-16',match_id=first)
                video=youtube_videos.register_youtube_video(body)['data'];video_id=video['video_id']
                self.assertEqual(video['match_id'],first)
                for match_id in [second,second,None,first]:
                    result=links.link_video_match(links.VideoMatchLink(match_id=match_id),video_id)
                    self.assertEqual(result['data']['match_id'],match_id)
                    with real.cursor() as cur:
                        cur.execute('SELECT match_id,title,youtube_id,match_date FROM futsal_video WHERE video_id=%s',(video_id,));row=cur.fetchone()
                    self.assertEqual(row['match_id'],match_id)
                    self.assertEqual(row['title'],body.title);self.assertEqual(row['youtube_id'],body.youtube_url)
                    self.assertEqual(row['match_date'],body.match_date)
                with self.assertRaises(HTTPException):links.link_video_match(links.VideoMatchLink(match_id=1000000000),video_id)
            real.rollback()
            with real.cursor() as cur:
                cur.execute('SELECT * FROM futsal_video ORDER BY video_id');self.assertEqual(list(cur.fetchall()),before)
        finally:real.rollback();real.close()
