import os
import unittest
from unittest.mock import patch, MagicMock
from urllib.parse import urlsplit, parse_qs

from fastapi import FastAPI, Depends
from fastapi.testclient import TestClient
import auth
import auth_store

ENV = {'GOOGLE_CLIENT_ID': 'test-client', 'GOOGLE_CLIENT_SECRET': 'test-secret',
       'GOOGLE_REDIRECT_URI': 'http://localhost:8000/auth/google/callback'}
ADMIN = {'user_id': 7, 'name': '관리자', 'role': 'admin', 'csrf_token': 'valid-csrf'}
USER = {**ADMIN, 'role': 'user'}


class AuthorizationTests(unittest.TestCase):
    def setUp(self):
        self.env = patch.dict(os.environ, ENV); self.env.start(); self.addCleanup(self.env.stop)
        self.app = FastAPI(dependencies=[Depends(auth.require_admin_for_request)])
        self.app.include_router(auth.router)
        @self.app.get('/api/matches')
        def public():
            return {'data': ['existing WGH records']}
        @self.app.post('/api/matches')
        def write():
            return {'success': True}
        self.client = TestClient(self.app)

    def test_anonymous_public_read_never_needs_auth_database(self):
        with patch.object(auth.store, 'get_session', side_effect=AssertionError('DB must not be used')):
            self.assertEqual(self.client.get('/api/matches').json()['data'], ['existing WGH records'])

    def test_anonymous_write_denied(self):
        self.assertEqual(self.client.post('/api/matches').status_code, 401)

    def test_role_and_csrf_and_revocation(self):
        self.client.cookies.set('wgh_session', 'opaque-session')
        with patch.object(auth.store, 'get_session', return_value=USER):
            self.assertEqual(self.client.post('/api/matches', headers={'X-CSRF-Token': 'valid-csrf'}).status_code, 403)
        with patch.object(auth.store, 'get_session', return_value=ADMIN):
            self.assertEqual(self.client.post('/api/matches').status_code, 403)
            self.assertEqual(self.client.post('/api/matches', headers={'X-CSRF-Token': 'wrong'}).status_code, 403)
            self.assertEqual(self.client.post('/api/matches', headers={'X-CSRF-Token': 'valid-csrf'}).status_code, 200)
        with patch.object(auth.store, 'get_session', return_value=None):
            self.assertEqual(self.client.post('/api/matches', headers={'X-CSRF-Token': 'valid-csrf'}).status_code, 401)

    def test_me_no_cache_and_no_session_secret_in_json(self):
        self.client.cookies.set('wgh_session', 'opaque-session')
        with patch.object(auth.store, 'get_session', return_value=ADMIN):
            response = self.client.get('/auth/me')
        self.assertEqual(response.headers['cache-control'], 'no-store')
        self.assertEqual(response.json()['user']['role'], 'admin')
        self.assertNotIn('opaque-session', response.text)

    def test_logout_requires_csrf_then_deletes_session(self):
        self.client.cookies.set('wgh_session', 'opaque-session')
        with patch.object(auth.store, 'get_session', return_value=USER), patch.object(auth.store, 'delete_session') as delete:
            self.assertEqual(self.client.post('/auth/logout').status_code, 403)
            delete.assert_not_called()
            response = self.client.post('/auth/logout', headers={'X-CSRF-Token': 'valid-csrf'})
            self.assertEqual(response.status_code, 200)
            delete.assert_called_once_with('opaque-session')
            self.assertIn('Max-Age=0', response.headers['set-cookie'])

    def test_login_state_nonce_pkce_cookie(self):
        with patch.object(auth.store, 'save_oauth') as save:
            response = self.client.get('/auth/google/login', follow_redirects=False)
        params = parse_qs(urlsplit(response.headers['location']).query)
        self.assertEqual(params['scope'], ['openid email profile'])
        self.assertEqual(params['code_challenge_method'], ['S256'])
        self.assertEqual(save.call_args.args[0], params['state'][0])
        self.assertEqual(save.call_args.args[1], params['nonce'][0])
        self.assertIn('HttpOnly', response.headers['set-cookie'])

    def test_callback_missing_or_wrong_state_does_not_exchange(self):
        with patch.object(auth, 'exchange_claims') as exchange:
            self.assertEqual(self.client.get('/auth/google/callback?code=x&state=bad').status_code, 400)
            exchange.assert_not_called()

    def callback_setup(self):
        self.client.cookies.set('wgh_oauth_state', 'one-time-state')
        return '/auth/google/callback?code=test-code&state=one-time-state'

    def test_expired_or_replayed_state_denied(self):
        url = self.callback_setup()
        with patch.object(auth.store, 'consume_oauth', return_value=None), patch.object(auth, 'exchange_claims') as exchange:
            self.assertEqual(self.client.get(url).status_code, 400)
            exchange.assert_not_called()

    def test_invalid_nonce_unverified_email_or_invalid_signature_denied(self):
        url = self.callback_setup()
        claims = {'sub': '123', 'email': 'new@example.com', 'email_verified': True, 'nonce': 'expected'}
        with patch.object(auth.store, 'consume_oauth', return_value={'nonce': 'expected', 'verifier': 'v'}), patch.object(auth.store, 'resolve_user') as resolve:
            for invalid in [{**claims, 'nonce': 'bad'}, {**claims, 'email_verified': False}]:
                with patch.object(auth, 'exchange_claims', return_value=invalid):
                    self.assertEqual(self.client.get(url).status_code, 400)
            with patch.object(auth, 'exchange_claims', side_effect=ValueError('invalid signature')):
                self.assertEqual(self.client.get(url).status_code, 400)
            resolve.assert_not_called()

    def test_valid_login_creates_session_and_safe_redirect(self):
        url = self.callback_setup() + '&next=https://evil.example'
        with patch.object(auth.store, 'consume_oauth', return_value={'nonce': 'n', 'verifier': 'v'}), patch.object(auth, 'exchange_claims', return_value={'sub': '123', 'email': 'new@example.com', 'email_verified': True, 'nonce': 'n'}), patch.object(auth.store, 'resolve_user', return_value=9), patch.object(auth.store, 'create_session', return_value='new-session') as create:
            response = self.client.get(url, follow_redirects=False)
        self.assertEqual(response.status_code, 303)
        self.assertEqual(response.headers['location'], '/')
        create.assert_called_once_with(9, 43200, None)
        self.assertIn('HttpOnly', response.headers['set-cookie'])

    def test_production_cookie_https_and_insecure_production_rejected(self):
        with patch.dict(os.environ, {'GOOGLE_REDIRECT_URI': 'http://wgh.example/auth/google/callback'}):
            self.assertEqual(self.client.get('/auth/google/login', follow_redirects=False).status_code, 503)
        with patch.dict(os.environ, {'GOOGLE_REDIRECT_URI': 'https://wgh.example/auth/google/callback'}), patch.object(auth.store, 'save_oauth'):
            response = self.client.get('/auth/google/login', follow_redirects=False)
            self.assertIn('Secure', response.headers['set-cookie'])
            self.assertEqual(auth.session_cookie(), '__Host-wgh_session')


