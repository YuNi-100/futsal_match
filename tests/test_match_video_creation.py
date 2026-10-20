import unittest
from unittest.mock import MagicMock,patch
from fastapi import HTTPException
from pydantic import ValidationError
from src.api.video_match_link import attach_video_to_new_match


class MatchVideoCreationTests(unittest.TestCase):
    def test_omitted_video_does_not_touch_links(self):
        cursor=MagicMock();attach_video_to_new_match(cursor,99,None)
        cursor.execute.assert_not_called()

    def test_attach_unlinked_video_changes_only_match_link(self):
        cursor=MagicMock();cursor.fetchone.return_value={'video_id':7,'match_id':None}
        attach_video_to_new_match(cursor,99,7)
        sql,args=cursor.execute.call_args.args
        self.assertEqual(sql,'UPDATE futsal_video SET match_id=%s WHERE video_id=%s AND user_id=%s')
        self.assertEqual(args,(99,7,1))

    def test_stale_or_missing_selection_never_reassigns_other_match(self):
        for row,status in [(None,404),({'video_id':7,'match_id':6},409)]:
            cursor=MagicMock();cursor.fetchone.return_value=row
            with self.assertRaises(HTTPException) as raised:attach_video_to_new_match(cursor,99,7)
            self.assertEqual(raised.exception.status_code,status)
            self.assertFalse(any(call.args[0].startswith('UPDATE') for call in cursor.execute.call_args_list))

    def test_match_creation_rolls_back_on_video_conflict(self):
        from src import app as main
        db=MagicMock();cursor=db.cursor.return_value.__enter__.return_value
        cursor.lastrowid=99;cursor.fetchone.return_value={'video_id':7,'match_id':6}
        body=main.MatchCreate(match_date='2026-10-19',opponent='temporary',our_score=1,opponent_score=0,video_id=7)
        with patch.object(main,'get_db_connection',return_value=db),self.assertRaises(HTTPException):main.create_match(body)
        db.rollback.assert_called_once();db.commit.assert_not_called()

    def test_success_commits_match_and_link_once(self):
        from src import app as main
        db=MagicMock();cursor=db.cursor.return_value.__enter__.return_value
        cursor.lastrowid=99;cursor.fetchone.return_value={'video_id':7,'match_id':None}
        body=main.MatchCreate(match_date='2026-10-19',opponent='temporary',our_score=1,opponent_score=0,video_id=7)
        with patch.object(main,'get_db_connection',return_value=db):result=main.create_match(body)
        self.assertEqual(result['data']['match_id'],99)
        db.commit.assert_called_once();db.rollback.assert_not_called()

    def test_invalid_video_identifiers_are_rejected(self):
        from src import app as main
        for value in [0,-1,1.5,True]:
            with self.assertRaises(ValidationError):main.MatchCreate(match_date='2026-10-19',opponent='temporary',our_score=1,opponent_score=0,video_id=value)
