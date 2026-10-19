import json
import unittest
from unittest.mock import MagicMock, patch
from fastapi import FastAPI, Depends
from fastapi.testclient import TestClient
import auth
import feedback_store as store
import youtube_feedback as feedback


class FeedbackTests(unittest.TestCase):
    def setUp(self):
        app=FastAPI(dependencies=[Depends(auth.require_admin_for_request)])
        app.include_router(feedback.router);app.include_router(feedback.history_router)
        self.client=TestClient(app)
        self.user={'role':'admin','csrf_token':'csrf'}
        self.db=MagicMock()
        self.video={'video_id':9,'youtube_id':'Gfgr1JNRgG4','title':'은평vs다산2'}
        self.result={**self.video,'model':'gemini-test','analysis':{'summary':'확인한 경기 흐름','scenes':[{'time_seconds':60,'category':'확인 어려움','observation':'유니폼 식별 어려움','comment':'팀을 단정하지 않습니다.','next_action':'원본 확인'}],'limitations':['검수 필요']}}
        patches=[patch.object(auth,'current_user',side_effect=lambda request:self.user),
                 patch.object(feedback.repository,'connect',return_value=self.db),
                 patch.object(feedback.repository,'list_videos',return_value=[self.video]),
                 patch.object(store,'analysis_connection'),patch.object(store,'find_saved',return_value=None),
                 patch.object(feedback,'analyze_with_gemini',return_value=self.result),
                 patch.object(store,'save',side_effect=lambda db,result:{**result,'analysis_id':7})]
        self.mocks=[]
        for patcher in patches:
            self.mocks.append(patcher.start());self.addCleanup(patcher.stop)
        self.mocks[3].return_value.__enter__.return_value=self.db

    def submit(self,**overrides):
        return self.client.post('/api/youtube-videos/9/feedback',headers={'X-CSRF-Token':'csrf'},json={
            'team_color':'파란색 계열의 진한 유니폼','start_seconds':0,'end_seconds':1210,'consent':True,**overrides})

    def test_full_20_minute_video_saves_result_and_ambiguous_scene(self):
        response=self.submit()
        self.assertEqual(response.status_code,200,response.text)
        self.assertFalse(response.json()['cached'])
        self.assertEqual(response.json()['data']['analysis_id'],7)
        self.assertEqual(response.json()['data']['analysis']['scenes'][0]['category'],'확인 어려움')
        self.mocks[5].assert_called_once();self.mocks[6].assert_called_once()

    def test_cached_response_does_not_call_ai_or_save_again(self):
        self.mocks[4].return_value={**self.result,'analysis_id':7}
        self.assertTrue(self.submit().json()['cached'])
        self.mocks[5].assert_not_called();self.mocks[6].assert_not_called()

    def test_guests_members_and_missing_csrf_cannot_start_paid_request(self):
        for user,code in [(None,401),({'role':'user'},403),({'role':'player'},403)]:
            self.user=user;self.assertEqual(self.submit().status_code,code)
        self.user={'role':'admin','csrf_token':'csrf'}
        response=self.client.post('/api/youtube-videos/9/feedback',json={})
        self.assertEqual(response.status_code,403)
        self.mocks[5].assert_not_called()

    def test_invalid_range_or_missing_consent_has_no_ai_call(self):
        for values in [{'end_seconds':1801},{'end_seconds':0},{'consent':False}]:
            self.assertEqual(self.submit(**values).status_code,422)
        self.mocks[5].assert_not_called()

    def test_schema_error_does_not_make_paid_request(self):
        self.db.cursor.return_value.__enter__.return_value.execute.side_effect=RuntimeError('private database detail')
        response=self.submit();self.assertEqual(response.status_code,503)
        self.assertNotIn('private database detail',response.text)
        self.mocks[5].assert_not_called()

    def test_admin_history_is_not_visible_to_general_members(self):
        for role in ['user','player']:
            self.user={'role':role}
            self.assertEqual(self.client.get('/api/admin/video-analyses').status_code,403)
        self.user=None
        self.assertEqual(self.client.get('/api/admin/video-analyses/7').status_code,401)

    def test_scene_timestamps_must_be_inside_full_range(self):
        request=feedback.FeedbackRequest(team_color='파랑',start_seconds=0,end_seconds=1210,consent=True)
        data=self.result['analysis'];data['status']='observed'
        feedback.validate_feedback(json.dumps(data),request)
        data['scenes'][0]['time_seconds']=1210
        with self.assertRaises(ValueError):feedback.validate_feedback(json.dumps(data),request)


class FeedbackStorageTests(unittest.TestCase):
    def test_stores_only_analysis_and_events_with_one_commit(self):
        db=MagicMock();cur=db.cursor.return_value.__enter__.return_value;cur.lastrowid=4
        data={'video_id':9,'model':'test-model','storage_version':1,'request_key':'key',
              'analysis':{'summary':'피드백','scenes':[{'category':'잘한 점','time_seconds':10,'observation':'패스'}]}}
        self.assertEqual(store.save(db,data)['analysis_id'],4)
        statements=[call.args[0] for call in cur.execute.call_args_list]
        self.assertEqual(len(statements),2)
        self.assertTrue(statements[0].startswith('INSERT INTO video_analysis'))
        self.assertTrue(statements[1].startswith('INSERT INTO video_event'))
        db.commit.assert_called_once()

    def test_failed_event_save_does_not_commit(self):
        db=MagicMock();cur=db.cursor.return_value.__enter__.return_value
        cur.execute.side_effect=[1,RuntimeError('failed')]
        data={'video_id':9,'model':'test','analysis':{'summary':'피드백','scenes':[{'category':'확인 어려움','time_seconds':10}]}}
        with self.assertRaises(RuntimeError):store.save(db,data)
        db.commit.assert_not_called()

    def test_original_db_and_busy_lock_fail_before_generation(self):
        for results,code in [([{'db_name':'futsaldb'}],503),([{'db_name':'futsaldb_test'},{'acquired':0}],409)]:
            db=MagicMock();db.cursor.return_value.__enter__.return_value.fetchone.side_effect=results
            with patch.object(store.repository,'connect',return_value=db):
                with self.assertRaises(Exception) as error:
                    with store.analysis_connection():self.fail('must not enter')
            self.assertEqual(error.exception.status_code,code)
            db.rollback.assert_called_once();db.close.assert_called_once()