class StoreTests(unittest.TestCase):
    def test_existing_email_is_never_automatically_linked(self):
        connection = MagicMock()
        cursor = connection.cursor.return_value.__enter__.return_value
        cursor.fetchone.side_effect = [None, {'user_id': 1}]
        with patch.object(auth_store, 'connect', return_value=connection):
            with self.assertRaises(auth.HTTPException) as error:
                auth_store.resolve_user({'sub': 'verified-sub', 'email': 'existing@example.com'})
        self.assertEqual(error.exception.status_code, 409)
        self.assertFalse(any('INSERT' in call.args[0] for call in cursor.execute.call_args_list))
        connection.rollback.assert_called_once()

    def test_new_google_user_has_no_admin_role_write(self):
        connection = MagicMock()
        cursor = connection.cursor.return_value.__enter__.return_value
        cursor.fetchone.side_effect = [None, None]
        cursor.lastrowid = 8
        with patch.object(auth_store, 'connect', return_value=connection):
            self.assertEqual(auth_store.resolve_user({'sub': '123', 'email': 'new@example.com', 'role': 'admin'}), 8)
        self.assertFalse(any('wgh_user_role' in call.args[0] for call in cursor.execute.call_args_list))


class ExistingRouteTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        import main
        cls.main = main

    def test_all_existing_mutation_and_diagnostic_routes_denied_before_side_effects(self):
        with patch.dict(os.environ, ENV):
            client = TestClient(self.main.app)
            routes = [(method.upper(), path.replace('{match_id}', '1').replace('{schedule_id}', '1').replace('{video_id}', '1'))
                      for path, operations in self.main.app.openapi()['paths'].items()
                      for method in operations if path.startswith('/api') and
                      (method.upper() not in {'GET','HEAD','OPTIONS'} or path in {'/api/ai/test','/api/db-test'})]
            self.assertGreaterEqual(len(routes), 12)
            with patch.object(auth.store, 'get_session', return_value=USER):
                for method, path in routes:
                    with self.subTest(method=method, path=path):
                        self.assertEqual(client.request(method, path, json={}).status_code, 401)
                        client.cookies.set('wgh_session', 'user-session')
                        self.assertEqual(client.request(method, path, json={}).status_code, 403)
                        client.cookies.clear()

    def test_match_registration_keeps_original_payload_and_legacy_owner(self):
        connection = MagicMock()
        cursor = connection.cursor.return_value.__enter__.return_value
        cursor.lastrowid = 99
        body = self.main.MatchCreate(match_date='2026-10-16', opponent='test', our_score=1, opponent_score=0)
        with patch.object(self.main, 'get_db_connection', return_value=connection):
            self.assertTrue(self.main.create_match(body)['success'])
        sql, values = cursor.execute.call_args.args
        self.assertNotIn('start_time', sql)
        self.assertNotIn('end_time', sql)
        self.assertEqual(sql.count('%s'), len(values))
        self.assertEqual(values[0], 1)


if __name__ == '__main__':
    unittest.main()
