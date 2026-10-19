import unittest
from unittest.mock import patch
from fastapi.testclient import TestClient
import auth


class VideoPageSplitTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        import main
        cls.client=TestClient(main.app)

    def test_anonymous_registration_page_has_no_management_html(self):
        with patch.object(auth,'current_user',return_value=None):
            response=self.client.get('/video-register.html')
        self.assertEqual(response.status_code,401)
        self.assertIn('로그인 후',response.text)
        self.assertNotIn('id="youtubeRegisterForm"',response.text)
        self.assertEqual(response.headers['cache-control'],'no-store')

    def test_non_admin_and_unconsented_admin_cannot_open_registration_page(self):
        for user in [dict(role='user'),dict(role='player'),dict(role='admin',consent_required=True)]:
            with self.subTest(user=user),patch.object(auth,'current_user',return_value=user):
                response=self.client.get('/video-register.html')
                self.assertEqual(response.status_code,403)
                self.assertNotIn('id="youtubeRegisterForm"',response.text)
                self.assertNotIn('id="videoLinkForm"',response.text)
                self.assertEqual(response.headers['cache-control'],'no-store')

    def test_admin_registration_contains_moved_sections_without_player(self):
        with patch.object(auth,'current_user',return_value={'role':'admin'}):
            response=self.client.get('/video-register.html')
        self.assertEqual(response.status_code,200)
        for name in ['youtubeRegisterForm','videoLinkForm','analysisList']:
            self.assertIn('id="'+name+'"',response.text)
        self.assertNotIn('id="fullPlayer"',response.text)
        self.assertIn('/video-register.js',response.text)
        self.assertEqual(response.headers['cache-control'],'no-store')

    def test_viewing_page_has_only_playback_sections(self):
        for role in ['user','player','admin']:
            with self.subTest(role=role),patch.object(auth,'current_user',return_value={'role':role}):
                response=self.client.get('/video.html')
                self.assertEqual(response.status_code,200)
                self.assertIn('id="fullPlayer"',response.text)
                self.assertIn('id="highlightPanel"',response.text)
                for name in ['youtubeRegisterForm','videoLinkForm','analysisList']:
                    self.assertNotIn('id="'+name+'"',response.text)

    def test_admin_lookup_error_fails_closed(self):
        from fastapi import HTTPException
        with patch.object(auth,'current_user',side_effect=HTTPException(503,'DB unavailable')):
            response=self.client.get('/video-register.html')
        self.assertEqual(response.status_code,503)
        self.assertNotIn('id="youtubeRegisterForm"',response.text)
