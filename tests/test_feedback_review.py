import copy
import json
import unittest
from unittest.mock import MagicMock, patch
from fastapi import FastAPI, Depends
from fastapi.testclient import TestClient
from src.auth import auth
from src.db import feedback_store as store
from src.api import youtube_feedback as feedback


def original():
    return {'storage_version':1,'video_id':9,'title':'은평vs다산2','start_seconds':0,'end_seconds':1210,
            'request_key':'private-key','team_color':'blue','usage':{'input_tokens':99},
            'analysis':{'summary':'원래 AI 요약','scenes':[{'time_seconds':10,'comment':'원래 AI 코멘트'}]}}


class ReviewStorageTests(unittest.TestCase):
    def setUp(self):
        self.db=MagicMock();self.cur=self.db.cursor.return_value.__enter__.return_value

    def update(self,data,publish=False,revision=0,seconds=60):
        self.cur.fetchone.side_effect=[{'db_name':'futsaldb_test'},{'analysis_id':1,'feedback':json.dumps(data)}]
        payload=feedback.ReviewUpdate(revision=revision,summary='수정한 요약',scenes=[{'time_seconds':seconds,'comment':'짧게 수정한 코멘트'}],publish=publish)
        return store.update_review(self.db,1,payload,7)

    def test_draft_saves_edits_without_publishing_or_altering_ai_source(self):
        data=original();result=self.update(data)
        self.assertEqual(result['analysis'],data['analysis'])
        self.assertNotIn('publication',result['review'])
        self.assertEqual(result['review']['revision'],1)
        self.assertEqual(result['review']['scenes'][0]['time_seconds'],60)
        writes=[c.args[0] for c in self.cur.execute.call_args_list if c.args[0].startswith('UPDATE')]
        self.assertEqual(writes,['UPDATE video_analysis SET feedback=%s WHERE analysis_id=%s'])
        self.db.commit.assert_called_once()

    def test_publish_creates_snapshot_and_later_draft_preserves_it(self):
        published=self.update(original(),publish=True)
        snapshot=copy.deepcopy(published['review']['publication'])
        draft=self.update(published,revision=1,seconds=70)
        self.assertEqual(draft['review']['publication'],snapshot)
        self.assertEqual(draft['review']['scenes'][0]['time_seconds'],70)
        self.cur.fetchall.return_value=[{'analysis_id':1,'feedback':json.dumps(draft)}]
        view=store.published_for_video(self.db,9)
        self.assertEqual(view['scenes'][0]['time_seconds'],60)
        for private in ['review','request_key','usage','team_color','analysis']:
            self.assertNotIn(private,view)

    def test_unreviewed_and_draft_results_never_reach_member_response(self):
        draft=self.update(original())
        self.cur.fetchall.return_value=[{'analysis_id':2,'feedback':json.dumps(draft)},{'analysis_id':1,'feedback':json.dumps(original())}]
        self.assertIsNone(store.published_for_video(self.db,9))

    def test_conflicting_revision_and_out_of_range_time_do_not_commit(self):
        for values,code in [({'revision':2},409),({'seconds':1210},422),({'seconds':-1},422)]:
            self.db.reset_mock()
            with self.assertRaises(Exception) as error:self.update(original(),**values)
            if hasattr(error.exception,'status_code'):self.assertEqual(error.exception.status_code,code)
            self.db.commit.assert_not_called()

    def test_original_database_is_not_modified(self):
        self.cur.fetchone.side_effect=None;self.cur.fetchone.return_value={'db_name':'futsaldb'}
        with self.assertRaises(Exception):store.update_review(self.db,1,feedback.ReviewUpdate(revision=0,summary='',scenes=[{'time_seconds':1,'comment':'검수'}]),7)
        self.assertEqual(self.cur.execute.call_count,1);self.db.commit.assert_not_called()


class ReviewRouteTests(unittest.TestCase):
    def setUp(self):
        app=FastAPI(dependencies=[Depends(auth.require_admin_for_request)]);app.include_router(feedback.router);app.include_router(feedback.history_router)
        self.client=TestClient(app);self.user={'user_id':7,'role':'admin','csrf_token':'csrf'};self.db=MagicMock()
        for patcher in [patch.object(auth,'current_user',side_effect=lambda req:self.user),patch.object(feedback.repository,'connect',return_value=self.db)]:
            patcher.start();self.addCleanup(patcher.stop)

    def submit(self):return self.client.patch('/api/admin/video-analyses/1/review',headers={'X-CSRF-Token':'csrf'},json={'revision':0,'summary':'검수','scenes':[{'time_seconds':60,'comment':'수정'}],'publish':True})

    def test_only_admin_with_csrf_can_save_or_publish(self):
        with patch.object(store,'update_review',return_value={'review':{'revision':1}}) as update:
            for user,status in [(None,401),({'role':'player'},403),({'role':'user'},403),({'role':'admin','consent_required':True},403)]:
                self.user=user;self.assertEqual(self.submit().status_code,status)
            update.assert_not_called()
            self.user={'user_id':7,'role':'admin','csrf_token':'csrf'}
            self.assertEqual(self.client.patch('/api/admin/video-analyses/1/review',json={}).status_code,403)
            self.assertEqual(self.submit().status_code,200);update.assert_called_once()

    def test_players_and_members_can_read_published_result_but_guests_cannot(self):
        with patch.object(store,'published_for_video',return_value=None) as get:
            self.user=None;self.assertEqual(self.client.get('/api/youtube-videos/9/analysis').status_code,401);get.assert_not_called()
            for role in ['user','player','admin']:
                self.user={'role':role};response=self.client.get('/api/youtube-videos/9/analysis')
                self.assertEqual(response.status_code,200);self.assertIsNone(response.json()['data'])

    def test_save_failure_rolls_back_without_leaking_db_error(self):
        with patch.object(store,'update_review',side_effect=RuntimeError('private database detail')):
            response=self.submit()
        self.assertEqual(response.status_code,503);self.assertNotIn('private database detail',response.text);self.db.rollback.assert_called_once()

    def test_review_page_and_management_order(self):
        from src import app as main
        client=TestClient(main.app)
        response=client.get('/video-register.html');self.assertEqual(response.status_code,200)
        titles=['id="uploadTitle"','id="analysisRunTitle"','id="analysisTitle"','id="videoLinkTitle"']
        positions=[response.text.index(title) for title in titles];self.assertEqual(positions,sorted(positions))
        response=client.get('/feedback-review.html?analysis_id=1');self.assertEqual(response.status_code,200)
        self.assertIn('분석한 영상 결과',response.text);self.assertNotIn('id="feedbackForm"',response.text)
        self.user={'role':'player'};self.assertEqual(client.get('/feedback-review.html?analysis_id=1').status_code,403)
