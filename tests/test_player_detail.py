import os
import unittest
from unittest.mock import MagicMock, patch
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



class PlayerRegistrationTests(unittest.TestCase):
    def test_invalid_fields_and_duplicate_number(self):
        import main
        import pymysql
        from pydantic import ValidationError
        from fastapi import HTTPException
        for fields in [dict(player_name='  ',back_number=1,position='ALA'),dict(player_name='선수',back_number=-1,position='ALA'),dict(player_name='선수',back_number=1,position='BAD')]:
            with self.assertRaises(ValidationError):main.PlayerCreate(**fields)
        db=MagicMock();db.cursor.return_value.__enter__.return_value.execute.side_effect=pymysql.err.IntegrityError(1062,'duplicate')
        with patch.object(main,'get_db_connection',return_value=db):
            with self.assertRaises(HTTPException) as error:main.create_player(main.PlayerCreate(player_name='선수',back_number=7,position='ALA'))
        self.assertEqual(error.exception.status_code,409)
        db.rollback.assert_called_once()
        db.commit.assert_not_called()


@unittest.skipUnless(os.getenv('WGH_TEST_PLAYER_DB')=='1','Explicit test DB opt-in required')
class PlayerRegistrationDatabaseTests(unittest.TestCase):
    def test_register_list_duplicate_and_rollback(self):
        import main
        from video_repository import connect
        from fastapi import HTTPException
        real=connect()
        class RollbackOnly:
            def cursor(self):return real.cursor()
            def commit(self):pass
            def close(self):pass
            def rollback(self):real.rollback()
        try:
            with real.cursor() as cur:
                cur.execute('SELECT DATABASE() AS db_name');self.assertEqual(cur.fetchone()['db_name'],'futsaldb_test')
                cur.execute('SELECT * FROM futsal_player ORDER BY player_id');before=list(cur.fetchall())
                cur.execute('SELECT COALESCE(MAX(back_number),0)+1 AS number FROM futsal_player');number=cur.fetchone()['number']
            with patch.object(main,'get_db_connection',return_value=RollbackOnly()):
                body=main.PlayerCreate(player_name='  temporary registration check  ',back_number=number,position='ALA',joined_at='2026-10-19')
                result=main.create_player(body);self.assertTrue(result['success'])
                record=next(p for p in main.get_players()['data'] if p['player_id']==result['data']['player_id'])
                self.assertEqual(record['player_name'],'temporary registration check')
                self.assertEqual(record['appearances'],0);self.assertEqual(record['goals'],0)
                with self.assertRaises(HTTPException) as error:main.create_player(body)
                self.assertEqual(error.exception.status_code,409)
            real.rollback()
            with real.cursor() as cur:
                cur.execute('SELECT * FROM futsal_player ORDER BY player_id');self.assertEqual(list(cur.fetchall()),before)
        finally:real.rollback();real.close()



class MembershipAccessTests(unittest.TestCase):
    def test_member_admin_endpoints_and_csrf(self):
        import main,auth
        from fastapi.testclient import TestClient
        client=TestClient(main.app)
        for user,code in [(None,401),({'user_id':2,'role':'user','csrf_token':'csrf'},403),({'user_id':2,'role':'player','csrf_token':'csrf'},403)]:
            with patch.object(auth,'current_user',return_value=user),patch.object(main,'get_db_connection') as connect:
                self.assertEqual(client.get('/api/admin/members').status_code,code)
                self.assertEqual(client.patch('/api/admin/players/1/member',json={'user_id':2},headers={'X-CSRF-Token':'csrf'}).status_code,code)
                connect.assert_not_called()
        with patch.object(auth,'current_user',return_value={'user_id':1,'role':'admin','csrf_token':'csrf'}),patch.object(main,'get_db_connection') as connect:
            self.assertEqual(client.patch('/api/admin/players/1/member',json={'user_id':None}).status_code,403)
            connect.assert_not_called()


@unittest.skipUnless(os.getenv('WGH_TEST_PLAYER_DB')=='1','Explicit test DB opt-in required')
class MembershipDatabaseTests(unittest.TestCase):
    def test_link_create_duplicate_move_role_and_rollback(self):
        import main,auth_store,uuid
        from types import SimpleNamespace
        from fastapi import HTTPException
        from video_repository import connect
        real=connect()
        class RollbackOnly:
            def cursor(self):return real.cursor()
            def commit(self):pass
            def close(self):pass
            def rollback(self):real.rollback()
        proxy=RollbackOnly()
        tables=['app_user','futsal_player','wgh_player_account','wgh_user_role','wgh_login_session']
        def counts():
            with real.cursor() as cur:
                result={}
                for table in tables:
                    cur.execute('SELECT COUNT(*) AS count FROM '+table);result[table]=cur.fetchone()['count']
                return result
        try:
            with real.cursor() as cur:
                cur.execute('SELECT DATABASE() AS db_name');self.assertEqual(cur.fetchone()['db_name'],'futsaldb_test')
                cur.execute('SELECT COALESCE(MAX(back_number),0)+1 AS number FROM futsal_player');number=cur.fetchone()['number']
            before=counts()
            with real.cursor() as cur:
                key=uuid.uuid4().hex
                cur.execute('INSERT INTO app_user (name,email) VALUES (%s,%s)',('temporary membership test',key+'@example.test'));user_id=cur.lastrowid
                cur.execute('INSERT INTO wgh_google_identity (google_sub,user_id) VALUES (%s,%s)',('test-'+key,user_id))
            request=SimpleNamespace(state=SimpleNamespace(wgh_user={'user_id':1}))
            with patch.object(main,'get_db_connection',return_value=proxy),patch.object(auth_store,'connect',return_value=proxy):
                first=main.create_player(main.PlayerCreate(player_name='temporary linked player',back_number=number,position='ALA',member_user_id=user_id),request)['data']['player_id']
                second=main.create_player(main.PlayerCreate(player_name='temporary other player',back_number=number+1,position='GK'),request)['data']['player_id']
                token=auth_store.create_session(user_id,3600)
                self.assertEqual(auth_store.get_session(token)['role'],'player')
                self.assertEqual(auth_store.get_session(token)['player_id'],first)
                with real.cursor() as cur:
                    with self.assertRaises(HTTPException) as error:auth_store.set_player_member(cur,second,user_id,1)
                    self.assertEqual(error.exception.status_code,409)
                    cur.execute('SELECT COUNT(*) AS count FROM wgh_user_role WHERE user_id=%s',(user_id,));self.assertEqual(cur.fetchone()['count'],0)
                main.update_player_member(first,main.PlayerMemberLink(user_id=None),request)
                self.assertEqual(auth_store.get_session(token)['role'],'user')
                main.update_player_member(second,main.PlayerMemberLink(user_id=user_id),request)
                self.assertEqual(auth_store.get_session(token)['player_id'],second)
                with real.cursor() as cur:cur.execute("INSERT INTO wgh_user_role (user_id,role) VALUES (%s,'admin')",(user_id,))
                self.assertEqual(auth_store.get_session(token)['role'],'admin')
                # Unknown Google member rolls back player and link together.
                with self.assertRaises(HTTPException):main.create_player(main.PlayerCreate(player_name='invalid member',back_number=number+2,position='ALA',member_user_id=1000000000),request)
            real.rollback();self.assertEqual(counts(),before)
        finally:real.rollback();real.close()
