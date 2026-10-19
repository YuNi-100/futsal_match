import unittest
from unittest.mock import MagicMock,patch
import pymysql
from fastapi import FastAPI,Depends
from fastapi.testclient import TestClient
import auth
import video_match_link as videos


class VideoDeletionTests(unittest.TestCase):
    def setUp(self):
        self.db=MagicMock();self.cur=self.db.cursor.return_value.__enter__.return_value
        self.user={'role':'admin','csrf_token':'csrf'}
        app=FastAPI(dependencies=[Depends(auth.require_admin_for_request)]);app.include_router(videos.router)
        self.client=TestClient(app)
        for name,patcher in [('user',patch.object(auth,'current_user',side_effect=lambda request:self.user)),('db',patch.object(videos.repository,'connect',return_value=self.db))]:
            patcher.start();self.addCleanup(patcher.stop)

    def delete(self):return self.client.delete('/api/youtube-videos/3',headers={'X-CSRF-Token':'csrf'})

    def test_admin_deletes_only_selected_video_metadata(self):
        self.cur.fetchone.return_value={'video_id':3}
        response=self.delete()
        self.assertEqual(response.status_code,200)
        self.assertEqual(response.json()['data']['video_id'],3)
        writes=[call for call in self.cur.execute.call_args_list if call.args[0].startswith('DELETE')]
        self.assertEqual(len(writes),1)
        self.assertEqual(writes[0].args,('DELETE FROM futsal_video WHERE video_id=%s AND user_id=%s',(3,1)))
        self.db.commit.assert_called_once();self.db.rollback.assert_not_called();self.db.close.assert_called_once()

    def test_missing_or_other_owner_returns_404_without_deleting(self):
        self.cur.fetchone.return_value=None
        self.assertEqual(self.delete().status_code,404)
        self.assertFalse(any(c.args[0].startswith('DELETE') for c in self.cur.execute.call_args_list))
        self.db.commit.assert_not_called();self.db.rollback.assert_called_once()

    def test_guest_general_player_and_csrf_denied_before_database(self):
        for user,code in [(None,401),({'role':'user','csrf_token':'csrf'},403),({'role':'player','csrf_token':'csrf'},403)]:
            self.user=user;self.assertEqual(self.delete().status_code,code)
        self.user={'role':'admin','csrf_token':'csrf'}
        self.assertEqual(self.client.delete('/api/youtube-videos/3').status_code,403)
        self.db.cursor.assert_not_called()

    def test_invalid_id_rejected(self):
        self.assertEqual(self.client.delete('/api/youtube-videos/0',headers={'X-CSRF-Token':'csrf'}).status_code,422)

    def test_database_failures_rollback_without_internal_details(self):
        for error,code in [(pymysql.err.IntegrityError(1451,'private detail'),409),(pymysql.err.OperationalError(2006,'private detail'),500)]:
            self.db.reset_mock();self.cur.execute.side_effect=error
            response=self.delete();self.assertEqual(response.status_code,code)
            self.assertNotIn('private detail',response.text)
            self.db.rollback.assert_called_once();self.db.commit.assert_not_called()
