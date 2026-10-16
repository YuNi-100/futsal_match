import os
import unittest
from unittest.mock import MagicMock
from fastapi import FastAPI
from fastapi.testclient import TestClient
from player_detail_routes import create_player_detail_router


class PlayerDetailTests(unittest.TestCase):
    def setUp(self):
        self.db=MagicMock();self.cur=self.db.cursor.return_value.__enter__.return_value
        app=FastAPI();app.include_router(create_player_detail_router(lambda:self.db))
        self.client=TestClient(app)

    def test_profile_totals_and_own_match_history(self):
        self.cur.fetchone.side_effect=[{'player_id':7,'player_name':'선수','back_number':7,'position':'ALA','joined_at':None},{'appearances':2,'goals':3,'assists':1}]
        self.cur.fetchall.return_value=[{'match_id':6,'goals':3,'assists':1,'has_video':1}]
        response=self.client.get('/api/players/7')
        self.assertEqual(response.status_code,200)
        data=response.json()['data']
        self.assertEqual(data['goals'],3)
        self.assertEqual(data['matches'][0]['match_id'],6)
        self.assertTrue(all(call.args[1]==(7,) for call in self.cur.execute.call_args_list))
        self.db.commit.assert_not_called()

    def test_missing_and_invalid_player(self):
        self.cur.fetchone.return_value=None
        self.assertEqual(self.client.get('/api/players/999').status_code,404)
        self.assertEqual(self.client.get('/api/players/0').status_code,422)
        self.assertEqual(self.client.get('/api/players/no').status_code,422)

    def test_empty_history(self):
        self.cur.fetchone.side_effect=[{'player_id':7},{'appearances':0,'goals':0,'assists':0}]
        self.cur.fetchall.return_value=()
        data=self.client.get('/api/players/7').json()['data']
        self.assertEqual(data['matches'],[])
        self.assertEqual(data['goals'],0)

    def test_safe_error_and_connection_cleanup(self):
        self.cur.execute.side_effect=RuntimeError('secret')
        response=self.client.get('/api/players/1')
        self.assertEqual(response.status_code,500)
        self.assertNotIn('secret',response.text)
        self.db.close.assert_called_once()


@unittest.skipUnless(os.getenv('WGH_TEST_PLAYER_DB')=='1','Explicit test DB opt-in required')
class PlayerDetailDatabaseTests(unittest.TestCase):
    def test_actual_totals_and_matches(self):
        from video_repository import connect
        db=connect()
        try:
            with db.cursor() as cur:
                cur.execute('SELECT DATABASE() AS db_name')
                self.assertEqual(cur.fetchone()['db_name'],'futsaldb_test')
                cur.execute('SELECT player_id FROM futsal_player ORDER BY player_id LIMIT 1')
                player_id=cur.fetchone()['player_id']
                cur.execute('SELECT COUNT(*) AS appearances,COALESCE(SUM(goals),0) AS goals,COALESCE(SUM(assists),0) AS assists FROM match_player WHERE player_id=%s',(player_id,))
                expected={k:int(v) for k,v in cur.fetchone().items()}
                cur.execute('SELECT match_id FROM match_player WHERE player_id=%s',(player_id,))
                ids={r['match_id'] for r in cur.fetchall()}
        finally:db.close()
        app=FastAPI();app.include_router(create_player_detail_router(connect))
        response=TestClient(app).get(f'/api/players/{player_id}')
        self.assertEqual(response.status_code,200)
        data=response.json()['data']
        self.assertEqual({k:data[k] for k in expected},expected)
        self.assertEqual({r['match_id'] for r in data['matches']},ids)
