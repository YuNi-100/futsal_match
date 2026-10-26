"""Real PostgreSQL regressions, opt-in and restricted to the isolated local DB."""
import os,unittest,hashlib,json
from urllib.parse import urlsplit
from unittest.mock import patch
from concurrent.futures import ThreadPoolExecutor
from fastapi.testclient import TestClient
from pydantic import ValidationError
from src.api.club_routes import MatchLeagueChange,LeagueName,TeamNameChange


class MetadataValidationTests(unittest.TestCase):
    def test_league_change_rejects_record_fields_and_incomplete_or_invalid_ids(self):
        for payload in [{},{'league_id':1},{'league_id':1,'expected_league_id':None,'players':[]},
                        {'league_id':True,'expected_league_id':None},{'league_id':-1,'expected_league_id':None}]:
            with self.assertRaises(ValidationError):MatchLeagueChange(**payload)
        self.assertIsNone(MatchLeagueChange(league_id=None,expected_league_id=None).league_id)

    def test_names_trim_and_reject_empty_or_oversize(self):
        self.assertEqual(LeagueName(name='  위리그  ').name,'위리그')
        for name in ['   ','x'*101]:
            with self.assertRaises(ValidationError):LeagueName(name=name)
            with self.assertRaises(ValidationError):TeamNameChange(team_name=name,expected_revision=1)


