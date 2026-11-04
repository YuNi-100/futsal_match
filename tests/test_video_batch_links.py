import unittest
from unittest.mock import MagicMock,patch
from fastapi import FastAPI,Depends,HTTPException
from fastapi.testclient import TestClient
from pydantic import ValidationError
from src.api import video_match_link as links
from src.auth import auth


class BatchLinksTests(unittest.TestCase):
    def setUp(self):
        self.db=MagicMock();self.cursor=self.db.cursor.return_value.__enter__.return_value
        self.user={'role':'admin','csrf_token':'csrf'}
        app=FastAPI(dependencies=[Depends(auth.require_admin_for_request)]);app.include_router(links.router)
        self.client=TestClient(app)
        for p in [patch.object(auth,'current_user',side_effect=lambda _:self.user),patch.object(links.repository,'connect',return_value=self.db)]:
            p.start();self.addCleanup(p.stop)
    def send(self,body,headers=None):
        return self.client.patch('/api/youtube-videos/match-links',json=body,headers={'X-CSRF-Token':'csrf'} if headers is None else headers)
    def body(self,target=9,old=None):return {'match_id':target,'videos':[{'video_id':i,'expected_match_id':old} for i in range(1,7)]}
    def test_six_links_commit_together_without_changing_metadata(self):
        self.cursor.fetchone.side_effect=[{'match_id':9}]+[{'video_id':i,'match_id':None} for i in range(1,7)]
        self.assertEqual(self.send(self.body()).status_code,200)
        writes=[c.args for c in self.cursor.execute.call_args_list if c.args[0].startswith('UPDATE')]
        self.assertEqual(len(writes),6)
        self.assertTrue(all(q=='UPDATE futsal_video SET match_id=%s WHERE video_id=%s AND user_id=%s' for q,_ in writes))
        self.assertEqual([p for _,p in writes],[(9,i,1) for i in range(1,7)])
        self.db.commit.assert_called_once()
    def test_stale_sixth_selection_rolls_back_without_any_video_write(self):
        self.cursor.fetchone.side_effect=[{'match_id':9}]+[{'video_id':i,'match_id':None} for i in range(1,6)]+[{'video_id':6,'match_id':44}]
        self.assertEqual(self.send(self.body()).status_code,409)
        self.db.rollback.assert_called_once();self.db.commit.assert_not_called()
        self.assertFalse(any(c.args[0].startswith('UPDATE') for c in self.cursor.execute.call_args_list))
    def test_missing_video_or_target_rolls_back(self):
        for answers in [[None],[{'match_id':9},None]]:
            self.cursor.fetchone.side_effect=answers
            self.assertEqual(self.send(self.body()).status_code,404)
        self.db.commit.assert_not_called()
    def test_explicit_move_and_unlink_use_expected_links(self):
        for target in [9,None]:
            self.cursor.fetchone.side_effect=([{'match_id':9}] if target else [])+[{'video_id':i,'match_id':5} for i in range(1,7)]
            self.assertEqual(self.send(self.body(target,5)).status_code,200)
        self.assertEqual(self.db.commit.call_count,2)
    def test_current_link_is_noop_and_unselected_links_untouched(self):
        self.cursor.fetchone.side_effect=[{'match_id':9},{'video_id':1,'match_id':9}]
        self.assertEqual(self.send({'match_id':9,'videos':[{'video_id':1,'expected_match_id':9}]}).status_code,200)
        self.assertFalse(any(c.args[0].startswith('UPDATE') for c in self.cursor.execute.call_args_list))
    def test_invalid_duplicate_empty_and_missing_expected_state_rejected(self):
        cases=[[],[{'video_id':1}],[{'video_id':True,'expected_match_id':None}],[{'video_id':1,'expected_match_id':None}]*2,[{'video_id':i,'expected_match_id':None} for i in range(1,202)]]
        for rows in cases:self.assertEqual(self.send({'match_id':9,'videos':rows}).status_code,422)
        self.db.commit.assert_not_called()
    def test_roles_and_csrf_remain_required(self):
        for user,status in [(None,401),({'role':'user'},403)]:
            self.user=user;self.assertEqual(self.send(self.body()).status_code,status)
        self.user={'role':'admin','csrf_token':'csrf'}
        self.assertEqual(self.send(self.body(),headers={}).status_code,403)
        self.db.commit.assert_not_called()
    def test_new_match_six_videos_in_same_transaction(self):
        from src import app as main
        self.cursor.lastrowid=99
        self.cursor.fetchone.side_effect=[{'video_id':i,'match_id':None} for i in range(1,7)]
        body=main.MatchCreate(match_date='2026-11-03',opponent='FS아리아',our_score=0,opponent_score=0,video_links=self.body()['videos'])
        with patch.object(main,'get_db_connection',return_value=self.db):main.create_match(body)
        self.db.commit.assert_called_once()
        writes=[c.args[1] for c in self.cursor.execute.call_args_list if c.args[0].startswith('UPDATE futsal_video')]
        self.assertEqual(writes,[(99,i,1) for i in range(1,7)])
    def test_new_match_rolls_back_entire_record_on_stale_video(self):
        from src import app as main
        self.cursor.lastrowid=99
        self.cursor.fetchone.side_effect=[{'video_id':1,'match_id':None},{'video_id':2,'match_id':44}]
        body=main.MatchCreate(match_date='2026-11-03',opponent='FS아리아',our_score=0,opponent_score=0,video_links=self.body()['videos'])
        with patch.object(main,'get_db_connection',return_value=self.db),self.assertRaises(HTTPException):main.create_match(body)
        self.db.rollback.assert_called_once();self.db.commit.assert_not_called()

if __name__=='__main__':unittest.main()
