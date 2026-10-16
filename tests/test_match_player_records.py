import os
import unittest
from unittest.mock import MagicMock, patch
from pydantic import ValidationError
from fastapi import HTTPException
from match_player_records import MatchPlayerRecord, save_match_players


class ValidationTests(unittest.TestCase):
    def test_negative_fractional_and_invalid_ids_rejected(self):
        for fields in [dict(player_id=0),dict(player_id=1,goals=-1),dict(player_id=1,assists=1.5)]:
            with self.assertRaises(ValidationError): MatchPlayerRecord(**fields)

    def test_omitted_records_are_preserved(self):
        cursor=MagicMock()
        save_match_players(cursor,1,None)
        cursor.execute.assert_not_called()

    def test_duplicate_players_fail_before_any_write(self):
        cursor=MagicMock()
        with self.assertRaises(HTTPException):
            save_match_players(cursor,1,[MatchPlayerRecord(player_id=1)]*2)
        cursor.execute.assert_not_called()


@unittest.skipUnless(os.getenv('WGH_TEST_PLAYER_DB')=='1','Explicit test DB opt-in required')
class TestDatabaseFlow(unittest.TestCase):
    def test_registration_edit_reload_aggregate_preservation_and_rollback(self):
        import main
        from video_repository import connect
        real=connect()
        class RollbackOnlyConnection:
            def cursor(self): return real.cursor()
            def commit(self): pass
            def close(self): pass
            def rollback(self): real.rollback()
        connection=RollbackOnlyConnection()
        try:
            with real.cursor() as cursor:
                cursor.execute('SELECT DATABASE() AS db_name')
                self.assertEqual(cursor.fetchone()['db_name'],'futsaldb_test')
                cursor.execute('SELECT player_id FROM futsal_player ORDER BY player_id LIMIT 2')
                first,second=[r['player_id'] for r in cursor.fetchall()]
                cursor.execute('SELECT COUNT(*) AS count FROM futsal_match')
                before_matches=cursor.fetchone()['count']
                cursor.execute('SELECT match_player_id,match_id,player_id,goals,assists FROM match_player ORDER BY match_player_id')
                before_records=cursor.fetchall()
            with patch.object(main,'get_db_connection',return_value=connection):
                baseline={r['player_id']:r for r in main.get_players()['data']}
                fields=dict(match_date='2026-10-16',opponent='temporary player save test',our_score=3,opponent_score=1,location='test')
                body=main.MatchCreate(**fields,players=[dict(player_id=first,goals=2,assists=1),dict(player_id=second,goals=1,assists=0)])
                match_id=main.create_match(body)['data']['match_id']
                rows=main.get_match_player_records(match_id)['data']
                self.assertEqual(rows,[dict(player_id=first,goals=2,assists=1),dict(player_id=second,goals=1,assists=0)])
                totals={r['player_id']:r for r in main.get_players()['data']}
                self.assertEqual(totals[first]['goals'],baseline[first]['goals']+2)
                self.assertEqual(totals[first]['assists'],baseline[first]['assists']+1)
                self.assertEqual(totals[first]['appearances'],baseline[first]['appearances']+1)
                edit=main.MatchCreate(**fields,players=[dict(player_id=second,goals=3,assists=2)])
                self.assertTrue(main.update_match(match_id,edit)['success'])
                self.assertTrue(main.update_match(match_id,edit)['success']) # unchanged score still succeeds
                self.assertEqual(main.get_match_player_records(match_id)['data'],[dict(player_id=second,goals=3,assists=2)])
                main.update_match(match_id,main.MatchCreate(**fields)) # old clients omit field
                self.assertEqual(len(main.get_match_player_records(match_id)['data']),1)
                main.update_match(match_id,main.MatchCreate(**fields,players=[]))
                self.assertEqual(main.get_match_player_records(match_id)['data'],[])
                bad=main.MatchCreate(**fields,players=[dict(player_id=1000000000,goals=1)])
                with self.assertRaises(HTTPException): main.update_match(match_id,bad)
                # Failure rolls back both parent changes and child changes, not just the child.
                with real.cursor() as cursor:
                    cursor.execute('SELECT COUNT(*) AS count FROM futsal_match WHERE match_id=%s',(match_id,))
                    self.assertEqual(cursor.fetchone()['count'],0)
                with self.assertRaises(HTTPException): main.create_match(bad)
            real.rollback()
            with real.cursor() as cursor:
                cursor.execute('SELECT COUNT(*) AS count FROM futsal_match')
                self.assertEqual(cursor.fetchone()['count'],before_matches)
                cursor.execute('SELECT match_player_id,match_id,player_id,goals,assists FROM match_player ORDER BY match_player_id')
                self.assertEqual(cursor.fetchall(),before_records)
        finally:
            real.rollback()
            real.close()


if __name__=='__main__': unittest.main()