@unittest.skipUnless(os.getenv('WGH_CLUB_TEST_DB')=='1','Isolated local PostgreSQL opt-in required')
class ClubPostgresTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        import psycopg
        from psycopg.rows import dict_row
        from src import app as main
        from src.auth import auth_store
        target=urlsplit(os.environ['DATABASE_URL'])
        assert target.hostname=='127.0.0.1' and target.path.startswith('/wgh_league_validate_')
        cls.main=main
        cls.db=psycopg.connect(os.environ['DATABASE_URL'],row_factory=dict_row,autocommit=True)
        cls.db.execute('SET search_path TO wgh,pg_catalog')
        cls.original_tables=[r['table_name'] for r in cls.db.execute("SELECT table_name FROM information_schema.tables WHERE table_schema='wgh' AND table_type='BASE TABLE' AND table_name NOT IN ('league','club_settings') ORDER BY table_name")]
        cls.match_id=cls.db.execute('SELECT match_id FROM futsal_match ORDER BY match_id LIMIT 1').fetchone()['match_id']
        cls.player_ids=[r['player_id'] for r in cls.db.execute('SELECT player_id FROM futsal_player ORDER BY player_id LIMIT 3')]
        admin=cls.db.execute("SELECT r.user_id FROM wgh_user_role r JOIN wgh_account_consent c USING(user_id) WHERE r.role='admin' ORDER BY r.user_id LIMIT 1").fetchone()['user_id']
        member=cls.db.execute("SELECT u.user_id FROM app_user u JOIN wgh_account_consent c USING(user_id) LEFT JOIN wgh_user_role r USING(user_id) WHERE coalesce(r.role,'user')<>'admin' ORDER BY u.user_id LIMIT 1").fetchone()['user_id']
        cls.admin_token=auth_store.create_session(admin,43200)
        cls.member_token=auth_store.create_session(member,43200)
        cls.csrf=auth_store.get_session(cls.admin_token)['csrf_token']
        cls.member_csrf=auth_store.get_session(cls.member_token)['csrf_token']
        cls.client=TestClient(main.app)
        cls.client.cookies.set('wgh_session',cls.admin_token)
        cls.league_a=cls.request('POST','/api/leagues',{'name':'위리그'})['league_id']
        cls.league_b=cls.request('POST','/api/leagues',{'name':'친선 경기'})['league_id']
        cls.baseline=cls.snapshot()

    @classmethod
    def tearDownClass(cls):
        cls.client.close();cls.db.close()

    @classmethod
    def request(cls,method,path,payload=None,expected=200,client=None,headers=None):
        response=(client or cls.client).request(method,path,json=payload,headers=headers if headers is not None else {'X-CSRF-Token':cls.csrf})
        assert response.status_code==expected,(method,path,response.status_code,response.text[:180])
        return response.json().get('data')

    @classmethod
    def snapshot(cls):
        from psycopg import sql
        result={}
        for table in cls.original_tables:
            projection=sql.SQL("to_jsonb(t)-'league_id'") if table=='futsal_match' else sql.SQL('to_jsonb(t)')
            rows=cls.db.execute(sql.SQL('SELECT ({})::text AS row FROM {} t').format(projection,sql.Identifier(table))).fetchall()
            result[table]=(len(rows),hashlib.sha256('\n'.join(sorted(r['row'] for r in rows)).encode()).hexdigest())
        return result

    def tearDown(self):
        self.assertEqual(self.snapshot(),self.baseline,'An original row, record ID or relationship changed')

    def change(self,league,expected=None,**kwargs):
        return self.request('PATCH',f'/api/matches/{self.match_id}/league',{'league_id':league,'expected_league_id':expected},**kwargs)

    def setUp(self):
        self.db.execute('UPDATE futsal_match SET league_id=NULL WHERE match_id=%s',(self.match_id,))

    def test_assign_replace_clear_and_repeat_never_call_record_savers(self):
        sequences=list(self.db.execute("SELECT sequencename,last_value FROM pg_sequences WHERE schemaname='wgh' AND sequencename<>'league_league_id_seq' ORDER BY sequencename"))
        with patch.object(self.main,'save_match_players',side_effect=AssertionError('No player writes')),patch('src.api.video_match_link.attach_video_to_new_match',side_effect=AssertionError('No video writes')):
            self.change(self.league_a)
            self.assertEqual(self.snapshot(),self.baseline)
            self.change(self.league_a,self.league_a)
            self.change(self.league_b,self.league_a)
            self.change(None,self.league_b)
        self.assertEqual(sequences,list(self.db.execute("SELECT sequencename,last_value FROM pg_sequences WHERE schemaname='wgh' AND sequencename<>'league_league_id_seq' ORDER BY sequencename")))

    def test_stale_missing_inactive_and_unknown_match_are_rejected(self):
        self.change(self.league_a)
        self.request('PATCH',f'/api/matches/{self.match_id}/league',{'league_id':self.league_b,'expected_league_id':None},expected=409)
        self.request('PATCH',f'/api/matches/{self.match_id}/league',{'league_id':999999999,'expected_league_id':self.league_a},expected=404)
        inactive=self.request('POST','/api/leagues',{'name':'비활성 검증 리그'})['league_id']
        self.db.execute('UPDATE league SET is_active=false WHERE league_id=%s',(inactive,))
        self.request('PATCH',f'/api/matches/{self.match_id}/league',{'league_id':inactive,'expected_league_id':self.league_a},expected=409)
        self.request('PATCH','/api/matches/999999999/league',{'league_id':None,'expected_league_id':None},expected=404)
        self.assertEqual(self.db.execute('SELECT league_id FROM futsal_match WHERE match_id=%s',(self.match_id,)).fetchone()['league_id'],self.league_a)

    def test_nonadmins_csrf_and_tampered_payloads_are_denied(self):
        url=f'/api/matches/{self.match_id}/league';payload={'league_id':self.league_a,'expected_league_id':None}
        with TestClient(self.main.app) as guest:
            self.request('PATCH',url,payload,client=guest,expected=401)
            self.request('POST','/api/leagues',{'name':'금지'},client=guest,expected=401)
            guest.cookies.set('wgh_session',self.member_token)
            self.request('PATCH',url,payload,client=guest,headers={'X-CSRF-Token':self.member_csrf},expected=403)
            self.request('PUT','/api/admin/club-settings',{'team_name':'금지','expected_revision':1},client=guest,headers={'X-CSRF-Token':self.member_csrf},expected=403)
        self.request('PATCH',url,payload,headers={},expected=403)
        self.request('PATCH',url,payload,headers={'X-CSRF-Token':'wrong'},expected=403)
        for extra in ['players','our_score','match_date','video_id']:
            self.request('PATCH',url,{**payload,extra:[] if extra=='players' else 1},expected=422)
        self.request('PATCH',url,{'league_id':None},expected=422)

    def test_same_name_reuse_and_concurrent_add(self):
        first=self.request('POST','/api/leagues',{'name':'  Sample League  '})
        second=self.request('POST','/api/leagues',{'name':'sample league'})
        self.assertEqual(first['league_id'],second['league_id'])
        def add(_):
            with TestClient(self.main.app) as client:
                client.cookies.set('wgh_session',self.admin_token)
                return self.request('POST','/api/leagues',{'name':'Concurrent League'},client=client)['league_id']
        with ThreadPoolExecutor(max_workers=2) as pool:ids=list(pool.map(add,range(2)))
        self.assertEqual(ids[0],ids[1])

    def test_concurrent_changes_do_not_overwrite(self):
        def change(league):
            with TestClient(self.main.app) as client:
                client.cookies.set('wgh_session',self.admin_token)
                return client.patch(f'/api/matches/{self.match_id}/league',json={'league_id':league,'expected_league_id':None},headers={'X-CSRF-Token':self.csrf}).status_code
        with ThreadPoolExecutor(max_workers=2) as pool:statuses=list(pool.map(change,[self.league_a,self.league_b]))
        self.assertEqual(sorted(statuses),[200,409])

    def test_team_name_updates_only_settings_and_checks_revision(self):
        current=self.request('GET','/api/club-settings')
        updated=self.request('PUT','/api/admin/club-settings',{'team_name':'  WGH 검증팀  ','expected_revision':current['revision']})
        self.assertEqual(updated['team_name'],'WGH 검증팀')
        self.assertEqual(self.request('GET','/api/matches')[0]['team_name'],'WGH 검증팀')
        self.request('PUT','/api/admin/club-settings',{'team_name':'오래된 이름','expected_revision':current['revision']},expected=409)
        self.request('PUT','/api/admin/club-settings',{'team_name':'WGH 은평','expected_revision':updated['revision']})

    def test_left_join_filters_and_detail_preserve_unassigned_matches(self):
        before=self.request('GET','/api/matches')
        self.assertEqual(len(before),11)
        self.assertTrue(all(m['league_id'] is None for m in before))
        self.change(self.league_a)
        selected=self.request('GET',f'/api/matches?league_id={self.league_a}')
        self.assertEqual([m['match_id'] for m in selected],[self.match_id])
        self.assertEqual(len(self.request('GET','/api/matches?unassigned=true')),10)
        detail=self.request('GET',f'/api/matches/{self.match_id}')
        self.assertEqual(detail['league_name'],'위리그')
        self.assertIn('players',detail);self.assertIn('videos',detail)
        self.request('GET',f'/api/matches?league_id={self.league_a}&unassigned=true',expected=422)
        self.request('GET','/api/matches?league_id=0',expected=422)

    def test_new_match_league_and_records_are_atomic_and_put_preserves_league(self):
        fields={'match_date':'2026-10-26','opponent':'검증 전용 경기','our_score':3,'opponent_score':0,
                'players':[{'player_id':self.player_ids[0],'goals':1},{'player_id':self.player_ids[1],'goals':2}]}
        match=self.request('POST','/api/matches',{**fields,'league_name':'신규 경기용 리그'},expected=201)
        mid=match['match_id'];lid=match['league_id']
        try:
            self.request('PUT',f'/api/matches/{mid}',fields)
            self.assertEqual(self.request('GET',f'/api/matches/{mid}')['league_id'],lid)
            self.request('PUT',f'/api/matches/{mid}',{**fields,'league_id':None},expected=422)
            edited={**fields,'players':fields['players']+[{'player_id':self.player_ids[2],'goals':1}]}
            self.request('PUT',f'/api/matches/{mid}',edited)
            self.request('PUT',f'/api/matches/{mid}',edited)
            records=self.request('GET',f'/api/matches/{mid}/players')
            self.assertEqual([row['goals'] for row in records],[1,2,1])
        finally:self.request('DELETE',f'/api/matches/{mid}')
        linked=self.db.execute('SELECT video_id FROM futsal_video WHERE match_id IS NOT NULL LIMIT 1').fetchone()['video_id']
        count=self.db.execute('SELECT count(*) AS n FROM futsal_match').fetchone()['n']
        self.request('POST','/api/matches',{**fields,'league_name':'롤백되어야 하는 리그','video_id':linked},expected=409)
        self.assertEqual(self.db.execute('SELECT count(*) AS n FROM futsal_match').fetchone()['n'],count)
        self.assertIsNone(self.db.execute("SELECT league_id FROM league WHERE name='롤백되어야 하는 리그'").fetchone())

    def test_mixed_league_and_memo_edit_keeps_existing_player_ids(self):
        original=self.request('GET',f'/api/matches/{self.match_id}')
        fields={key:original[key] for key in ['match_date','opponent','our_score','opponent_score','location','memo']}
        players=[{key:p[key] for key in ['player_id','goals','assists']} for p in original['players']]
        before=list(self.db.execute('SELECT * FROM match_player ORDER BY match_player_id'))
        sequences=list(self.db.execute("SELECT sequencename,last_value FROM pg_sequences WHERE schemaname='wgh' AND sequencename<>'league_league_id_seq' ORDER BY sequencename"))
        with patch.object(self.main,'save_match_players',side_effect=AssertionError('Unchanged player records must not be saved')):
            self.request('PUT',f'/api/matches/{self.match_id}',{**fields,'memo':'메모와 리그 동시 수정 검증','players':players,'league_id':self.league_a,'expected_league_id':None})
            self.assertEqual(self.request('GET',f'/api/matches/{self.match_id}')['league_id'],self.league_a)
            self.assertEqual(before,list(self.db.execute('SELECT * FROM match_player ORDER BY match_player_id')))
            self.request('PUT',f'/api/matches/{self.match_id}',{**fields,'players':players})
        self.assertEqual(sequences,list(self.db.execute("SELECT sequencename,last_value FROM pg_sequences WHERE schemaname='wgh' AND sequencename<>'league_league_id_seq' ORDER BY sequencename")))

    def test_mixed_edit_rolls_back_league_and_memo_if_player_validation_fails(self):
        original=self.request('GET',f'/api/matches/{self.match_id}')
        fields={key:original[key] for key in ['match_date','opponent','our_score','opponent_score','location','memo']}
        payload={**fields,'memo':'저장되면 안 되는 메모','players':[{'player_id':999999999,'goals':1}],
                 'league_id':self.league_a,'expected_league_id':None}
        self.request('PUT',f'/api/matches/{self.match_id}',payload,expected=422)
        current=self.request('GET',f'/api/matches/{self.match_id}')
        self.assertIsNone(current['league_id']);self.assertEqual(current['memo'],original['memo'])
        self.change(self.league_b)
        self.request('PUT',f'/api/matches/{self.match_id}',payload,expected=409)
        self.assertEqual(self.request('GET',f'/api/matches/{self.match_id}')['memo'],original['memo'])

    def test_delete_unused_league_only_deletes_its_definition(self):
        created=self.request('POST','/api/leagues',{'name':'잘못 추가한 리그 검증'})
        league_id=created['league_id']
        managed=self.request('GET','/api/admin/leagues')
        self.assertEqual(next(row['match_count'] for row in managed if row['league_id']==league_id),0)
        self.request('DELETE',f'/api/leagues/{league_id}')
        self.assertIsNone(self.db.execute('SELECT league_id FROM league WHERE league_id=%s',(league_id,)).fetchone())
        self.request('DELETE',f'/api/leagues/{league_id}',expected=404)
        self.request('DELETE','/api/leagues/0',expected=422)

    def test_delete_used_league_and_unauthorized_deletion_are_blocked(self):
        self.change(self.league_a)
        self.request('DELETE',f'/api/leagues/{self.league_a}',expected=409)
        self.assertEqual(self.db.execute('SELECT league_id FROM futsal_match WHERE match_id=%s',(self.match_id,)).fetchone()['league_id'],self.league_a)
        self.request('DELETE',f'/api/leagues/{self.league_a}',headers={},expected=403)
        with TestClient(self.main.app) as client:
            self.request('GET','/api/admin/leagues',client=client,expected=401)
            self.request('DELETE',f'/api/leagues/{self.league_a}',client=client,expected=401)
            client.cookies.set('wgh_session',self.member_token)
            self.request('GET','/api/admin/leagues',client=client,expected=403)
            self.request('DELETE',f'/api/leagues/{self.league_a}',client=client,headers={'X-CSRF-Token':self.member_csrf},expected=403)

    def test_concurrent_deletion_and_assignment_preserves_references(self):
        league_id=self.request('POST','/api/leagues',{'name':'동시 삭제 검증 리그'})['league_id']
        def action(kind):
            with TestClient(self.main.app) as client:
                client.cookies.set('wgh_session',self.admin_token)
                headers={'X-CSRF-Token':self.csrf}
                if kind=='delete':return client.delete(f'/api/leagues/{league_id}',headers=headers).status_code
                return client.patch(f'/api/matches/{self.match_id}/league',headers=headers,json={'league_id':league_id,'expected_league_id':None}).status_code
        with ThreadPoolExecutor(max_workers=2) as pool:deleted,assigned=list(pool.map(action,['delete','assign']))
        self.assertIn((deleted,assigned),[(200,404),(409,200)])
        self.assertEqual(self.db.execute('SELECT count(*) AS n FROM futsal_match m LEFT JOIN league l ON l.league_id=m.league_id WHERE m.league_id IS NOT NULL AND l.league_id IS NULL').fetchone()['n'],0)
