import os
import unittest
from unittest.mock import MagicMock, patch
from fastapi import FastAPI
from fastapi.testclient import TestClient
from match_detail_routes import create_match_detail_router


class DetailTests(unittest.TestCase):
    def setUp(self):
        self.db=MagicMock()
        self.cursor=self.db.cursor.return_value.__enter__.return_value
        app=FastAPI()
        app.include_router(create_match_detail_router(lambda:self.db))
        self.client=TestClient(app)
        self.member=patch('auth.current_user',return_value={'user_id':1,'role':'user'});self.member.start();self.addCleanup(self.member.stop)

    def test_exact_match_info_players_and_explicit_videos(self):
        self.cursor.fetchone.return_value={'match_id':6,'opponent':'WGH 은평','start_time':None,'end_time':None,'memo':'메모\n두 번째 줄'}
        self.cursor.fetchall.side_effect=[[{'player_id':1,'player_name':'선수','goals':2,'assists':1}],[{'video_id':3,'title':'연결 영상','youtube_id':'abcdefghijk'}]]
        response=self.client.get('/api/matches/6')
        self.assertEqual(response.status_code,200)
        data=response.json()['data']
        self.assertEqual(data['match_id'],6)
        self.assertEqual(data['players'][0]['goals'],2)
        self.assertEqual(data['videos'][0]['video_id'],3)
        calls=self.cursor.execute.call_args_list
        self.assertEqual(calls[0].args[1],(6,))
        self.assertEqual(calls[1].args[1],(6,))
        self.assertEqual(calls[2].args[1],(6,1))
        self.db.commit.assert_not_called()

    def test_missing_match_and_invalid_id(self):
        self.cursor.fetchone.return_value=None
        self.assertEqual(self.client.get('/api/matches/999').status_code,404)
        self.assertEqual(self.client.get('/api/matches/0').status_code,422)
        self.assertEqual(self.client.get('/api/matches/no').status_code,422)

    def test_empty_records_remain_empty_without_guessing(self):
        self.cursor.fetchone.return_value={'match_id':1}
        self.cursor.fetchall.return_value=()
        data=self.client.get('/api/matches/1').json()['data']
        self.assertEqual(data['players'],[])
        self.assertEqual(data['videos'],[])

    def test_guest_detail_has_no_video_metadata(self):
        self.cursor.fetchone.return_value={'match_id':6}
        self.cursor.fetchall.return_value=[]
        with patch('auth.current_user',return_value=None):
            data=self.client.get('/api/matches/6').json()['data']
        self.assertEqual(data['videos'],[])
        self.assertTrue(data['video_login_required'])
        self.assertEqual(self.cursor.execute.call_count,2)

    def test_internal_database_error_is_not_exposed(self):
        self.cursor.execute.side_effect=RuntimeError('secret database info')
        response=self.client.get('/api/matches/1')
        self.assertEqual(response.status_code,500)
        self.assertNotIn('secret',response.text)
        self.db.close.assert_called_once()


@unittest.skipUnless(os.getenv('WGH_TEST_PLAYER_DB')=='1','Explicit test DB opt-in required')
class DetailDatabaseTests(unittest.TestCase):
    def test_read_existing_match_detail_against_actual_records(self):
        from video_repository import connect
        db=connect()
        try:
            with db.cursor() as cursor:
                cursor.execute('SELECT DATABASE() AS db_name')
                self.assertEqual(cursor.fetchone()['db_name'],'futsaldb_test')
                cursor.execute('SELECT match_id,opponent,memo FROM futsal_match ORDER BY match_id DESC LIMIT 1')
                match=cursor.fetchone()
                cursor.execute('SELECT player_id,goals,assists FROM match_player WHERE match_id=%s ORDER BY player_id',(match['match_id'],))
                players=list(cursor.fetchall())
                cursor.execute('SELECT video_id FROM futsal_video WHERE match_id=%s AND user_id=1 ORDER BY created_at,video_id',(match['match_id'],))
                videos=[r['video_id'] for r in cursor.fetchall()]
        finally: db.close()
        app=FastAPI();app.include_router(create_match_detail_router(connect))
        with patch('auth.current_user',return_value={'user_id':1,'role':'user'}):
            response=TestClient(app).get(f"/api/matches/{match['match_id']}")
        self.assertEqual(response.status_code,200)
        data=response.json()['data']
        self.assertEqual(data['opponent'],match['opponent'])
        self.assertEqual(data['memo'],match['memo'])
        self.assertEqual(sorted([{k:r[k] for k in ['player_id','goals','assists']} for r in data['players']],key=lambda r:r['player_id']),players)
        self.assertEqual([r['video_id'] for r in data['videos']],videos)
