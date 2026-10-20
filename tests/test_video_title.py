import unittest
from unittest.mock import MagicMock, patch
import pymysql
from fastapi import FastAPI, Depends
from fastapi.testclient import TestClient
from src.auth import auth
from src.api import video_match_link as videos


class VideoTitleTests(unittest.TestCase):
    def setUp(self):
        self.db = MagicMock()
        self.cur = self.db.cursor.return_value.__enter__.return_value
        self.cur.fetchone.return_value = {'video_id': 3}
        self.user = {'role': 'admin', 'csrf_token': 'csrf'}
        app = FastAPI(dependencies=[Depends(auth.require_admin_for_request)])
        app.include_router(videos.router)
        self.client = TestClient(app)
        for patcher in (patch.object(auth, 'current_user', side_effect=lambda request: self.user),
                        patch.object(videos.repository, 'connect', return_value=self.db)):
            patcher.start()
            self.addCleanup(patcher.stop)

    def rename(self, title=' 새 제목 '):
        return self.client.patch('/api/youtube-videos/3/title', json={'title': title}, headers={'X-CSRF-Token': 'csrf'})

    def test_only_title_updated_and_same_title_allowed(self):
        for title in (' 새 제목 ', '기존 제목'):
            self.db.reset_mock()
            response = self.rename(title)
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.json()['data'], {'video_id': 3, 'title': title.strip()})
            writes = [c.args for c in self.cur.execute.call_args_list if c.args[0].startswith('UPDATE')]
            self.assertEqual(writes, [('UPDATE futsal_video SET title=%s WHERE video_id=%s AND user_id=%s', (title.strip(), 3, 1))])
            self.db.commit.assert_called_once()
            self.db.close.assert_called_once()

    def test_invalid_titles_and_id_rejected_before_database(self):
        for value in ('', '   ', 'x'*201, None, 123):
            self.assertEqual(self.rename(value).status_code, 422)
        self.assertEqual(self.client.patch('/api/youtube-videos/0/title', json={'title': '제목'}, headers={'X-CSRF-Token': 'csrf'}).status_code, 422)
        self.db.cursor.assert_not_called()

    def test_roles_and_csrf_rejected_before_database(self):
        for user, code in ((None, 401), ({'role': 'user'}, 403), ({'role': 'player'}, 403)):
            self.user = user
            self.assertEqual(self.rename().status_code, code)
        self.user = {'role': 'admin', 'csrf_token': 'csrf'}
        self.assertEqual(self.client.patch('/api/youtube-videos/3/title', json={'title': '제목'}).status_code, 403)
        self.db.cursor.assert_not_called()

    def test_missing_or_other_owner_does_not_write(self):
        self.cur.fetchone.return_value = None
        self.assertEqual(self.rename().status_code, 404)
        self.db.commit.assert_not_called()
        self.db.rollback.assert_called_once()
        self.assertFalse(any(c.args[0].startswith('UPDATE') for c in self.cur.execute.call_args_list))

    def test_db_failure_rolled_back_without_private_details(self):
        self.cur.execute.side_effect = pymysql.err.OperationalError(2006, 'private database detail')
        response = self.rename()
        self.assertEqual(response.status_code, 500)
        self.assertNotIn('private database detail', response.text)
        self.db.commit.assert_not_called()
        self.db.rollback.assert_called_once()
        self.db.close.assert_called_once()
