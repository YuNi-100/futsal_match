import unittest
from unittest.mock import patch
from fastapi import FastAPI
from fastapi.testclient import TestClient
import auth


class SessionDiagnosticsTests(unittest.TestCase):
    def setUp(self):
        app = FastAPI()
        app.include_router(auth.router)
        self.client = TestClient(app, base_url='http://localhost')
        patcher = patch.object(auth, 'settings', return_value=('client', 'secret', 'http://localhost/auth/google/callback', False))
        patcher.start()
        self.addCleanup(patcher.stop)

    def test_no_cookie_reports_only_booleans_without_database_lookup(self):
        with patch.object(auth.store, 'get_session') as lookup:
            response = self.client.get('/auth/session-check')
        self.assertEqual(response.json(), {'cookie_received':False,'other_cookie_received':False,'signed_in':False,'host_matches_login':True})
        lookup.assert_not_called()
        self.assertEqual(response.headers['cache-control'], 'no-store')

    def test_invalid_and_valid_cookie_are_distinguishable_without_returning_tokens(self):
        self.client.cookies.set('wgh_session', 'private-token')
        for user in [None, {'user_id':1,'role':'admin','csrf_token':'private-csrf'}]:
            with patch.object(auth.store, 'get_session', return_value=user):
                response = self.client.get('/auth/session-check')
            self.assertTrue(response.json()['cookie_received'])
            self.assertEqual(response.json()['signed_in'], user is not None)
            self.assertNotIn('private-token', response.text)
            self.assertNotIn('private-csrf', response.text)

    def test_different_host_is_reported(self):
        response = self.client.get('http://127.0.0.1/auth/session-check')
        self.assertFalse(response.json()['host_matches_login'])
