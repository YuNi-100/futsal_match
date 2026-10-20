import os
import unittest
from unittest.mock import patch,MagicMock
from fastapi import FastAPI
from fastapi.testclient import TestClient
from src.api import account_routes as account
from src.auth import auth

USER={'user_id':9,'name':'회원','role':'user','csrf_token':'csrf','consent_required':False}
ADMIN={**USER,'user_id':1,'role':'admin'}

class AccountTests(unittest.TestCase):
 def setUp(self):
  app=FastAPI();app.include_router(account.router);self.client=TestClient(app)
  self.identity=patch.object(auth,'current_user',return_value=USER);self.mock_user=self.identity.start();self.addCleanup(self.identity.stop)
  self.connection=MagicMock();self.cur=self.connection.cursor.return_value.__enter__.return_value
  self.tx=patch.object(account.store,'transaction');self.tx.start().return_value.__enter__.return_value=self.connection;self.addCleanup(self.tx.stop)
  self.headers={'X-CSRF-Token':'csrf'}
 def test_private_information_and_management_restrictions(self):
  self.mock_user.return_value=None
  self.assertEqual(self.client.get('/auth/account').status_code,401)
  self.mock_user.return_value=USER
  self.assertEqual(self.client.get('/auth/account/management').status_code,403)
  self.assertEqual(self.client.post('/auth/account/requests/1/review',json={'decision':'approved','note':'ok'},headers=self.headers).status_code,403)
  self.assertEqual(self.client.post('/auth/account/requests',json={'reason':'test'}).status_code,403)
  self.cur.execute.assert_not_called()
 def test_consent_required_and_csrf_validation(self):
  self.mock_user.return_value={**USER,'consent_required':True}
  self.assertEqual(self.client.post('/auth/account/requests',json={'reason':'test'},headers=self.headers).status_code,403)
  for body in [{'terms':False,'privacy':True,'version':account.VERSION},{'terms':True,'privacy':True,'version':'old'}]:
   self.assertEqual(self.client.post('/auth/account/consent',json=body,headers=self.headers).status_code,422)
  r=self.client.post('/auth/account/consent',json={'terms':True,'privacy':True,'version':account.VERSION},headers=self.headers)
  self.assertEqual(r.status_code,200);self.assertEqual(r.headers['cache-control'],'no-store')
 def test_duplicate_application_and_blank_reason(self):
  self.cur.fetchone.return_value={'request_id':2}
  self.assertEqual(self.client.post('/auth/account/requests',json={'reason':'a'},headers=self.headers).status_code,409)
  self.assertEqual(self.client.post('/auth/account/requests',json={'reason':'  '},headers=self.headers).status_code,422)
 def test_approval_records_audit_and_rejects_repeat(self):
  self.mock_user.return_value=ADMIN;self.cur.fetchall.return_value=[{'user_id':1}]
  self.cur.fetchone.return_value={'user_id':9,'status':'pending'}
  r=self.client.post('/auth/account/requests/7/review',json={'decision':'approved','note':'verified'},headers=self.headers)
  self.assertEqual(r.status_code,200)
  sql=[c.args[0] for c in self.cur.execute.call_args_list]
  self.assertTrue(any('INSERT INTO wgh_user_role' in x for x in sql));self.assertTrue(any('INSERT INTO wgh_role_history' in x for x in sql))
  self.cur.fetchone.return_value={'user_id':9,'status':'approved'}
  self.assertEqual(self.client.post('/auth/account/requests/7/review',json={'decision':'approved','note':'verified'},headers=self.headers).status_code,409)
 def test_self_approval_and_last_admin_and_revoked_actor(self):
  self.mock_user.return_value=ADMIN;self.cur.fetchall.return_value=[{'user_id':1}];self.cur.fetchone.return_value={'user_id':1,'status':'pending'}
  self.assertEqual(self.client.post('/auth/account/requests/7/review',json={'decision':'approved','note':'a'},headers=self.headers).status_code,403)
  self.assertEqual(self.client.post('/auth/account/admins/1/revoke',json={'note':'a'},headers=self.headers).status_code,409)
  self.cur.fetchall.return_value=[{'user_id':2}]
  self.assertEqual(self.client.post('/auth/account/admins/2/revoke',json={'note':'a'},headers=self.headers).status_code,403)
 def test_rejection_never_grants_role(self):
  self.mock_user.return_value=ADMIN;self.cur.fetchall.return_value=[{'user_id':1}];self.cur.fetchone.return_value={'user_id':9,'status':'pending'}
  self.assertEqual(self.client.post('/auth/account/requests/7/review',json={'decision':'rejected','note':'reason'},headers=self.headers).status_code,200)
  self.assertFalse(any('INSERT INTO wgh_user_role' in c.args[0] for c in self.cur.execute.call_args_list))
 def test_unconsented_video_read_denied(self):
  from starlette.requests import Request
  self.mock_user.return_value={**USER,'consent_required':True}
  with self.assertRaises(auth.HTTPException) as error:
   auth.require_admin_for_request(Request({'type':'http','method':'GET','path':'/api/youtube-videos','headers':[],'query_string':b''}))
  self.assertEqual(error.exception.status_code,403)

if __name__=='__main__':unittest.main()
